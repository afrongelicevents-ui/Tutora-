<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay, fmtDayTime, fmtTime, localDate } from '#lib/tz.ts';
	import { formatMoney } from '#lib/money.ts';
	import { waLink } from '#lib/whatsapp.ts';
	let { data, form } = $props();
	const l = $derived(data.lesson);
	const cancelled = $derived(l.status === 'cancelled' || l.attendeeStatus === 'cancelled');
	const statusWord = $derived(
		cancelled
			? m.status_cancelled()
			: l.attendance === 'absent'
				? m.att_absent()
				: l.past
					? m.status_done()
					: m.status_confirmed()
	);
	const day = $derived(
		localDate(l.startsAt) === localDate(new Date()) ? m.sh_today() : fmtDay(l.startsAt)
	);
	const pay = $derived(
		{
			free: m.pay_free(),
			package: m.pay_package(),
			paid: m.pay_paid(),
			reported: m.pay_reported(),
			due: m.pay_due()
		}[l.payState]
	);
	const source = (k: string) =>
		k === 'drive' ? 'Google Drive' : k === 'kahoot' ? 'Kahoot!' : k === 'file' ? m.ld3_file() : m.ld3_link();
	const provider = $derived(
		data.meeting?.provider === 'meet' ? 'Google Meet' : data.meeting?.provider === 'teams' ? 'Microsoft Teams' : null
	);
</script>

<svelte:head><title>{l.subjectName ?? m.intro_chat()} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/student/lessons" aria-label={m.v3_back()}>←</a>
	<span class="eyebrow status" class:off={cancelled}
		>{statusWord} · {day} {fmtTime(l.startsAt)} · {l.mode === 'online' ? m.find3_online() : m.sh_in_person()}</span
	>
	<h1>
		{l.kind === 'intro' ? m.sh_intro_with({ tutor: l.tutorName ?? '' }) : m.sh_lesson_with({ subject: l.subjectName ?? '', tutor: l.tutorName ?? '' })}
	</h1>
	{#if data.topic}<span class="lead"
			>{data.topic.year
				? m.ld3_topic_year({ topic: data.topic.topic, year: data.topic.year })
				: m.ld3_topic({ topic: data.topic.topic })}</span
		>{/if}
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if form?.cancelled}<p class="notice" role="status">{m.ld3_cancelled()}</p>{/if}

	{#if l.live && !l.past}
		{#if l.mode === 'online'}
			<div class="plumcard">
				<span class="eyebrow">{m.ld3_how_join()}</span>
				{#if data.meeting}
					<strong>{m.ld3_link_by({ tool: provider ?? '', name: l.tutorName ?? '' })}</strong>
					<a class="btn" href={data.meeting.joinUrl} target="_blank" rel="noopener noreferrer"
						>{data.meeting.provider === 'meet' ? m.ld3_join_meet() : m.ld3_join_teams()}</a
					>
					{#if l.roomOpen}<a class="btn btn-ghost" href="/room/{l.id}">{m.ld3_use_room()}</a>{:else}<span
							class="sub small">{m.ld3_room_fallback()}</span
						>{/if}
				{:else}
					<strong>{m.ld3_room_title()}</strong>
					<span class="sub small">{m.ld3_room_lead()}</span>
					{#if l.roomOpen}<a class="btn" href="/room/{l.id}">{m.room_join()}</a>{:else}<span class="sub small"
							>{m.room_opens_10()}</span
						>{/if}
				{/if}
			</div>
		{:else}
			<div class="plumcard">
				<span class="eyebrow">{m.ld3_where()}</span>
				<strong>{l.address ?? l.town ?? m.ld3_address_ask()}</strong>
				<span class="sub small">{fmtDayTime(l.startsAt)} · {m.tp3_minutes({ n: l.minutes })}</span>
			</div>
		{/if}
	{/if}

	<section>
		<div class="section-h"><h2>{m.ld3_materials()}</h2></div>
		<div class="rows">
			{#each data.materials as mat (mat.id)}
				{#if mat.url}
					<a href={mat.url} target="_blank" rel="noopener noreferrer"
						><span>{mat.title}</span><span class="muted small">{source(mat.kind)}</span></a
					>
				{:else}
					<div><span>{mat.title}</span><span class="muted small">{source(mat.kind)}</span></div>
				{/if}
			{/each}
			<div>
				<span>{m.ld3_notes()}</span>
				<span class="muted small">{data.note ? '' : l.past ? m.ld3_no_notes() : m.ld3_after({ time: fmtTime(l.endsAt) })}</span>
			</div>
		</div>
		{#if data.note}<p class="prewrap notes">{data.note}</p>{/if}
		{#if !data.materials.length}<p class="note">{m.ld3_no_materials()}</p>{/if}
	</section>

	<div class="rows top">
		<div><span class="muted">{m.ld_price()}</span><strong>{l.priceCents ? formatMoney(l.priceCents, l.currency) : m.pay_free()}</strong></div>
		<div><span class="muted">{m.ld_payment()}</span><strong>{pay}</strong></div>
	</div>
	{#if l.payState === 'due'}<a class="btn btn-ghost btn-block" href="/student/payments?tutor={l.tutorSlug}">{m.ld_pay()}</a>{/if}

	{#if l.live && !l.past}
		<a class="btn btn-ghost btn-block" href="/lessons/{l.id}/ics">{m.add_to_calendar()}</a>
		<details class="change">
			<summary class="btn btn-ghost btn-block">{m.ld3_change()}</summary>
			<div class="stack">
				{#if l.canCancel}
					<p class="small">{m.ld_reschedule({ hours: l.cancelHours })}</p>
					<form method="POST" action="?/cancel">
						<button class="btn btn-warn btn-block" type="submit">{m.ld3_cancel_lesson()}</button>
					</form>
					<a class="btn btn-ghost btn-block" href="/student/book?tutor={l.tutorSlug}">{m.ld_book_other()}</a>
				{:else}
					<p class="small">
						{m.cancel_too_late({ hours: l.cancelHours })}{#if l.whatsapp}&nbsp;<a
								href={waLink(l.whatsapp, m.wa_lesson_change({ when: fmtDayTime(l.startsAt) }))}
								target="_blank"
								rel="noopener noreferrer">WhatsApp</a
							>{/if}
					</p>
				{/if}
			</div>
		</details>
	{/if}
</div>

<style>
	.status {
		color: var(--ok);
	}
	.status.off {
		color: var(--danger-700);
	}
	h1 {
		margin: 0;
		font-size: 1.75rem;
	}
	.rows a {
		text-decoration: none;
	}
	.notes {
		margin: 8px 0 0;
		font-size: 0.9375rem;
	}
	.change summary {
		list-style: none;
		display: flex;
	}
	.change summary::-webkit-details-marker {
		display: none;
	}
	.change .stack {
		padding-top: 12px;
	}
</style>
