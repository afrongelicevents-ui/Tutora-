<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import FamilyInvoices from '#lib/components/family/FamilyInvoices.svelte';
	import FamilyState from '#lib/components/family/FamilyState.svelte';
	let { data } = $props();
</script>

<svelte:head><title>{m.fb_billing_title()} · Tutora</title></svelte:head>

<section class="screen ui-page">
	<p><a href="/parent/plans">← {m.fb_plans_title()}</a></p>
	<h1 class="ui-serif">{m.fb_billing_title()}</h1>
	{#if data.sent}<p class="notice" role="status">{m.fb_sent_ok()}</p>{/if}
	<p><FamilyState reason={data.access.reason} until={data.access.until} /></p>
	<FamilyInvoices
		invoices={data.invoices}
		payHref={(id) => `/parent/checkout?invoice=${id}`}
		receiptHref={(id) => `/parent/billing/${id}/receipt`}
		sharePath="/parent/billing"
		pilot={data.pilot}
	/>
	{#if data.pilot}<p class="notice">{m.fb_pilot_on()}</p>{:else}<p>
			<a class="ui-btn-soft" href="/parent/checkout">{m.fb_go_checkout()}</a>
		</p>{/if}
</section>
