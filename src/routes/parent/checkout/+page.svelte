<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	import { formatMoney } from '#lib/money.ts';
	import FamilyCheckout from '#lib/components/family/FamilyCheckout.svelte';
	import FamilyPayDetails from '#lib/components/family/FamilyPayDetails.svelte';
	import FamilyProofForm from '#lib/components/family/FamilyProofForm.svelte';
	let { data, form } = $props();
	const inv = $derived(
		data.invoice && ['due', 'overdue', 'rejected'].includes(data.invoice.status)
			? data.invoice
			: null
	);
</script>

<svelte:head><title>{m.fb_checkout_title()} · Tutora</title></svelte:head>

<section class="screen ui-page">
	<p><a href="/parent/plans">← {m.fb_plans_title()}</a></p>
	<h1 class="ui-serif">{m.fb_checkout_title()}</h1>
	<p class="small">{m.fb_plans_lead()}</p>
	{#if data.pilot}<p class="notice">{m.fb_pilot_on()}</p>{/if}
	{#if inv}
		<article class="ui-card stack-s">
			<h2 class="ui-serif">{m.fb_invoice_for({ amount: formatMoney(inv.amountCents) })}</h2>
			<p class="small muted">
				{inv.children.join(', ')} · {t(`fb_months_${inv.periodMonths}`)} · {m.fb_due_on({
					date: fmtDay(new Date(inv.dueOn))
				})}
			</p>
			{#if inv.status === 'overdue' && !data.pilot}
				<p class="ui-pill warn">{m.fb_overdue_since({ date: fmtDay(new Date(inv.dueOn)) })}</p>
			{/if}
			{#if inv.rejectReason && inv.status === 'rejected'}
				<p class="small">{m.fb_rejected_why({ reason: inv.rejectReason })}</p>
			{/if}
		</article>
		<FamilyPayDetails details={data.details} />
		{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
		<FamilyProofForm invoiceId={inv.id} />
	{:else if !data.children.length}
		<p class="notice">{m.fb_none_children()}</p>
	{:else}
		<FamilyCheckout
			children={data.children}
			preselect={data.preselect}
			discounts={data.discounts}
			error={form?.error ?? null}
		/>
		<FamilyPayDetails details={data.details} />
	{/if}
</section>
