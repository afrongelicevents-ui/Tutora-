<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay, fmtDate } from '#lib/tz.ts';
	import { formatMoney } from '#lib/money.ts';
	import { waLink } from '#lib/whatsapp.ts';
	import { shrink } from '#lib/shrink.ts';
	let { data, form } = $props();
	const s = $derived(data.student);
	const money = (c: number) => formatMoney(c, data.currency);
</script>

<svelte:head><title>{s.name} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<a class="btn btn-secondary btn-sm" href="/tutor/students">← {m.students_title()}</a>
	<h1 style="margin-top:12px">{s.name}</h1>
	{#if s.childName}<p class="muted">{m.for_child({ name: s.childName })}</p>{/if}
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if form?.saved}<p class="notice" role="status">
			{m.saved()}{form.receipt ? ` ${form.receipt}` : ''}
		</p>{/if}

	<div class="card">
		<dl class="kv">
			<dt>{m.field_email()}</dt>
			<dd>{s.email}</dd>
			{#if s.phone}<dt>{m.phone()}</dt>
				<dd>{s.phone}</dd>{/if}
			{#if s.isUnder18}
				<dt>{m.parent()}</dt>
				<dd>{s.parentName} · {s.parentPhone}{s.parentEmail ? ` · ${s.parentEmail}` : ''}</dd>
			{/if}
			<dt>{m.account_role()}</dt>
			<dd>
				{s.role === 'parent'
					? m.role_parent()
					: s.isUnder18
						? m.role_student_minor()
						: m.role_student()}
			</dd>
		</dl>
		<div class="row" style="margin-top:10px">
			{#if s.phone}<a
					class="btn btn-sm"
					href={waLink(s.phone)}
					target="_blank"
					rel="noopener noreferrer">WhatsApp</a
				>{/if}
			{#if s.isUnder18 && s.parentPhone}<a
					class="btn btn-secondary btn-sm"
					href={waLink(s.parentPhone)}
					target="_blank"
					rel="noopener noreferrer">{m.wa_parent()}</a
				>{/if}
		</div>
		<form method="POST" action="?/level" class="row" style="margin-top:10px">
			<label class="sr-only" for="lvl">{m.level()}</label>
			<input
				id="lvl"
				name="level"
				class="grow input"
				value={s.level ?? ''}
				placeholder={m.level_hint()}
				maxlength="60"
			/>
			<button class="btn btn-secondary btn-sm" type="submit">{m.save()}</button>
		</form>
	</div>

	<div class="money3">
		<div><b>{money(data.balance.paid)}</b><span>{m.paid()}</span></div>
		<div><b>{money(data.balance.waiting)}</b><span>{m.waiting()}</span></div>
		<div>
			<b class:owe={data.balance.owed > 0}>{money(data.balance.owed)}</b><span>{m.owed()}</span>
		</div>
	</div>
	{#if data.balance.credit > 0}<p class="small">
			{m.credit({ amount: money(data.balance.credit) })}
		</p>{/if}
	{#each data.packages as p (p.id)}
		<p class="small">
			{m.package_left({
				name: p.name,
				left: p.lessonsTotal - p.lessonsUsed,
				total: p.lessonsTotal
			})}
		</p>
	{/each}

	<details class="card">
		<summary class="h3">{m.record_cash()}</summary>
		<form method="POST" action="?/cash" class="stack" style="margin-top:10px" novalidate>
			<div class="field">
				<label for="ca">{m.amount({ currency: data.currency === 'ZWG' ? 'ZiG' : 'USD' })}</label
				><input id="ca" name="amount" inputmode="decimal" required />
			</div>
			<div class="field">
				<label for="cd">{m.date()}</label><input
					id="cd"
					name="date"
					type="date"
					value={data.today}
				/>
			</div>
			<button class="btn" type="submit">{m.record_cash_btn()}</button>
		</form>
	</details>

	<h2>{m.payments_h()}</h2>
	<ul class="list card">
		{#each data.payments as p (p.id)}
			<li>
				<span>{money(p.amountCents)} · {fmtDay(p.createdAt)}</span>
				{#if p.receipt}<a href="/tutor/payments/{p.id}/receipt">{p.receipt}</a>{:else}<span
						class="pill {p.status === 'rejected' ? 'p-no' : 'p-wait'}"
						>{p.status === 'rejected' ? m.status_rejected() : m.status_waiting()}</span
					>{/if}
			</li>
		{:else}
			<li class="muted small">{m.none_yet()}</li>
		{/each}
	</ul>

	<h2>{m.lessons_notes_h()}</h2>
	{#each data.lessons as l (l.attendeeId)}
		<div class="card">
			<div class="row">
				<b class="grow">{fmtDay(l.startsAt)} · {l.subjectName ?? m.intro_chat()}</b>
				{#if l.attendeeStatus === 'cancelled' || l.lessonStatus === 'cancelled'}<span
						class="pill p-no">{m.cancelled()}</span
					>{:else if l.startsAt < new Date()}<span class="pill p-info">{m.done()}</span>{:else}<span
						class="pill p-ok">{m.booked()}</span
					>{/if}
			</div>
			<form method="POST" action="?/note" class="stack" style="margin-top:6px">
				<input type="hidden" name="attendeeId" value={l.attendeeId} />
				<label class="sr-only" for="n-{l.attendeeId}">{m.private_note()}</label>
				<textarea
					id="n-{l.attendeeId}"
					name="note"
					rows="2"
					maxlength="2000"
					placeholder={m.private_note_hint()}>{l.note ?? ''}</textarea
				>
				<button class="btn btn-secondary btn-sm" type="submit">{m.save_note()}</button>
			</form>
		</div>
	{:else}
		<p class="empty">{m.none_yet()}</p>
	{/each}

	<h2>{m.homework_h()}</h2>
	{#each data.homework as h (h.id)}
		<div class="card">
			<b>{h.title}</b>{#if h.dueOn}<span class="small muted">
					· {m.due({ date: fmtDate(new Date(h.dueOn + 'T12:00:00Z')) })}</span
				>{/if}
			{#if h.note}<p class="small">{h.note}</p>{/if}
			{#if h.fileUrl}<a class="small" href={h.fileUrl} target="_blank" rel="noopener"
					>{h.fileName}</a
				>{/if}
			{#each h.answers as a (a.id)}
				<div class="panel small" style="margin-top:8px">
					<b>{m.answer_from({ date: fmtDay(a.createdAt) })}</b>
					{#if a.note}<p>{a.note}</p>{/if}
					{#if a.fileUrl}<a href={a.fileUrl} target="_blank" rel="noopener">{a.fileName}</a>{/if}
					<form method="POST" action="?/feedback" class="stack" style="margin-top:6px">
						<input type="hidden" name="answerId" value={a.id} />
						<label class="sr-only" for="fb-{a.id}">{m.feedback()}</label>
						<textarea
							id="fb-{a.id}"
							name="feedback"
							rows="2"
							maxlength="1000"
							placeholder={m.feedback()}>{a.feedback ?? ''}</textarea
						>
						<button class="btn btn-secondary btn-sm" type="submit">{m.send_feedback()}</button>
					</form>
				</div>
			{/each}
		</div>
	{/each}
	<form
		method="POST"
		action="?/homework"
		enctype="multipart/form-data"
		class="card stack"
		novalidate
	>
		<h3>{m.give_homework()}</h3>
		<div class="field">
			<label for="hw-t">{m.title()}</label><input id="hw-t" name="title" maxlength="120" required />
		</div>
		<div class="field">
			<label for="hw-n">{m.instructions()}</label><textarea
				id="hw-n"
				name="note"
				rows="3"
				maxlength="2000"></textarea>
		</div>
		<div class="field">
			<label for="hw-d">{m.due_date_optional()}</label><input id="hw-d" name="dueOn" type="date" />
		</div>
		<div class="field">
			<label for="hw-f">{m.file_optional()}</label><span class="hint">{m.file_hint_5mb()}</span
			><input
				id="hw-f"
				name="file"
				type="file"
				accept="image/jpeg,image/png,image/webp,application/pdf"
				use:shrink
			/>
		</div>
		<button class="btn btn-block" type="submit"
			>{m.send_homework({ name: s.name.split(' ')[0] })}</button
		>
	</form>
</section>
