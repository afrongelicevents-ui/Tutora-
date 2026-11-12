<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { formatMoney } from '#lib/money.ts';
	import { fmtDay, fmtMonth, fromLocal } from '#lib/tz.ts';
	import { methodLabel } from '#lib/components/tutor/labels.ts';
	let { data, form } = $props();
	const money = (c: number) => formatMoney(c, data.currency);
	const month = $derived(
		data.months.find((x) => x.month === data.thisMonth && x.currency === data.currency)
	);
	const monthName = $derived(fmtMonth(fromLocal(data.thisMonth + '-15', 600)).split(' ')[0]);
</script>

<svelte:head><title>{m.v3_nav_earnings()} · Tutora</title></svelte:head>

<section class="screen">
	<h1>{m.v3_nav_earnings()}</h1>
	{#if form?.done}<p class="notice" role="status">
			{t(`done_${form.done}`)}{'receipt' in form && form.receipt ? ` ${form.receipt}` : ''}
		</p>{/if}
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}

	<div class="big">
		<span class="bignum">{money(month?.total ?? 0).replace(/\.00$/, '')}</span>
		<span class="note">{m.tut3_month_confirmed({ month: monthName, n: month?.count ?? 0 })}</span>
	</div>
	<p class="note">
		{m.tut3_waiting_owed({ waiting: money(data.totals.waiting), owed: money(data.totals.owed) })}
	</p>

	<ul class="rows">
		{#each data.pending as p (p.id)}
			<li class="col">
				<div class="line">
					<span>{p.studentName} · {methodLabel(p.method)}</span>
					<form method="POST" action="?/confirmPayment">
						<input type="hidden" name="id" value={p.id} />
						<button class="confirm" type="submit"
							>{m.tut3_confirm_amount({ amount: money(p.amountCents) })}</button
						>
					</form>
				</div>
				<span class="note"
					>{fmtDay(new Date(p.paidOn + 'T12:00:00Z'))}{p.reference
						? ` · ${m.ref()} ${p.reference}`
						: ''}{#if p.proofUrl}&nbsp;· <a href={p.proofUrl} target="_blank" rel="noopener"
							>{m.see_proof()}</a
						>{:else if p.method === 'cash'}&nbsp;· {m.student_says_cash()}{/if}</span
				>
				<details class="rej">
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
			</li>
		{/each}
		{#each data.recent as p (p.id)}
			<li>
				<span
					>{p.studentName} · {methodLabel(p.method)}<span class="note block"
						>{fmtDay(new Date(p.decidedAt ?? p.createdAt))}{p.status === 'rejected' &&
						p.rejectReason
							? ` · ${p.rejectReason}`
							: ''}</span
					></span
				>
				{#if p.status === 'confirmed'}
					<a class="ok-t paid" href="/tutor/payments/{p.id}/receipt" title={p.receipt ?? ''}
						>{m.tut3_paid_amount({ amount: formatMoney(p.amountCents, p.currency) })}</a
					>
				{:else}
					<span class="note">{m.status_rejected()} · {formatMoney(p.amountCents, p.currency)}</span>
				{/if}
			</li>
		{/each}
		{#if !data.pending.length && !data.recent.length}
			<li class="note">{m.tut3_no_payments()}</li>
		{/if}
	</ul>

	<div class="links">
		<a class="btn btn-ghost btn-sm" href="/tutor/payments/export" download>{m.download_csv()}</a>
		<a class="btn btn-ghost btn-sm" href="/tutor/settings/prices">{m.tut3_packages_link()}</a>
	</div>
	<p class="note">{m.record_cash_where()}</p>

	<div class="section-h"><h2>{m.per_student()}</h2></div>
	<ul class="rows">
		{#each data.rows as r (r.id)}
			<li>
				<a class="who" href="/tutor/students/{r.id}"
					>{r.name}<span class="note block"
						>{m.paid()}
						{money(r.paid)}{r.waiting ? ` · ${m.waiting()} ${money(r.waiting)}` : ''}</span
					></a
				>
				{#if r.owed > 0}<span class="warn-t small">{m.owes({ amount: money(r.owed) })}</span
					>{:else}<span class="ok-t small">{m.paid_up()}</span>{/if}
			</li>
		{:else}
			<li class="note">{m.none_yet()}</li>
		{/each}
	</ul>

	<div class="section-h"><h2>{m.by_month()}</h2></div>
	<ul class="rows">
		{#each data.months as mo (mo.month + mo.currency)}
			<li>
				<span>{fmtMonth(fromLocal(mo.month + '-15', 600))}</span><span
					><strong>{formatMoney(mo.total, mo.currency)}</strong>
					<span class="note">({m.payments_count({ n: mo.count })})</span></span
				>
			</li>
		{:else}
			<li class="note">{m.none_yet()}</li>
		{/each}
	</ul>

	<div class="section-h"><h2>{m.by_year()}</h2></div>
	<ul class="rows">
		{#each data.years as y (y.year + y.currency)}
			<li>
				<span>{y.year}</span><span
					><strong>{formatMoney(y.total, y.currency)}</strong>
					<span class="note">({m.payments_count({ n: y.count })})</span></span
				>
			</li>
		{:else}
			<li class="note">{m.none_yet()}</li>
		{/each}
	</ul>
</section>

<style>
	.big {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 10px;
	}
	.rows > li.col {
		flex-direction: column;
		align-items: stretch;
		gap: 4px;
	}
	.line {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}
	.confirm {
		background: none;
		border: none;
		padding: 10px 0;
		font: inherit;
		font-weight: 700;
		color: var(--warn);
		cursor: pointer;
		min-height: 44px;
	}
	.paid {
		text-decoration: none;
		white-space: nowrap;
	}
	.rej summary {
		cursor: pointer;
		font-size: 0.8125rem;
		color: var(--muted);
		padding: 6px 0;
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.who {
		color: var(--text);
		text-decoration: none;
	}
</style>
