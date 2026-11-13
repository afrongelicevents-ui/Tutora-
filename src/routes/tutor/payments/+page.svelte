<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { formatMoney } from '#lib/money.ts';
	import { fmtDay, fmtMonth, fromLocal } from '#lib/tz.ts';
	import { methodLabel } from '#lib/components/tutor/labels.ts';
	import LineIcon from '#lib/components/LineIcon.svelte';
	let { data, form } = $props();
	const money = (c: number) => formatMoney(c, data.currency);
	const prevLabel = $derived(
		data.period === 'week'
			? m.er_prev_week()
			: data.period === 'year'
				? m.er_prev_year()
				: m.er_prev_month()
	);
	// the last six months of confirmed payments (tutor's currency)
	const trend = $derived.by(() => {
		const [y, mo] = data.thisMonth.split('-').map(Number);
		return Array.from({ length: 6 }, (_, i) => {
			const d = new Date(Date.UTC(y, mo - 1 - (5 - i), 1));
			const key = d.toISOString().slice(0, 7);
			const row = data.months.find((x) => x.month === key && x.currency === data.currency);
			return {
				key,
				total: row?.total ?? 0,
				label: new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(d)
			};
		});
	});
	const maxT = $derived(Math.max(100, ...trend.map((x) => x.total)));
	const px = (i: number) => 44 + i * 52;
	const py = (v: number) => 130 - (v / maxT) * 110;
	const line = $derived(trend.map((x, i) => `${i ? 'L' : 'M'}${px(i)},${py(x.total)}`).join(' '));
	const area = $derived(`${line} L${px(5)},130 L${px(0)},130 Z`);
</script>

<svelte:head><title>{m.v3_nav_earnings()} · Tutora</title></svelte:head>

<section class="screen">
	<h1>{m.v3_nav_earnings()}</h1>
	{#if form?.done}<p class="notice" role="status">
			{t(`done_${form.done}`)}{'receipt' in form && form.receipt ? ` ${form.receipt}` : ''}
		</p>{/if}
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}

	<nav class="period" aria-label={m.er_period()}>
		{#each [['week', m.er_week()], ['month', m.er_month()], ['year', m.er_year()]] as [k, label] (k)}
			<a href="?period={k}" aria-current={data.period === k ? 'true' : undefined}>{label}</a>
		{/each}
	</nav>

	<section class="total">
		<span class="wal"><LineIcon name="wallet" size={40} /></span>
		<div class="tb">
			<span class="tl">{m.er_total()}</span>
			<strong>{money(data.summary.total).replace(/\.00$/, '')}</strong>
			{#if data.summary.change !== null}
				<span class="chg" class:down={data.summary.change < 0}
					>{data.summary.change >= 0 ? '↑' : '↓'}
					{m.er_vs({
						pct: Math.abs(data.summary.change),
						period: prevLabel
					})}</span
				>
			{:else}
				<span class="chg muted">{m.er_confirmed_only()}</span>
			{/if}
		</div>
	</section>

	<div class="stats3">
		<div>
			<LineIcon name="calendar" size={26} /><span>{m.er_lessons()}</span><strong
				>{data.summary.lessonsDone}</strong
			>
		</div>
		<div>
			<LineIcon name="star" size={26} /><span>{m.er_avg()}</span><strong
				>{data.summary.avgPerLesson !== null ? money(data.summary.avgPerLesson) : '–'}</strong
			>
		</div>
		<div>
			<LineIcon name="clock" size={26} /><span>{m.er_pending()}</span><strong
				>{money(data.totals.waiting)}</strong
			>
		</div>
	</div>
	{#if data.totals.owed > 0}<p class="note">
			{m.er_owed({ amount: money(data.totals.owed) })}
		</p>{/if}

	<section class="trend" aria-labelledby="tr-h">
		<div class="tr-head">
			<h2 id="tr-h"><LineIcon name="progress" size={22} /> {m.er_trend()}</h2>
			<a href="/tutor/payments/export" download>{m.download_csv()}</a>
		</div>
		{#if trend.some((x) => x.total > 0)}
			<svg
				viewBox="0 0 320 160"
				role="img"
				aria-label={trend.map((x) => `${x.label}: ${money(x.total)}`).join(', ')}
			>
				{#each [0, 0.5, 1] as g (g)}
					<line x1="34" x2="312" y1={130 - g * 110} y2={130 - g * 110} class="grid" />
					<text x="30" y={134 - g * 110} text-anchor="end" class="ax"
						>{Math.round((maxT * g) / 100)}</text
					>
				{/each}
				<path d={area} class="area" />
				<path d={line} class="line" />
				{#each trend as x, i (x.key)}
					<circle cx={px(i)} cy={py(x.total)} r="4" class="pt" />
					<text x={px(i)} y="152" text-anchor="middle" class="ax">{x.label}</text>
				{/each}
			</svg>
		{:else}
			<p class="note">{m.er_trend_none()}</p>
		{/if}
	</section>

	<div class="section-h"><h2>{m.er_transactions()}</h2></div>
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

	<section class="paydet" aria-labelledby="pd-h">
		<h2 id="pd-h">{m.er_payout()}</h2>
		<p class="small">{m.er_payout_lead()}</p>
		<ul class="methods">
			{#each [['bank', data.pay.bank], ['ecocash', data.pay.ecocash], ['innbucks', data.pay.innbucks], ['cash', data.pay.cash]] as [k, on] (k)}
				<li class:on>{methodLabel(String(k))}{on ? '' : ` · ${m.er_not_set()}`}</li>
			{/each}
		</ul>
		<a class="btn btn-secondary" href="/tutor/settings/payments">{m.er_edit_payment()}</a>
	</section>

	<div class="section-h"><h2>{m.er_by_student()}</h2></div>
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
	.period {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 6px;
	}
	.period a {
		text-align: center;
		padding: 10px 4px;
		border-radius: 99px;
		background: #fff;
		border: 1px solid var(--border);
		color: var(--navy);
		font-weight: 600;
		text-decoration: none;
		font-size: 0.875rem;
	}
	.period a[aria-current='true'] {
		background: var(--navy);
		color: #fff;
		border-color: var(--navy);
	}
	.total {
		display: flex;
		align-items: center;
		gap: 16px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 24px;
		padding: 16px;
		box-shadow: var(--shadow-soft);
	}
	.wal {
		width: 76px;
		height: 76px;
		border-radius: 20px;
		background: linear-gradient(150deg, var(--ocean), var(--navy));
		color: #fff;
		display: grid;
		place-items: center;
		flex: none;
	}
	.tb {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.tl {
		font: 600 1.0625rem var(--font-display);
		color: var(--navy);
	}
	.tb strong {
		font: 600 2rem var(--font-display);
		color: var(--navy);
		line-height: 1.1;
	}
	.chg {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--ok);
	}
	.chg.down {
		color: var(--warn);
	}
	.chg.muted {
		color: var(--muted);
		font-weight: 400;
	}
	.stats3 {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
	}
	.stats3 div {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 4px;
		padding: 14px 4px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 20px;
		color: var(--ocean);
	}
	.stats3 span {
		font-size: 0.75rem;
		color: var(--text);
		line-height: 1.2;
	}
	.stats3 strong {
		font: 600 1.25rem var(--font-display);
		color: var(--navy);
	}
	.trend {
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 22px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.tr-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}
	.tr-head h2 {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 1.25rem;
		color: var(--navy);
	}
	.tr-head a {
		color: var(--ocean);
		font-weight: 600;
		font-size: 0.875rem;
	}
	.trend svg {
		width: 100%;
		height: auto;
	}
	.grid {
		stroke: var(--border);
	}
	.ax {
		font-size: 10px;
		fill: var(--muted);
	}
	.area {
		fill: rgb(26 95 174 / 0.12);
	}
	.line {
		fill: none;
		stroke: var(--ocean);
		stroke-width: 2.5;
	}
	.pt {
		fill: var(--ocean);
	}
	.paydet {
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 22px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.paydet h2 {
		margin: 0;
		font-size: 1.25rem;
		color: var(--navy);
	}
	.paydet p {
		margin: 0;
	}
	.methods {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.methods li {
		border-radius: 99px;
		padding: 4px 12px;
		background: #eceff3;
		color: var(--muted);
		font-size: 0.8125rem;
		font-weight: 600;
	}
	.methods li.on {
		background: var(--ice);
		color: var(--navy);
	}
	.paydet .btn {
		align-self: flex-start;
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
