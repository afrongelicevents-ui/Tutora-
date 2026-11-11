<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { fmtDayTime } from '#lib/tz.ts';
	import { formatMoney } from '#lib/money.ts';
	import { waLink } from '#lib/whatsapp.ts';
	let { data } = $props();
	const l = $derived(data.lesson);
	const status = $derived(
		l.status === 'cancelled' || l.attendeeStatus === 'cancelled'
			? m.status_cancelled()
			: l.attendance === 'absent'
				? m.att_absent()
				: l.past
					? m.status_done()
					: m.status_confirmed()
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
</script>

<svelte:head><title>{l.subjectName ?? m.intro_chat()} · Tutora</title></svelte:head>

<section class="wrap narrow stack">
	<h1>{l.kind === 'intro' ? m.intro_chat() : l.subjectName}</h1>
	{#if l.kind === 'intro'}<span class="pill p-info">{m.tag_intro()}</span>{/if}
	<dl class="kv card">
		<dt>{m.ld_tutor()}</dt>
		<dd><a href="/t/{l.tutorSlug}">{l.tutorName}</a></dd>
		{#if l.childName}<dt>{m.ld_for()}</dt>
			<dd>{l.childName}</dd>{/if}
		<dt>{m.ld_when()}</dt>
		<dd>{fmtDayTime(l.startsAt)} · {m.ld_minutes({ n: l.minutes })}</dd>
		<dt>{m.ld_where()}</dt>
		<dd>
			{l.mode === 'online'
				? m.online_room()
				: `${m.mode_in_person()}${l.town ? ` · ${l.town}` : ''}`}
		</dd>
		<dt>{m.ld_price()}</dt>
		<dd>{l.priceCents ? formatMoney(l.priceCents, l.currency) : m.pay_free()}</dd>
		<dt>{m.ld_status()}</dt>
		<dd>{status}</dd>
		<dt>{m.ld_payment()}</dt>
		<dd>{pay}</dd>
	</dl>
	{#if l.roomOpen}<a class="btn btn-block" href="/room/{l.id}">{m.room_join()}</a
		>{:else if l.mode === 'online' && !l.past && l.status === 'scheduled'}<p class="small muted">
			{m.room_opens_10()}
		</p>{/if}
	{#if l.payState === 'due'}<a
			class="btn btn-secondary btn-block"
			href="/student/payments?tutor={l.tutorSlug}">{m.ld_pay()}</a
		>{/if}
	{#if !l.past && l.status === 'scheduled' && l.attendeeStatus === 'booked'}
		<a class="btn btn-secondary btn-block" href="/lessons/{l.id}/ics">{m.add_to_calendar()}</a>
		{#if l.canCancel}
			<form method="POST" action="/student?/cancel" class="stack">
				<input type="hidden" name="id" value={l.id} />
				<button class="btn btn-warn btn-block" type="submit">{m.cancel()}</button>
			</form>
			<p class="small muted">{m.ld_reschedule({ hours: l.cancelHours })}</p>
			<a class="btn-link" href="/student/book?tutor={l.tutorSlug}">{m.ld_book_other()}</a>
		{:else}
			<p class="small muted">
				{m.cancel_too_late({ hours: l.cancelHours })}{#if l.whatsapp}&nbsp;
					<a
						href={waLink(l.whatsapp, m.wa_lesson_change({ when: fmtDayTime(l.startsAt) }))}
						target="_blank"
						rel="noopener noreferrer">WhatsApp</a
					>{/if}
			</p>
		{/if}
	{/if}
	<a href="/student">{m.back()}</a>
</section>
