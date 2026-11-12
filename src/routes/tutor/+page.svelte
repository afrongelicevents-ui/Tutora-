<script lang="ts">
	import { shortName } from '#lib/names.ts';
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay, fmtDayTime, fmtTime, localDate, minutesToHHMM, local } from '#lib/tz.ts';
	import { formatMoney } from '#lib/money.ts';
	import { waLink } from '#lib/whatsapp.ts';
	import BriefLine from '#lib/components/tutor/BriefLine.svelte';
	import { methodLabel, toolLabel } from '#lib/components/tutor/labels.ts';
	let { data, form } = $props();

	const first = (n: string) => shortName(n) || n;
	const accepted = $derived.by(() => {
		if (form?.done !== 'accepted' || !('student' in form)) return null;
		const f = form as { student?: string; family?: number; meeting?: string | null };
		const name = String(f.student || m.tut3_the_student());
		const fam = Number(f.family) > 0;
		const tool = f.meeting ? toolLabel(String(f.meeting)) : null;
		if (tool)
			return fam
				? m.tut3_accepted_link_family({ tool, name })
				: m.tut3_accepted_link_one({ tool, name });
		return fam ? m.tut3_accepted_family({ name }) : m.tut3_accepted_one({ name });
	});
	const doneText = $derived.by(() => {
		if (!form?.done || form.done === 'accepted') return null;
		if (form.done === 'submitted') return m.tdone_submitted();
		if (form.done === 'attendance') return m.tut3_done_attendance();
		return `${t(`done_${form.done}`)}${'receipt' in form && form.receipt ? ` ${form.receipt}` : ''}`;
	});
	const now = $derived(new Date(data.now));
</script>

<svelte:head><title>{m.today_title()} · Tutora</title></svelte:head>

<section class="screen">
	<h1 class="hello">{m.tut3_welcome({ name: data.name })}</h1>

	<div class="stat3">
		<div><strong>{data.stats.students}</strong><span>{m.tut3_stat_students()}</span></div>
		<div><strong>{data.stats.week}</strong><span>{m.tut3_stat_week()}</span></div>
		<div>
			<strong>{formatMoney(data.stats.monthCents, data.currency).replace(/\.00$/, '')}</strong><span
				>{m.tut3_stat_month()}</span
			>
		</div>
	</div>

	{#if accepted}<p class="ok-box" role="status">{accepted}</p>{/if}
	{#if doneText}<p class="notice" role="status">{doneText}</p>{/if}
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}

	{#if data.missing.length}
		<a class="softcard setup" href="/tutor/setup/1">
			<strong>{m.today_setup_title()}</strong>
			<span class="note">{m.today_setup_lead({ n: data.missing.length })}</span>
		</a>
	{/if}

	{#each data.requests as r (r.id)}
		<article class="request">
			<span class="eyebrow">{r.kind === 'intro' ? m.tut3_new_intro() : m.tut3_new_request()}</span>
			<strong class="who"
				>{r.studentName}{r.childName ? ` (${r.childName})` : ''} · {r.kind === 'intro'
					? m.intro_chat()
					: r.subjectName} · {fmtDayTime(r.startsAt)}</strong
			>
			<span class="note"
				>{r.mode === 'online' ? m.mode_online() : m.mode_in_person()}{r.joinLessonId
					? ` · ${m.joins_group()}`
					: ''}</span
			>
			<BriefLine brief={data.briefs[r.id] ?? null} />
			{#if r.note}<p class="quote small">“{r.note}”</p>{/if}
			<div class="two">
				<form method="POST" action="?/accept">
					<input type="hidden" name="id" value={r.id} />
					<button class="btn btn-block" type="submit">{m.accept()}</button>
				</form>
				<form method="POST" action="?/decline">
					<input type="hidden" name="id" value={r.id} />
					<button class="btn btn-ghost btn-block" type="submit">{m.decline()}</button>
				</form>
			</div>
			{#if !r.joinLessonId}
				<details class="more">
					<summary>{m.propose_other()}</summary>
					<form method="POST" action="?/propose" class="stack">
						<input type="hidden" name="id" value={r.id} />
						<div class="row">
							<div class="field grow">
								<label for="pd-{r.id}">{m.date()}</label><input
									id="pd-{r.id}"
									name="date"
									type="date"
									value={localDate(r.startsAt)}
									required
								/>
							</div>
							<div class="field grow">
								<label for="pt-{r.id}">{m.time()}</label><input
									id="pt-{r.id}"
									name="time"
									type="time"
									step="900"
									value={minutesToHHMM(local(r.startsAt).minutes)}
									required
								/>
							</div>
						</div>
						<div class="field">
							<label for="pm-{r.id}">{m.message_optional()}</label><input
								id="pm-{r.id}"
								name="message"
								type="text"
								maxlength="300"
							/>
						</div>
						<button class="btn btn-ghost btn-sm" type="submit">{m.send_suggestion()}</button>
					</form>
				</details>
			{/if}
		</article>
	{/each}

	<div class="section-h">
		<h2>{m.today_word()}</h2>
		<a href="/tutor/calendar">{m.tut3_see_schedule()}</a>
	</div>
	<ul class="rows">
		{#each data.lessons as l (l.id)}
			{@const ended = new Date(l.endsAt) < now}
			{@const started = new Date(l.startsAt) <= now}
			<li class="lesson">
				<div class="line">
					<a class="what" href="/tutor/lessons/{l.id}"
						>{fmtTime(l.startsAt)} · {l.people.map((p) => first(p.name)).join(', ') ||
							m.tut3_nobody()} · {l.subjectName ?? m.intro_chat()}</a
					>
					{#if l.mode === 'online' && !ended}
						{#if l.meeting}
							<a class="next-t" href={l.meeting.joinUrl} target="_blank" rel="noopener noreferrer"
								>{m.tut3_join_on({ tool: toolLabel(l.meeting.provider) })}</a
							>
						{:else}
							<a class="next-t" href="/room/{l.id}">{m.tut3_join()}</a>
						{/if}
					{:else if !started}
						<span class="note">{m.tut3_later()}</span>
					{/if}
				</div>
				<span class="note"
					>{l.mode === 'online'
						? m.mode_online()
						: `${m.mode_in_person()}${l.address ? ` · ${l.address}` : ''}`}{l.people.length > 1
						? ` · ${m.group()}`
						: ''}{#if l.mode === 'online' && l.meeting && !ended}
						· <a href="/room/{l.id}">{m.tut3_room_fallback()}</a>{/if}</span
				>
				{#if started}
					{#each l.people.filter((p) => p.attendeeId) as p (p.userId)}
						<div class="att">
							<span class="note grow"
								>{first(p.name)}: {p.attendance === 'completed'
									? m.status_done()
									: p.attendance === 'absent'
										? m.att_absent()
										: m.att_not_marked()}</span
							>
							{#if p.attendance !== 'completed'}
								<form method="POST" action="?/attendance">
									<input type="hidden" name="attendeeId" value={p.attendeeId} />
									<input type="hidden" name="value" value="completed" />
									<button class="linkbtn" type="submit">{m.att_mark_done()}</button>
								</form>
							{/if}
							{#if p.attendance !== 'absent'}
								<form method="POST" action="?/attendance">
									<input type="hidden" name="attendeeId" value={p.attendeeId} />
									<input type="hidden" name="value" value="absent" />
									<button class="linkbtn" type="submit">{m.att_mark_absent()}</button>
								</form>
							{/if}
						</div>
					{/each}
				{:else}
					{#each l.people.filter((p) => p.phone) as p (p.userId)}
						<a
							class="note wa"
							target="_blank"
							rel="noopener noreferrer"
							href={waLink(
								p.phone!,
								m.wa_reminder_text({
									subject: l.subjectName ?? m.intro_chat(),
									time: fmtTime(l.startsAt)
								})
							)}>{m.wa_remind({ name: first(p.name) })}</a
						>
					{/each}
				{/if}
			</li>
		{:else}
			<li class="note">{m.today_no_lessons()}</li>
		{/each}
	</ul>

	{#if data.toCheck}
		<a class="rows-link line-link" href="/tutor/homework"
			><span>{m.today_hw_check({ n: data.toCheck })}</span><span class="go" aria-hidden="true"
				>›</span
			></a
		>
	{/if}

	{#if data.payments.length}
		<div class="section-h"><h2>{m.today_payments_h()}</h2></div>
		<ul class="rows">
			{#each data.payments as p (p.id)}
				<li class="pay">
					<div class="line">
						<span
							>{p.studentName} · {methodLabel(p.method)}{p.reference
								? ` · ${m.ref()} ${p.reference}`
								: ''}</span
						>
						<strong>{formatMoney(p.amountCents, p.currency)}</strong>
					</div>
					<span class="note"
						>{fmtDay(new Date(p.paidOn + 'T12:00:00Z'))}{#if p.proofUrl}&nbsp;· <a
								href={p.proofUrl}
								target="_blank"
								rel="noopener">{m.see_proof()}</a
							>{:else if p.method === 'cash'}&nbsp;· {m.student_says_cash()}{/if}</span
					>
					<div class="att">
						<form method="POST" action="?/confirmPayment">
							<input type="hidden" name="id" value={p.id} />
							<button class="btn btn-sm" type="submit">{m.confirm()}</button>
						</form>
						<details class="more grow">
							<summary>{m.reject()}</summary>
							<form method="POST" action="?/rejectPayment" class="stack">
								<input type="hidden" name="id" value={p.id} />
								<div class="field">
									<label for="rr-{p.id}">{m.reject_reason()}</label><input
										id="rr-{p.id}"
										name="reason"
										type="text"
										maxlength="300"
									/>
								</div>
								<button class="btn btn-warn btn-sm" type="submit">{m.reject_confirm()}</button>
							</form>
						</details>
					</div>
				</li>
			{/each}
		</ul>
	{/if}

	{#if data.activity.length}
		<div class="section-h">
			<h2>{m.today_activity()}</h2>
			<a href="/notifications">{m.notif_title()}</a>
		</div>
		<ul class="rows">
			{#each data.activity as a (a.id)}<li>
					<span>{a.title}</span><span class="note">{fmtDay(new Date(a.createdAt))}</span>
				</li>{/each}
		</ul>
	{/if}
</section>

<style>
	.hello {
		margin: 0;
		font-size: 1.75rem;
	}
	.ok-box {
		margin: 0;
		background: var(--ok-bg);
		color: #1f5a3a;
		border-radius: 18px;
		padding: 14px 16px;
		font-size: 0.9375rem;
	}
	.setup {
		text-decoration: none;
		color: var(--text);
	}
	.request {
		display: flex;
		flex-direction: column;
		gap: 8px;
		background: var(--white);
		border: 1.5px solid var(--navy);
		border-radius: 18px;
		padding: 16px;
	}
	.request .who {
		font-size: 1rem;
	}
	.request .quote {
		margin: 0;
	}
	.two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.more summary {
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--ocean);
		padding: 8px 0;
	}
	.rows > li.lesson,
	.rows > li.pay {
		flex-direction: column;
		align-items: stretch;
		gap: 4px;
	}
	.line {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
	}
	.what {
		color: var(--text);
		text-decoration: none;
	}
	.what:hover {
		color: var(--navy);
	}
	.next-t,
	.wa {
		text-decoration: none;
	}
	.att {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 14px;
	}
	.linkbtn {
		background: none;
		border: none;
		padding: 10px 0;
		font: inherit;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--ocean);
		cursor: pointer;
	}
	.line-link {
		display: flex;
		justify-content: space-between;
		padding: 13px 0;
		border-top: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
		color: var(--text);
		text-decoration: none;
	}
</style>
