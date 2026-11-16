<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	import { formatMoney } from '#lib/money.ts';
	import FamilyLocked from '#lib/components/family/FamilyLocked.svelte';
	import FamilyState from '#lib/components/family/FamilyState.svelte';
	import FamilyCheckout from '#lib/components/family/FamilyCheckout.svelte';
	import FamilyPayDetails from '#lib/components/family/FamilyPayDetails.svelte';
	import FamilyProofForm from '#lib/components/family/FamilyProofForm.svelte';
	import FamilyInvoices from '#lib/components/family/FamilyInvoices.svelte';
	let { data, form } = $props();
	const self = $derived(!!data.access.canPaySelf || data.children.length > 0);
	const inv = $derived(
		data.invoice && ['due', 'overdue', 'rejected'].includes(data.invoice.status)
			? data.invoice
			: null
	);
</script>

<svelte:head><title>{m.fb_plans_title()} · Tutora</title></svelte:head>

<section class="screen ui-page">
	<h1 class="ui-serif">{m.fb_plans_title()}</h1>
	<p class="small">{m.fb_plans_lead()}</p>
	<p><FamilyState reason={data.access.reason} until={data.access.until} /></p>
	{#if data.sent}<p class="notice" role="status">{m.fb_sent_ok()}</p>{/if}
	{#if !data.access.active}
		<FamilyLocked feature={data.locked} href={null} askParent={!self} />
	{/if}
	{#if self}
		<h2 class="ui-serif">{m.fb_self_title()}</h2>
		<p class="small">{m.fb_self_lead()}</p>
		{#if inv}
			<article class="ui-card stack-s">
				<h3 class="ui-serif">{m.fb_invoice_for({ amount: formatMoney(inv.amountCents) })}</h3>
				<p class="small muted">
					{t(`fb_months_${inv.periodMonths}`)} · {m.fb_due_on({
						date: fmtDay(new Date(inv.dueOn))
					})}
				</p>
			</article>
			<FamilyPayDetails details={data.details} />
			{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
			<FamilyProofForm invoiceId={inv.id} />
		{:else if !data.access.active || data.access.reason === 'grace'}
			<FamilyCheckout children={[]} self discounts={data.discounts} error={form?.error ?? null} />
			<FamilyPayDetails details={data.details} />
		{/if}
		<h2 class="ui-serif">{m.fb_billing_title()}</h2>
		<FamilyInvoices
			invoices={data.invoices}
			payHref={(id) => `/student/upgrade?invoice=${id}`}
			receiptHref={(id) => `/student/upgrade/${id}/receipt`}
			pilot={data.pilot}
		/>
	{/if}
</section>
