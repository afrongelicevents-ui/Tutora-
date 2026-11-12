<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { m, t } from '#lib/i18n.ts';
	import { fmtTime } from '#lib/tz.ts';
	import { shrink } from '#lib/shrink.ts';
	import { RoomClient, type BoardMsg, type Person, type Stroke } from '#lib/room-client.ts';
	let { data, form } = $props();

	let people = $state<Person[]>([]);
	let admitted = $state(false);
	let files = $state<{ id: number; name: string; url: string }[]>([]);
	let chat = $state<{ who: string; text: string }[]>([]);
	let quality = $state<0 | 1 | 2 | 3>(0);
	let mb = $state(0);
	let status = $state<'connecting' | 'live' | 'reconnecting' | 'error'>('connecting');
	let micError = $state(false);
	let muted = $state(false);
	let videoOn = $state(false);
	let hd = $state(false);
	let screenOn = $state(false);
	let color = $state('#1c2620');
	let draft = $state('');
	let started = $state(false);
	// the button only works once the page's JavaScript has loaded (can take a while on slow 3G)
	let ready = $state(false);
	let remotes = $state<Record<string, MediaStream>>({});
	let myVideo = $state<MediaStream | null>(null);
	let canvas: HTMLCanvasElement | undefined = $state();
	let client: RoomClient | null = null;

	const waiting = $derived(people.filter((p) => p.status === 'waiting'));
	const inRoom = $derived(people.filter((p) => p.status === 'admitted'));
	const qualityText = $derived([m.room_q0(), m.room_q1(), m.room_q2(), m.room_q3()][quality]);

	function redraw() {
		if (!canvas || !client) return;
		const ctx = canvas.getContext('2d')!;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		for (const s of client.strokes) drawStroke(s);
	}
	function drawStroke(s: Stroke) {
		if (!canvas) return;
		const ctx = canvas.getContext('2d')!;
		const W = canvas.width;
		const H = canvas.height;
		ctx.strokeStyle = s.c === 'erase' ? '#ffffff' : s.c;
		ctx.lineWidth = (s.c === 'erase' ? 18 : s.w) * (window.devicePixelRatio || 1);
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.beginPath();
		s.p.forEach(([x, y], i) => (i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H)));
		ctx.stroke();
	}
	function resize() {
		if (!canvas) return;
		const dpr = window.devicePixelRatio || 1;
		canvas.width = canvas.clientWidth * dpr;
		canvas.height = canvas.clientHeight * dpr;
		redraw();
	}

	let current: Stroke | null = null;
	const point = (e: PointerEvent): [number, number] => {
		const r = canvas!.getBoundingClientRect();
		return [
			+((e.clientX - r.left) / r.width).toFixed(4),
			+((e.clientY - r.top) / r.height).toFixed(4)
		];
	};
	function down(e: PointerEvent) {
		canvas!.setPointerCapture(e.pointerId);
		current = { c: color, w: 3, p: [point(e)] };
	}
	function move(e: PointerEvent) {
		if (!current) return;
		current.p.push(point(e));
		drawStroke({ ...current, p: current.p.slice(-2) });
	}
	function up() {
		if (!current) return;
		if (current.p.length > 1) client?.broadcast({ t: 'stroke', s: current });
		current = null;
	}
	function clearBoard() {
		client?.broadcast({ t: 'clear' });
		redraw();
	}
	function sendChat(e: SubmitEvent) {
		e.preventDefault();
		const text = draft.trim().slice(0, 500);
		if (!text) return;
		chat = [...chat, { who: m.you(), text }];
		client?.broadcast({ t: 'chat', name: data.me.name, text });
		draft = '';
	}

	async function start() {
		started = true;
		client = new RoomClient(
			data.lessonId,
			data.me,
			data.ice,
			{
				people: (p) => (people = p),
				admitted: (v) => (admitted = v),
				files: (f) => {
					if (f.length !== files.length) files = f;
				},
				message: (msg: BoardMsg, from: string) => {
					// the name comes from the server's list of people, not from the message itself
					const who = people.find((p) => p.userId === from)?.name ?? '?';
					if (msg.t === 'chat') chat = [...chat, { who, text: String(msg.text).slice(0, 500) }];
					else redraw();
				},
				remoteStream: (id, s) => (remotes = { ...remotes, [id]: s }),
				remoteGone: (id) => {
					const { [id]: _gone, ...rest } = remotes;
					void _gone;
					remotes = rest;
				},
				quality: (q, used) => {
					quality = q;
					mb = used;
				},
				state: (s, detail) => {
					if (s === 'error' && detail === 'mic') micError = true;
					else status = s;
				}
			},
			data.group
		);
		await client.start();
		resize();
	}

	async function toggleVideo() {
		try {
			myVideo = await client!.setVideo(!videoOn, hd);
			videoOn = !videoOn;
		} catch {
			alert(m.room_camera_error());
		}
	}
	async function toggleHd() {
		hd = !hd;
		if (videoOn) myVideo = await client!.setVideo(true, hd);
	}
	async function toggleScreen() {
		try {
			await client!.setScreen(!screenOn);
			screenOn = !screenOn;
		} catch {
			/* cancelled */
		}
	}
	async function leave() {
		await client?.stop();
		client = null;
		goto(data.me.isTutor ? '/tutor' : '/student');
	}

	function srcObject(node: HTMLMediaElement, stream: MediaStream | null) {
		node.srcObject = stream;
		return { update: (s: MediaStream | null) => (node.srcObject = s) };
	}

	onMount(() => {
		ready = true;
		window.addEventListener('resize', resize);
		const bye = () => void client?.stop();
		window.addEventListener('pagehide', bye);
		return () => {
			window.removeEventListener('resize', resize);
			window.removeEventListener('pagehide', bye);
		};
	});
	onDestroy(() => void client?.stop());
	// Re-measure the board whenever its size changes (e.g. when the tutor lets you in,
	// the room goes from hidden to visible), otherwise it would draw at 0 x 0 pixels.
	$effect(() => {
		if (!canvas) return;
		const ro = new ResizeObserver(() => resize());
		ro.observe(canvas);
		return () => ro.disconnect();
	});
</script>

<svelte:head><title>{m.room_title()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<h1>{m.room_title()}</h1>
	<p class="small muted">
		{data.title ?? m.intro_chat()} · {fmtTime(data.startsAt)}–{fmtTime(data.endsAt)}
	</p>

	{#if !started}
		<div class="card stack">
			<p>{m.room_ready_lead()}</p>
			<p class="small muted">{m.room_data_note()}</p>
			<button class="btn btn-block" type="button" onclick={start} disabled={!ready}
				>{!ready ? m.loading() : data.me.isTutor ? m.room_start() : m.room_join()}</button
			>
		</div>
	{:else if !admitted}
		<div class="card stack" role="status">
			<p><b>{m.room_waiting()}</b></p>
			<p class="small muted">{m.room_waiting_lead()}</p>
		</div>
	{/if}

	{#if started}
		{#if micError}<p class="alert">{m.room_mic_error()}</p>{/if}
		<div class="room" class:hidden={!admitted}>
			<div class="room-top">
				<span class="sig-wrap">
					<span class="sig" aria-hidden="true"
						>{#each [4, 7, 10, 13] as h, i (i)}<i style="height:{h}px" class:off={i >= quality}
							></i>{/each}</span
					>
					<span
						>{status === 'reconnecting'
							? m.room_reconnecting()
							: status === 'connecting' && !inRoom.length
								? m.room_connecting()
								: qualityText}</span
					>
				</span>
				<span>{m.room_mb({ mb: mb.toFixed(1) })}</span>
			</div>
			{#if quality === 1}<p class="small tip" role="status">{m.room_weak_tip()}</p>{/if}
			{#if data.me.isTutor}
				{#each waiting as p (p.userId)}
					<div class="knock">
						<span>{m.room_knocking({ name: p.name })}</span><button
							class="btn btn-sm"
							type="button"
							onclick={() => client?.admit(p.userId)}>{m.room_let_in()}</button
						>
					</div>
				{/each}
			{/if}
			<div class="people">
				{#each inRoom as p (p.userId)}<span class="person"
						><span class="dot">{p.name[0]}</span>{p.userId === data.me.id ? m.you() : p.name}</span
					>{/each}
			</div>
			{#each Object.entries(remotes) as [id, s] (id)}
				{#if s.getVideoTracks().length}
					<video class="video" autoplay playsinline use:srcObject={s}></video>
				{:else}
					<audio autoplay use:srcObject={s}></audio>
				{/if}
			{/each}
			{#if myVideo}<video class="video mine" autoplay playsinline muted use:srcObject={myVideo}
				></video>{/if}
			<canvas
				class="board"
				bind:this={canvas}
				aria-label={m.room_board()}
				onpointerdown={down}
				onpointermove={move}
				onpointerup={up}
				onpointercancel={up}
			></canvas>
			<div class="tools" role="toolbar" aria-label={m.room_board()}>
				{#each ['#1c2620', '#6b1e33', '#1f5fa8'] as c (c)}
					<button
						type="button"
						aria-pressed={color === c}
						aria-label={m.room_pen()}
						onclick={() => (color = c)}><span class="swatch" style="background:{c}"></span></button
					>
				{/each}
				<button type="button" aria-pressed={color === 'erase'} onclick={() => (color = 'erase')}
					>{m.room_eraser()}</button
				>
				{#if data.me.isTutor}<button type="button" onclick={clearBoard}>{m.room_clear()}</button
					>{/if}
			</div>
			<div class="tools" role="toolbar" aria-label={m.room_call()}>
				<button
					type="button"
					aria-pressed={muted}
					onclick={() => {
						muted = !muted;
						client?.setMuted(muted);
					}}>{muted ? m.room_unmute() : m.room_mute()}</button
				>
				<button type="button" aria-pressed={videoOn} onclick={toggleVideo}
					>{videoOn ? m.room_video_off() : m.room_video()}</button
				>
				{#if data.me.isTutor && videoOn}<button type="button" aria-pressed={hd} onclick={toggleHd}
						>{m.room_hd()}</button
					>{/if}
				<button type="button" aria-pressed={screenOn} onclick={toggleScreen}
					>{screenOn ? m.room_share_stop() : m.room_share()}</button
				>
				<button type="button" class="end" onclick={leave}>{m.room_leave()}</button>
			</div>
			<div class="chat" aria-live="polite">
				{#each chat as c, i (i)}<p><b>{c.who}:</b> {c.text}</p>{:else}<p class="muted small">
						{m.room_chat_empty()}
					</p>{/each}
			</div>
		</div>
		{#if admitted}
			<form class="row" style="margin-top:8px" onsubmit={sendChat}>
				<label class="sr-only" for="chat-in">{m.room_message()}</label>
				<input
					id="chat-in"
					class="grow input"
					bind:value={draft}
					maxlength="500"
					autocomplete="off"
					placeholder={m.room_message()}
				/>
				<button class="btn btn-sm" type="submit">{m.send()}</button>
			</form>
			<div class="card" style="margin-top:10px">
				<b>{m.room_files()}</b>
				<ul class="list">
					{#each files as f (f.id)}<li>
							<span>{f.name}</span><a
								class="btn btn-secondary btn-sm"
								href={f.url}
								target="_blank"
								rel="noopener">{m.open()}</a
							>
						</li>{:else}<li class="small muted">{m.none_yet()}</li>{/each}
				</ul>
				{#if form?.error}<p class="alert">{t(form.error)}</p>{/if}
				<form
					method="POST"
					action="?/file"
					enctype="multipart/form-data"
					class="stack"
					use:enhance={() =>
						async ({ update }) => {
							// keep the call running: don't reload the page
							await update({ reset: true, invalidateAll: false });
						}}
				>
					<label class="small" for="rf">{m.room_share_file()}</label>
					<input
						id="rf"
						name="file"
						type="file"
						accept="image/jpeg,image/png,image/webp,application/pdf"
						required
						use:shrink
					/>
					<button class="btn btn-secondary btn-sm" type="submit">{m.room_share_file_btn()}</button>
				</form>
			</div>
		{/if}
	{/if}
</section>

<style>
	.room {
		background: #1d191a;
		color: #fff;
		border-radius: var(--radius);
		overflow: hidden;
	}
	.hidden {
		display: none;
	}
	.room-top {
		display: flex;
		justify-content: space-between;
		padding: 10px 12px;
		font-size: 0.85rem;
	}
	.sig-wrap {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.sig {
		display: inline-flex;
		gap: 2px;
		align-items: flex-end;
		height: 14px;
	}
	.sig i {
		width: 4px;
		background: #e2a8b4;
		border-radius: 1px;
	}
	.sig i.off {
		background: #4a4243;
	}
	.knock {
		background: var(--amber-50, #fdf3e1);
		color: #6b4600;
		padding: 8px 12px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}
	.people {
		display: flex;
		gap: 8px;
		padding: 8px 12px;
		flex-wrap: wrap;
	}
	.person {
		display: flex;
		align-items: center;
		gap: 6px;
		background: #2c2627;
		border-radius: 99px;
		padding: 4px 10px 4px 4px;
		font-size: 0.85rem;
	}
	.dot {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--brand-700);
		display: grid;
		place-items: center;
		font-weight: 700;
	}
	.video {
		display: block;
		width: 100%;
		max-height: 240px;
		background: #121011;
	}
	.video.mine {
		max-height: 120px;
		width: 40%;
		margin-left: auto;
	}
	.board {
		display: block;
		width: 100%;
		height: 320px;
		background: #fff;
		touch-action: none;
		cursor: crosshair;
	}
	.tools {
		display: flex;
		gap: 6px;
		padding: 8px;
		flex-wrap: wrap;
		background: #262022;
	}
	.tools button {
		min-height: 44px;
		min-width: 44px;
		padding: 0 12px;
		border-radius: 10px;
		border: 0;
		background: #3d3436;
		color: #fff;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.tools button[aria-pressed='true'] {
		background: var(--rose-400);
		color: var(--ink-900);
	}
	.tools .end {
		background: #b3261e;
		margin-left: auto;
	}
	.swatch {
		display: inline-block;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		border: 2px solid #fff;
		vertical-align: middle;
	}
	.chat {
		background: #fff;
		color: var(--ink-900);
		padding: 10px;
		max-height: 200px;
		overflow: auto;
		font-size: 0.9rem;
	}
	.chat p {
		margin: 0 0 6px;
	}
</style>
