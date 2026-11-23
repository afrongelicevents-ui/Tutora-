<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import Hero from '#lib/components/ui/Hero.svelte';
	import FamilyInvoices from '#lib/components/family/FamilyInvoices.svelte';
	import FamilyState from '#lib/components/family/FamilyState.svelte';
	let { data } = $props();
	const reason = $derived(data.access.pilot ? 'pilot' : data.access.state);
</script>

<svelte:head><title>{m.pro_billing_title()} · Tutora</title></svelte:head>

<section class="screen">
	<Hero title={m.pro_billing_title()} lead={m.pro_no_fee()} />
	<div class="ui-page stack">
		<p><a href="/tutor/pro">← {m.pro_title()}</a></p>
		{#if data.sent}<p class="notice" role="status">{m.fb_sent_ok()}</p>{/if}
		<p><FamilyState {reason} until={data.access.until ?? null} /></p>
		<FamilyInvoices
			invoices={data.invoices}
			payHref={(id) => `/tutor/pro/checkout?invoice=${id}`}
			receiptHref={(id) => `/tutor/pro/billing/${id}/receipt`}
			sharePath="/tutor/pro/billing"
			plan="pro"
		/>
		<p><a class="ui-btn" href="/tutor/pro">{m.pro_pay_now()}</a></p>
	</div>
</section>
