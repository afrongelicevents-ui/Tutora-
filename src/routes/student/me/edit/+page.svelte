<script lang="ts">
	// Edit profile: photo (crop to a circle and compress in the browser), then the details.
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	import { avatarColour, initialsOf } from '#lib/components/profile/ProfileCard.svelte';
	let { data, form } = $props();
	const p = $derived(data.profile);
	const v = $derived((form?.values ?? {}) as Record<string, string>);

	// ---- photo crop: draw the chosen picture into a square, the student zooms and drags it
	const OUT = 320; // the saved photo is 320 × 320 px, WebP or JPEG, about 20–40 KB
	let canvas = $state<HTMLCanvasElement | null>(null);
	let photoForm = $state<HTMLFormElement | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);
	let img = $state<HTMLImageElement | null>(null);
	let zoom = $state(1);
	let ox = $state(0);
	let oy = $state(0);
	let busy = $state(false);

	function draw() {
		if (!canvas || !img) return;
		const c = canvas.getContext('2d')!;
		const base = Math.max(OUT / img.width, OUT / img.height);
		const s = base * zoom;
		const w = img.width * s;
		const h = img.height * s;
		c.fillStyle = '#fff';
		c.fillRect(0, 0, OUT, OUT);
		c.drawImage(img, (OUT - w) / 2 + ox, (OUT - h) / 2 + oy, w, h);
	}
	$effect(() => {
		void zoom;
		void ox;
		void oy;
		draw();
	});
	function pick(e: Event) {
		const f = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!f) return;
		const url = URL.createObjectURL(f);
		const i = new Image();
		i.onload = () => {
			img = i;
			zoom = 1;
			ox = 0;
			oy = 0;
			draw();
			URL.revokeObjectURL(url);
		};
		i.src = url;
	}
	// drag to move the picture (the canvas is drawn at 320 px but shown smaller)
	let drag: { x: number; y: number; ox: number; oy: number } | null = null;
	const down = (e: PointerEvent) => {
		drag = { x: e.clientX, y: e.clientY, ox, oy };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	};
	const move = (e: PointerEvent) => {
		if (!drag) return;
		const scale = OUT / ((e.currentTarget as HTMLElement).clientWidth || OUT);
		ox = drag.ox + (e.clientX - drag.x) * scale;
		oy = drag.oy + (e.clientY - drag.y) * scale;
	};
	const up = () => (drag = null);

	async function savePhoto() {
		if (!canvas || !photoForm || !fileInput) return;
		busy = true;
		const blob: Blob | null = await new Promise((res) => {
			canvas!.toBlob(
				(b) =>
					b && b.type === 'image/webp' ? res(b) : canvas!.toBlob((j) => res(j), 'image/jpeg', 0.8),
				'image/webp',
				0.8
			);
		});
		if (!blob) return (busy = false);
		const dt = new DataTransfer();
		dt.items.add(
			new File([blob], `photo.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`, { type: blob.type })
		);
		fileInput.files = dt.files;
		photoForm.requestSubmit();
	}
</script>

<svelte:head><title>{m.pe_title()} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/student/me">← {m.pf_title()}</a>
	<h1>{m.pe_title()}</h1>
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if form?.photo === 'saved'}<p class="notice" role="status">{m.pe_photo_saved()}</p>{/if}
	{#if form?.photo === 'removed'}<p class="notice" role="status">{m.pe_photo_removed()}</p>{/if}

	<!-- photo -->
	<section class="card stack photo-box">
		<h2 class="h3">{m.pe_photo()}</h2>
		<div class="photo-row">
			{#if img}
				<canvas
					bind:this={canvas}
					width={OUT}
					height={OUT}
					class="crop"
					onpointerdown={down}
					onpointermove={move}
					onpointerup={up}
					onpointercancel={up}
					aria-label={m.pe_crop_hint()}
				></canvas>
			{:else if p.photoVersion}
				<img
					class="crop"
					src="/profile-photo/{data.id}?v={p.photoVersion}"
					alt=""
					width="160"
					height="160"
				/>
			{:else}
				<span class="crop ini" style="background:{avatarColour(p.displayName)}"
					>{initialsOf(p.displayName)}</span
				>
			{/if}
		</div>
		{#if img}
			<p class="small muted">{m.pe_crop_hint()}</p>
			<label class="field"
				><span>{m.pe_zoom()}</span><input
					type="range"
					min="1"
					max="3"
					step="0.05"
					bind:value={zoom}
				/></label
			>
			<button class="btn" type="button" onclick={savePhoto} disabled={busy}
				>{m.pe_save_photo()}</button
			>
		{:else}
			<div class="acts">
				<label class="btn btn-secondary"
					>{m.pe_upload()}<input
						class="sr-only"
						type="file"
						accept="image/*"
						onchange={pick}
					/></label
				>
				<label class="btn btn-secondary"
					>{m.pe_take()}<input
						class="sr-only"
						type="file"
						accept="image/*"
						capture="user"
						onchange={pick}
					/></label
				>
			</div>
			{#if p.photoVersion}
				<form method="POST" action="?/removePhoto">
					<button class="btn-link small" type="submit">{m.pe_remove()}</button>
				</form>
			{/if}
		{/if}
		<p class="small muted">{m.pe_photo_hint()}</p>
		<form method="POST" action="?/photo" enctype="multipart/form-data" bind:this={photoForm} hidden>
			<input type="file" name="photo" bind:this={fileInput} />
		</form>
	</section>

	<!-- details -->
	<form method="POST" action="?/save" class="card stack" novalidate>
		<div class="field">
			<label for="pe-display">{m.pe_display()}</label>
			<input
				id="pe-display"
				name="displayName"
				required
				maxlength="30"
				value={v.displayName ?? p.displayName}
				aria-describedby="pe-display-h"
			/>
			<span class="hint" id="pe-display-h">{m.pe_display_hint()}</span>
		</div>
		<div class="field">
			<label for="pe-bio">{m.pe_bio()}</label>
			<textarea id="pe-bio" name="bio" maxlength="150" rows="3" aria-describedby="pe-bio-h"
				>{v.bio ?? p.bio ?? ''}</textarea
			>
			<span class="hint" id="pe-bio-h">{m.pe_bio_hint()}</span>
		</div>
		<div class="field">
			<label for="pe-grade">{m.pe_grade()}</label>
			<input id="pe-grade" name="grade" maxlength="40" value={v.grade ?? p.grade ?? ''} />
		</div>
		<div class="field">
			<label for="pe-subjects">{m.pe_subjects()}</label>
			<input
				id="pe-subjects"
				name="subjects"
				maxlength="400"
				value={v.subjects ?? (p.subjects.length ? p.subjects : data.suggested).join(', ')}
				aria-describedby="pe-subjects-h"
			/>
			<span class="hint" id="pe-subjects-h">{m.pe_subjects_hint()}</span>
		</div>
		<div class="field">
			<label for="pe-fav">{m.pe_fav()}</label>
			<select id="pe-fav" name="favouriteSubject">
				<option value="">{m.pe_fav_none()}</option>
				{#each p.subjects.length ? p.subjects : data.suggested as s (s)}
					<option value={s} selected={(v.favouriteSubject ?? p.favouriteSubject) === s}>{s}</option>
				{/each}
			</select>
		</div>
		<div class="field">
			<label for="pe-goals">{m.pe_goals()}</label>
			<textarea id="pe-goals" name="goals" maxlength="200" rows="2" aria-describedby="pe-goals-h"
				>{v.goals ?? p.goals ?? ''}</textarea
			>
			<span class="hint" id="pe-goals-h">{m.pe_goals_hint()}</span>
		</div>
		<div class="field">
			<label for="pe-school">{m.pe_school()}</label>
			<input
				id="pe-school"
				name="school"
				maxlength="80"
				value={v.school ?? p.school ?? ''}
				aria-describedby="pe-school-h"
			/>
			<span class="hint" id="pe-school-h">{m.pe_school_hint()}</span>
		</div>
		<div class="field">
			<label for="pe-birth">{m.pe_birth()}</label>
			{#if p.birthDate}
				<input type="hidden" name="birthDate" value={p.birthDate} />
				<p class="small muted" id="pe-birth">
					{m.pe_birth_locked({ date: fmtDay(new Date(p.birthDate + 'T12:00:00Z')) })}
				</p>
			{:else}
				<input
					id="pe-birth"
					name="birthDate"
					type="date"
					value={v.birthDate ?? ''}
					aria-describedby="pe-birth-h"
				/>
				<span class="hint" id="pe-birth-h">{m.pe_birth_hint()}</span>
			{/if}
		</div>
		<div class="acts">
			<button class="btn" type="submit">{m.pe_save()}</button>
			<a class="btn btn-secondary" href="/student/me">{m.pe_cancel()}</a>
		</div>
	</form>
</div>

<style>
	.back {
		align-self: flex-start;
		color: var(--ocean);
		font-weight: 600;
		text-decoration: none;
		padding: 8px 0;
	}
	.photo-row {
		display: flex;
		justify-content: center;
	}
	.crop {
		width: 160px;
		height: 160px;
		border-radius: 50%;
		object-fit: cover;
		box-shadow:
			0 0 0 3px #fff,
			0 0 0 5px var(--ocean);
		touch-action: none;
		cursor: grab;
	}
	.ini {
		display: grid;
		place-items: center;
		color: #fff;
		font: 600 3rem var(--font-display);
		cursor: default;
	}
	.acts {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.acts label.btn {
		cursor: pointer;
	}
	.field input[type='range'] {
		width: 100%;
	}
</style>
