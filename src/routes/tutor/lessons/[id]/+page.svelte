<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDayTime, fmtTime } from '#lib/tz.ts';
	let { data, form } = $props();
	const l = $derived(data.lesson);
</script>

<svelte:head><title>{m.lesson_title()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<a class="btn btn-secondary btn-sm" href="/tutor/calendar">← {m.cal_title()}</a>
	<h1 style="margin-top:12px">{l.subjectName ?? m.intro_chat()}</h1>
	<p class="muted">
		{fmtDayTime(l.startsAt)}–{fmtTime(l.endsAt)} · {l.mode === 'online'
			? m.mode_online()
			: m.mode_in_person()}{l.status === 'cancelled' ? ` · ${m.cancelled()}` : ''}
	</p>
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if form?.saved}<p class="notice" role="status">{m.saved()}</p>{/if}

	{#if l.status === 'scheduled'}
		<div class="row">
			{#if l.mode === 'online'}<a class="btn" href="/room/{l.id}">{m.room_start()}</a>{/if}
			<a class="btn btn-secondary" href="/lessons/{l.id}/ics">{m.add_to_calendar()}</a>
		</div>
	{/if}

	<h2 style="margin-top:16px">{m.lesson_people({ n: l.people.length, cap: l.capacity })}</h2>
	{#each l.people as p (p.attendeeId)}
		<div class="card">
			<a href="/tutor/students/{p.userId}"><b>{p.name}</b></a>
			<form method="POST" action="?/note" class="stack" style="margin-top:8px">
				<input type="hidden" name="attendeeId" value={p.attendeeId} />
				<label class="small" for="note-{p.attendeeId}">{m.private_note()}</label>
				<textarea
					id="note-{p.attendeeId}"
					name="note"
					maxlength="2000"
					rows="3"
					placeholder={m.private_note_hint()}
					defaultValue={p.note ?? ''}></textarea>
				<button class="btn btn-secondary btn-sm" type="submit">{m.save_note()}</button>
			</form>
		</div>
	{/each}

	{#if l.status === 'scheduled'}
		<details class="card" style="margin-top:16px">
			<summary class="danger">{m.cancel_lesson()}</summary>
			<form method="POST" action="?/cancel" class="stack" style="margin-top:10px">
				<p class="small">{m.cancel_lesson_lead()}</p>
				<label class="check"
					><input type="checkbox" name="sure" /> <span>{m.cancel_lesson_sure()}</span></label
				>
				<button class="btn btn-warn" type="submit">{m.cancel_lesson()}</button>
			</form>
		</details>
	{/if}
</section>
