<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import {
		fmtDate,
		fmtDay,
		fmtDayTime,
		fmtTime,
		localDate,
		minutesToHHMM,
		local
	} from '#lib/tz.ts';
	import { formatMoney } from '#lib/money.ts';
	import { waLink } from '#lib/whatsapp.ts';
	let { data, form } = $props();
	const method = (k: string) =>
		({
			bank: m.method_bank(),
			ecocash: 'EcoCash',
			innbucks: 'InnBucks',
			cash: m.method_cash(),
			other: m.method_other()
		})[k] ?? k;
</script>

<svelte:head><title>{m.today_title()} · Tutora</title></svelte:head>

<section class="wrap">
	<h1>{m.today_title()}</h1>
	<p class="muted">{fmtDate(data.now)}</p>

	{#if form?.done}<p class="notice" role="status">
			{t(`done_${form.done}`)}{form.receipt ? ` ${form.receipt}` : ''}
		</p>{/if}
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}

	{#if data.missing.length}
		<a class="panel setup-banner" href="/tutor/setup/1">
			<b>{m.today_setup_title()}</b>
			<span class="small">{m.today_setup_lead({ n: data.missing.length })}</span>
		</a>
	{/if}

	<div class="money3">
		<div><b>{data.lessons.length}</b><span>{m.today_lessons()}</span></div>
		<div><b>{data.requests.length}</b><span>{m.today_to_answer()}</span></div>
		<div><b>{data.payments.length}</b><span>{m.today_to_confirm()}</span></div>
	</div>

	<h2>{m.today_lessons_h()}</h2>
	{#each data.lessons as l (l.id)}
		<div class="card">
			<div class="row">
				<b class="grow"
					>{fmtTime(l.startsAt)} · {l.subjectName ?? m.intro_chat()}{l.people.length > 1
						? ` (${m.group()})`
						: ''}</b
				>
				<span class="pill {l.mode === 'online' ? 'p-ok' : 'p-wait'}"
					>{l.mode === 'online' ? m.mode_online() : m.mode_in_person()}</span
				>
			</div>
			<p class="small muted">{l.people.map((p) => p.name).join(', ')}</p>
			<div class="row">
				{#if l.mode === 'online'}<a class="btn btn-sm" href="/room/{l.id}">{m.room_start()}</a>{/if}
				<a class="btn btn-secondary btn-sm" href="/tutor/lessons/{l.id}">{m.details()}</a>
				{#each l.people.filter((p) => p.phone) as p (p.userId)}
					<a
						class="btn btn-secondary btn-sm"
						target="_blank"
						rel="noopener noreferrer"
						href={waLink(
							p.phone!,
							m.wa_reminder_text({
								subject: l.subjectName ?? m.intro_chat(),
								time: fmtTime(l.startsAt)
							})
						)}>{m.wa_remind({ name: p.name.split(' ')[0] })}</a
					>
				{/each}
			</div>
		</div>
	{:else}
		<p class="empty">{m.today_no_lessons()}</p>
	{/each}

	<h2>{m.today_requests_h()}</h2>
	{#each data.requests as r (r.id)}
		<div class="card">
			<b>{r.studentName}</b> · {r.kind === 'intro' ? m.intro_chat() : r.subjectName}
			<p class="small muted">
				{fmtDayTime(r.startsAt)} · {r.mode === 'online'
					? m.mode_online()
					: m.mode_in_person()}{r.joinLessonId ? ` · ${m.joins_group()}` : ''}
			</p>
			{#if r.note}<p class="small quote">“{r.note}”</p>{/if}
			<div class="row">
				<form method="POST" action="?/accept">
					<input type="hidden" name="id" value={r.id} /><button class="btn btn-sm" type="submit"
						>{m.accept()}</button
					>
				</form>
				<form method="POST" action="?/decline">
					<input type="hidden" name="id" value={r.id} /><button
						class="btn btn-warn btn-sm"
						type="submit">{m.decline()}</button
					>
				</form>
			</div>
			{#if !r.joinLessonId}
				<details class="propose">
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
						<button class="btn btn-secondary btn-sm" type="submit">{m.send_suggestion()}</button>
					</form>
				</details>
			{/if}
		</div>
	{:else}
		<p class="empty">{m.today_no_requests()}</p>
	{/each}

	<h2>{m.today_payments_h()}</h2>
	{#each data.payments as p (p.id)}
		<div class="card">
			<div class="row">
				<b class="grow">{p.studentName}</b><b>{formatMoney(p.amountCents, p.currency)}</b>
			</div>
			<p class="small muted">
				{method(p.method)}{p.reference ? ` · ${m.ref()} ${p.reference}` : ''} · {fmtDay(
					new Date(p.paidOn + 'T12:00:00Z')
				)}
			</p>
			{#if p.proofUrl}<p>
					<a class="btn btn-secondary btn-sm" href={p.proofUrl} target="_blank" rel="noopener"
						>{m.see_proof()}</a
					>
				</p>{:else if p.method === 'cash'}<p class="small">{m.student_says_cash()}</p>{/if}
			<div class="row">
				<form method="POST" action="?/confirmPayment">
					<input type="hidden" name="id" value={p.id} /><button class="btn btn-sm" type="submit"
						>{m.confirm()}</button
					>
				</form>
			</div>
			<details class="propose">
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
	{:else}
		<p class="empty">{m.today_no_payments()}</p>
	{/each}
</section>
