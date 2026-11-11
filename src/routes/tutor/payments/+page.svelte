<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { formatMoney } from '#lib/money.ts';
	import { fmtDay, fmtMonth, fromLocal } from '#lib/tz.ts';
	let { data, form } = $props();
	const money = (c: number) => formatMoney(c, data.currency);
	const month = $derived(
		data.months.find((x) => x.month === data.thisMonth && x.currency === data.currency)
	);
	const method = (k: string) =>
		({
			bank: m.method_bank(),
			ecocash: 'EcoCash',
			innbucks: 'InnBucks',
			cash: m.method_cash(),
			other: m.method_other()
		})[k] ?? k;
</script>

<svelte:head><title>{m.money_title()} · Tutora</title></svelte:head>

<section class="wrap">
	<h1>{m.money_title()}</h1>
	{#if form?.done}<p class="notice" role="status">
			{t(`done_${form.done}`)}{form.receipt ? ` ${form.receipt}` : ''}
		</p>{/if}
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}

	<div class="band">
		<div class="band-label">{fmtMonth(new Date())}</div>
		<div class="stats">
			<div><b>{money(month?.total ?? 0)}</b><span>{m.received()}</span></div>
			<div><b>{money(data.totals.waiting)}</b><span>{m.waiting()}</span></div>
			<div><b>{money(data.totals.owed)}</b><span>{m.owed()}</span></div>
		</div>
	</div>

	<h2>{m.today_payments_h()}</h2>
	{#each data.pending as p (p.id)}
		<div class="card">
			<div class="row"><b class="grow">{p.studentName}</b><b>{money(p.amountCents)}</b></div>
			<p class="small muted">
				{method(p.method)}{p.reference ? ` · ${m.ref()} ${p.reference}` : ''}
			</p>
			<div class="row">
				{#if p.proofUrl}<a
						class="btn btn-secondary btn-sm"
						href={p.proofUrl}
						target="_blank"
						rel="noopener">{m.see_proof()}</a
					>{/if}
				<form method="POST" action="?/confirmPayment">
					<input type="hidden" name="id" value={p.id} /><button class="btn btn-sm" type="submit"
						>{m.confirm()}</button
					>
				</form>
				<form method="POST" action="?/rejectPayment">
					<input type="hidden" name="id" value={p.id} /><button
						class="btn btn-warn btn-sm"
						type="submit">{m.reject()}</button
					>
				</form>
			</div>
		</div>
	{:else}
		<p class="empty">{m.today_no_payments()}</p>
	{/each}

	<h2>{m.per_student()}</h2>
	<div class="card table-wrap">
		<table class="t">
			<thead
				><tr
					><th>{m.student()}</th><th class="n">{m.paid()}</th><th class="n">{m.waiting()}</th><th
						class="n">{m.owed()}</th
					></tr
				></thead
			>
			<tbody>
				{#each data.rows as r (r.id)}
					<tr
						><td><a href="/tutor/students/{r.id}">{r.name}</a></td><td class="n">{money(r.paid)}</td
						><td class="n">{money(r.waiting)}</td><td class="n" class:owe={r.owed > 0}
							>{money(r.owed)}</td
						></tr
					>
				{:else}
					<tr><td colspan="4" class="muted">{m.none_yet()}</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
	<a class="btn btn-secondary" href="/tutor/payments/export" download>{m.download_csv()}</a>
	<p class="small muted">{m.record_cash_where()}</p>

	<h2>{m.by_month()}</h2>
	<ul class="list card">
		{#each data.months as mo (mo.month + mo.currency)}
			<li>
				<span>{fmtMonth(fromLocal(mo.month + '-15', 600))}</span><b
					>{formatMoney(mo.total, mo.currency)}
					<span class="small muted">({m.payments_count({ n: mo.count })})</span></b
				>
			</li>
		{:else}
			<li class="muted small">{m.none_yet()}</li>
		{/each}
	</ul>

	<h2>{m.recent_payments()}</h2>
	<ul class="list card">
		{#each data.recent as p (p.id)}
			<li>
				<span
					><b>{p.studentName}</b> · {money(p.amountCents)}<span class="small muted block"
						>{method(p.method)} · {fmtDay(p.createdAt)}</span
					></span
				>
				{#if p.receipt}<a class="btn btn-secondary btn-sm" href="/tutor/payments/{p.id}/receipt"
						>{p.receipt}</a
					>{:else}<span class="pill {p.status === 'rejected' ? 'p-no' : 'p-wait'}"
						>{p.status === 'rejected' ? m.status_rejected() : m.status_waiting()}</span
					>{/if}
			</li>
		{:else}
			<li class="muted small">{m.none_yet()}</li>
		{/each}
	</ul>
</section>
