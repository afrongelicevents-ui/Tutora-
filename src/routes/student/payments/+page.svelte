<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { formatMoney } from '#lib/money.ts';
	import { fmtDay } from '#lib/tz.ts';
	import { shrink } from '#lib/shrink.ts';
	let { data, form } = $props();
	const money = (c: number) => formatMoney(c, data.currency);
	const cur = $derived(data.currency === 'ZWG' ? 'ZiG' : 'USD');
	const d = $derived(data.details);
	const method = (k: string) =>
		({
			bank: m.method_bank(),
			ecocash: 'EcoCash',
			innbucks: 'InnBucks',
			cash: m.method_cash(),
			other: m.method_other()
		})[k] ?? k;
	const tabs = [
		['pay', m.pay_tab_account()],
		['cash', m.pay_tab_cash()],
		['history', m.pay_tab_receipts()],
		['packages', m.pay_tab_packages()]
	];
</script>

<svelte:head><title>{m.payments_title()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<h1>{m.payments_title()}</h1>
	{#if form?.error}<p class="alert" role="alert">
			{t(form.error, { minutes: (form as { minutes?: number }).minutes ?? 60 })}
		</p>{/if}
	{#if form?.done}<p class="notice" role="status">{t(`pdone_${form.done}`)}</p>{/if}

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

	<nav class="tabs" aria-label={m.payments_title()}>
		{#each tabs as [key, label] (key)}<a
				href="?tab={key}"
				aria-current={data.tab === key ? 'true' : undefined}>{label}</a
			>{/each}
	</nav>

	{#if data.tab === 'pay'}
		{#if d.bank || d.ecocash || d.innbucks}
			<details class="card" open>
				<summary class="h3">{m.where_to_pay()}</summary>
				<dl class="kv" style="margin-top:8px">
					{#if d.bank}<dt>{m.method_bank()}</dt>
						<dd>
							{d.bank.name}{d.bank.branch ? `, ${d.bank.branch}` : ''}<br />{d.bank.accountName} · {d
								.bank.number}
						</dd>{/if}
					{#if d.ecocash}<dt>EcoCash</dt>
						<dd>{d.ecocash.number}{d.ecocash.name ? ` (${d.ecocash.name})` : ''}</dd>{/if}
					{#if d.innbucks}<dt>InnBucks</dt>
						<dd>{d.innbucks.number}{d.innbucks.name ? ` (${d.innbucks.name})` : ''}</dd>{/if}
				</dl>
				{#if d.note}<p class="small" style="margin-top:8px">{d.note}</p>{/if}
			</details>
		{:else}
			<p class="panel small">{m.no_pay_details()}</p>
		{/if}
		<form method="POST" action="?/pay" enctype="multipart/form-data" class="card stack" novalidate>
			<div class="field">
				<label for="pa">{m.amount({ currency: cur })}</label><input
					id="pa"
					name="amount"
					inputmode="decimal"
					required
					defaultValue={data.balance.owed ? (data.balance.owed / 100).toFixed(2) : ''}
				/>
			</div>
			<fieldset>
				<legend>{m.paid_with()}</legend>
				<div class="choice">
					{#each ['ecocash', 'bank', 'innbucks', 'other'] as k (k)}<label
							><input
								type="radio"
								name="method"
								defaultValue={k}
								defaultChecked={k === 'ecocash'}
							/>
							{method(k)}</label
						>{/each}
				</div>
			</fieldset>
			<div class="field">
				<label for="pr">{m.reference()}</label><span class="hint" id="pr-h"
					>{m.reference_hint()}</span
				><input id="pr" name="reference" maxlength="60" required aria-describedby="pr-h" />
			</div>
			<div class="field">
				<label for="pd">{m.date_paid()}</label><input
					id="pd"
					name="date"
					type="date"
					defaultValue={data.today}
					max={data.today}
					required
				/>
			</div>
			<div class="field">
				<label for="pp">{m.proof()}</label><span class="hint" id="pp-h">{m.proof_hint()}</span
				><input
					id="pp"
					name="proof"
					type="file"
					accept="image/jpeg,image/png,image/webp,application/pdf"
					required
					aria-describedby="pp-h"
					use:shrink
				/>
			</div>
			<button class="btn btn-block" type="submit">{m.send_for_checking()}</button>
		</form>
	{:else if data.tab === 'cash'}
		<form method="POST" action="?/cash" class="card stack" novalidate>
			<p class="small muted">{m.cash_lead()}</p>
			<div class="field">
				<label for="ca">{m.amount({ currency: cur })}</label><input
					id="ca"
					name="amount"
					inputmode="decimal"
					required
				/>
			</div>
			<div class="field">
				<label for="cd">{m.date()}</label><input
					id="cd"
					name="date"
					type="date"
					defaultValue={data.today}
					max={data.today}
				/>
			</div>
			<button class="btn btn-block" type="submit">{m.i_paid_cash()}</button>
		</form>
	{:else if data.tab === 'history'}
		<ul class="list card">
			{#each data.payments as p (p.id)}
				<li>
					<span
						><b>{money(p.amountCents)}</b> · {method(p.method)}<span class="small muted block"
							>{fmtDay(p.createdAt)}{p.reference ? ` · ${p.reference}` : ''}{p.status ===
								'rejected' && p.rejectReason
								? ` · ${p.rejectReason}`
								: ''}</span
						></span
					>
					{#if p.receipt}<a
							class="btn btn-secondary btn-sm"
							href="/student/payments/{p.id}/receipt"
							download>{m.receipt_pdf({ n: p.receipt })}</a
						>{:else}<span class="pill {p.status === 'rejected' ? 'p-no' : 'p-wait'}"
							>{p.status === 'rejected' ? m.status_rejected() : m.status_waiting_tutor()}</span
						>{/if}
				</li>
			{:else}
				<li class="empty">{m.none_yet()}</li>
			{/each}
		</ul>
	{:else}
		{#each data.mine as p (p.id)}
			<div class="card row">
				<span class="grow"
					><b>{p.name}</b><span class="small muted block">{m.package_counts_down()}</span></span
				><span class="pill p-ok"
					>{m.left_of({ left: p.lessonsTotal - p.lessonsUsed, total: p.lessonsTotal })}</span
				>
			</div>
		{/each}
		<h2 class="h3">{m.packages_offered()}</h2>
		{#each data.offers as o (o.id)}
			<form method="POST" action="?/buy" class="card row">
				<input type="hidden" name="id" value={o.id} />
				<span class="grow"
					><b>{o.name}</b><span class="small muted block"
						>{m.lessons_count({ n: o.lessonCount })} · {money(o.priceCents)}</span
					></span
				>
				<button class="btn btn-sm" type="submit">{m.choose()}</button>
			</form>
		{:else}
			<p class="empty">{m.no_packages()}</p>
		{/each}
		<p class="small muted">{m.package_how()}</p>
	{/if}
</section>
