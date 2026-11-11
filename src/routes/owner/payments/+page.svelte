<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	import { formatMoney } from '#lib/money.ts';
	let { data } = $props();
	const label = (s: string) =>
		({ pending: m.pay_reported(), confirmed: m.pay_paid(), rejected: m.status_rejected() })[s] ?? s;
</script>

<svelte:head><title>{m.on_payments()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<h1>{m.on_payments()}</h1>
	<p class="small muted">{m.owner_pay_lead()}</p>
	<h2 class="h3">{m.owner_stale({ n: data.stale.length })}</h2>
	<ul class="list card">
		{#each data.stale as p (p.id)}
			<li>
				<span
					><b>{p.studentName}</b> → {p.tutorName}<span class="small muted block"
						>{fmtDay(p.createdAt)} · {p.method}</span
					></span
				><b>{formatMoney(p.amountCents, p.currency)}</b>
			</li>
		{:else}
			<li class="small muted">{m.none_yet()}</li>
		{/each}
	</ul>
	<nav class="tabs" style="margin-top:16px">
		{#each ['', 'pending', 'confirmed', 'rejected'] as s (s)}<a
				href="?status={s}"
				aria-current={data.status === s ? 'true' : undefined}
				>{s ? label(s) : m.find_any_status()}</a
			>{/each}
	</nav>
	<ul class="list card">
		{#each data.payments as p (p.id)}
			<li>
				<span
					><b>{p.studentName}</b> → {p.tutorName}<span class="small muted block"
						>{fmtDay(p.createdAt)} · {p.method} · {label(p.status)}</span
					></span
				><b>{formatMoney(p.amountCents, p.currency)}</b>
			</li>
		{:else}
			<li class="empty">{m.none_yet()}</li>
		{/each}
	</ul>
</section>
