<script lang="ts">
	import ToolLogo from '#lib/components/tools/ToolLogo.svelte';
	import { joinLabel, providerName } from '#lib/components/tools/join.ts';
	import { m, t } from '#lib/i18n.ts';
	import { fmtDayTime, fmtTime } from '#lib/tz.ts';
	import MaterialList from '#lib/components/tools/MaterialList.svelte';
	let { data, form } = $props();
	const l = $derived(data.lesson);
	let linkKind = $state<'kahoot' | 'link'>('link');
</script>

<svelte:head><title>{m.lesson_title()} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/tutor/calendar" aria-label={m.cal_title()}>←</a>
	<span class="eyebrow"
		>{fmtDayTime(l.startsAt)}–{fmtTime(l.endsAt)} · {l.mode === 'online'
			? m.mode_online()
			: m.mode_in_person()}{l.status === 'cancelled' ? ` · ${m.cancelled()}` : ''}</span
	>
	<h1>{l.subjectName ?? m.intro_chat()}</h1>
	{#if form && 'error' in form && form.error}<p class="alert" role="alert">
			{t(form.error as string)}
		</p>{/if}
	{#if form && 'saved' in form}<p class="notice" role="status">{m.saved()}</p>{/if}
	{#if data.roomOff}<p class="notice" role="status">{m.room_off()}</p>{/if}
	{#if data.roomClosed && !data.roomOpen && !data.roomOff}<p class="alert" role="alert">
			{m.room_not_open({ before: 10, after: 120 })}
		</p>{/if}

	{#if l.status === 'scheduled'}
		<div class="navycard">
			<span class="eyebrow">{m.tools6_how_join()}</span>
			{#if l.mode === 'online'}
				{#if data.meeting}
					<strong class="withlogo"
						><ToolLogo tool={data.meeting.provider} size={24} chip />{providerName(
							data.meeting.provider
						)}</strong
					>
					{#if data.roomOpen}
						<a
							class="btn btn-block"
							href={data.meeting.url}
							target="_blank"
							rel="noopener noreferrer">{joinLabel(data.meeting.provider)}</a
						>
						{#if data.videoRoom}<a class="btn btn-ghost btn-block" href="/room/{l.id}"
								>{m.ml_room_alt()}</a
							>{/if}
					{:else}<span class="small">{m.ml_opens()}</span>{/if}
				{:else if data.videoRoom}
					<strong>{m.tools6_room()}</strong>
					{#if data.roomOpen}<a class="btn btn-block" href="/room/{l.id}">{m.room_start()}</a
						>{:else}<span class="small">{m.room_opens_10()}</span>{/if}
					{#if !data.group && l.people.length === 1}<a
							class="small"
							href="/tutor/students/{l.people[0].userId}#lesson-link">{m.ml_h()} ›</a
						>{/if}
				{:else}
					<strong>{m.sl_tutor_no_link()}</strong>
					<span class="small">{m.sl_tutor_no_link_lead()}</span>
					{#if data.group}<a class="btn btn-block" href="#class-link">{m.sl_add_link()}</a>
					{:else if l.people.length === 1}<a
							class="btn btn-block"
							href="/tutor/students/{l.people[0].userId}#lesson-link">{m.sl_add_link()}</a
						>{/if}
				{/if}
			{:else}
				<strong>{m.mode_in_person()}</strong>
			{/if}
			<a class="btn btn-ghost btn-block" href="/lessons/{l.id}/ics">{m.add_to_calendar()}</a>
		</div>
	{/if}

	{#if data.group}
		<!-- Tutora Pro: tools for the whole class (message, homework, attendance) -->
		<p>
			<a class="btn btn-secondary btn-block" href="/tutor/class/{l.id}">{m.pro_class_open()}</a>
		</p>
	{/if}

	{#if data.group && l.mode === 'online' && l.status === 'scheduled'}
		<!-- one recurring link for everybody in this group/class lesson (no API keys) -->
		<section class="block" id="class-link">
			<div class="section-h"><h2>{m.ml_class_h()}</h2></div>
			<p class="note">{m.ml_class_lead()}</p>
			{#if form && 'classDone' in form}<p class="notice" role="status">
					{form.classDone === 'removed' ? m.ml_removed() : m.ml_saved()}
				</p>{/if}
			<form method="POST" action="?/classLink" class="stack">
				<label for="class-url">{m.ml_label()}</label>
				<input
					id="class-url"
					name="url"
					type="url"
					inputmode="url"
					class="input"
					required
					maxlength="500"
					placeholder="https://meet.google.com/abc-defg-hij"
					defaultValue={form && 'classUrl' in form ? form.classUrl : (data.classLink?.url ?? '')}
				/>
				<span class="note">{m.ml_tip()}</span>
				<button class="btn btn-sm" type="submit">{m.ml_save()}</button>
			</form>
			{#if data.classLink}
				<form method="POST" action="?/classLink">
					<input type="hidden" name="remove" value="1" />
					<button class="btn btn-ghost btn-sm" type="submit">{m.ml_remove()}</button>
				</form>
			{/if}
		</section>
	{/if}

	<section class="block">
		<div class="section-h"><h2>{m.tools6_materials()}</h2></div>
		<MaterialList
			items={data.materials}
			empty={m.tools6_materials_none()}
			removeAction="?/removeMaterial"
		/>
		<p class="note">{m.tl_drive_paste_hint()}</p>
		<details class="add">
			<summary>{m.ld3_add_file()}</summary>
			<form method="POST" action="?/addFile" enctype="multipart/form-data" class="stack">
				<label class="field"
					><span class="label">{m.tools6_link_title()}</span><input
						name="title"
						maxlength="160"
					/></label
				>
				<label class="field"
					><span class="label">{m.ld3_file_pick()}</span><span class="hint"
						>{m.file_hint_5mb()}</span
					><input
						name="file"
						type="file"
						accept="image/jpeg,image/png,image/webp,application/pdf"
						required
					/></label
				>
				<button class="btn btn-ghost" type="submit">{m.ld3_add_file()}</button>
			</form>
		</details>
		<details class="add">
			<summary>{data.kahootOn ? m.tools6_add_kahoot_or_link() : m.tools6_add_link()}</summary>
			<form method="POST" action="?/addLink" class="stack">
				{#if data.kahootOn}
					<div class="chips" role="radiogroup" aria-label={m.tools6_kind()}>
						<label class="chip"
							><input
								type="radio"
								name="kind"
								value="link"
								bind:group={linkKind}
							/>{m.tools6_src_link()}</label
						>
						<label class="chip"
							><input type="radio" name="kind" value="kahoot" bind:group={linkKind} />Kahoot!</label
						>
					</div>
				{:else}
					<input type="hidden" name="kind" value="link" />
				{/if}
				<label class="field"
					><span class="label">{m.tools6_link_title()}</span><input
						name="title"
						maxlength="160"
						required
						placeholder={linkKind === 'kahoot'
							? m.tools6_kahoot_title_ph()
							: m.tools6_link_title_ph()}
					/></label
				>
				<label class="field"
					><span class="label">{m.tools6_link_url()}</span><input
						name="url"
						type="url"
						inputmode="url"
						maxlength="2000"
						required
						placeholder={linkKind === 'kahoot' ? 'https://create.kahoot.it/…' : 'https://…'}
					/></label
				>
				{#if linkKind === 'kahoot'}<p class="note">{m.tools6_kahoot_link_hint()}</p>{/if}
				<button class="btn btn-sm" type="submit">{m.tools6_add()}</button>
			</form>
		</details>
	</section>

	<section class="block">
		<div class="section-h"><h2>{m.lesson_people({ n: l.people.length, cap: l.capacity })}</h2></div>
		{#each l.people as p (p.attendeeId)}
			<div class="person">
				<a href="/tutor/students/{p.userId}"><b>{p.name}</b></a>
				{#if p.childName}<p class="small muted">{m.ld_for()}: {p.childName}</p>{/if}
				{#if data.started}
					<div class="row">
						<span class="small grow"
							>{p.attendance === 'completed'
								? m.status_done()
								: p.attendance === 'absent'
									? m.att_absent()
									: m.att_not_marked()}</span
						>
						<form method="POST" action="?/attendance">
							<input type="hidden" name="attendeeId" value={p.attendeeId} /><input
								type="hidden"
								name="value"
								value="completed"
							/><button class="btn btn-sm" type="submit">{m.att_mark_done()}</button>
						</form>
						<form method="POST" action="?/attendance">
							<input type="hidden" name="attendeeId" value={p.attendeeId} /><input
								type="hidden"
								name="value"
								value="absent"
							/><button class="btn btn-ghost btn-sm" type="submit">{m.att_mark_absent()}</button>
						</form>
					</div>
				{/if}
				<form method="POST" action="?/note" class="stack">
					<input type="hidden" name="attendeeId" value={p.attendeeId} />
					<label class="small" for="note-{p.attendeeId}">{m.private_note()}</label>
					<textarea
						id="note-{p.attendeeId}"
						name="note"
						maxlength="2000"
						rows="3"
						placeholder={m.private_note_hint()}
						defaultValue={p.note ?? ''}></textarea>
					<button class="btn btn-ghost btn-sm" type="submit">{m.save_note()}</button>
				</form>
			</div>
		{/each}
	</section>

	{#if l.status === 'scheduled'}
		<details class="add">
			<summary class="danger">{m.cancel_lesson()}</summary>
			<form method="POST" action="?/cancel" class="stack">
				<p class="small">{m.cancel_lesson_lead()}</p>
				<label class="check"
					><input type="checkbox" name="sure" /> <span>{m.cancel_lesson_sure()}</span></label
				>
				<button class="btn btn-warn" type="submit">{m.cancel_lesson()}</button>
			</form>
		</details>
	{/if}
</div>

<style>
	.withlogo {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.block {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.person {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px 0;
		border-bottom: 1px solid var(--border);
	}
	.person:last-child {
		border-bottom: none;
	}
	.person a {
		color: var(--text);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.grow {
		flex: 1;
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: 10px;
		align-items: flex-start;
		margin-top: 10px;
	}
	.stack .field,
	.stack textarea {
		width: 100%;
	}
	.add summary {
		cursor: pointer;
		font-weight: 600;
		color: var(--ocean);
		min-height: 44px;
		display: flex;
		align-items: center;
	}
	.add summary.danger {
		color: var(--danger-700);
	}
</style>
