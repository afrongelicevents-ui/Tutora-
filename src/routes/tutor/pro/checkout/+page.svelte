<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	import { formatMoney } from '#lib/money.ts';
	import Hero from '#lib/components/ui/Hero.svelte';
	import FamilyPayDetails from '#lib/components/family/FamilyPayDetails.svelte';
	import FamilyProofForm from '#lib/components/family/FamilyProofForm.svelte';
	let { data, form } = $props();
	const inv = $derived(
		data.invoice && ['due', 'overdue', 'rejected'].includes(data.invoice.status)
			? data.invoice
			: null
	);
</script>

<svelte:head><title>{m.pro_checkout_title()} · Tutora</title></svelte:head>

<section class="screen">
	<Hero title={m.pro_checkout_title()} lead={m.pro_no_fee()} />
	<div class="ui-page stack">
		<p><a href="/tutor/pro">← {m.pro_title()}</a></p>
		{#if inv}
			<article class="ui-card stack-s">
				<h2 class="ui-serif">{m.fb_invoice_for({ amount: formatMoney(inv.amountCents) })}</h2>
				<p class="small muted">
					Tutora Pro · {t(`fb_months_${inv.periodMonths}`)} · {m.fb_due_on({
						date: fmtDay(new Date(inv.dueOn))
					})}
				</p>
				{#if inv.rejectReason && inv.status === 'rejected'}
					<p class="small">{m.fb_rejected_why({ reason: inv.rejectReason })}</p>
				{/if}
			</article>
			<FamilyPayDetails details={data.details} />
			{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
			<FamilyProofForm invoiceId={inv.id} />
		{:else if data.invoice?.status === 'proof_sent'}
			<p class="notice">{m.fb_waiting()}</p>
			<p><a class="ui-btn-soft" href="/tutor/pro/billing">{m.fb_billing_link()}</a></p>
		{:else}
			<p class="notice">{m.fb_no_invoices()}</p>
			<p><a class="ui-btn" href="/tutor/pro">{m.pro_pay_now()}</a></p>
		{/if}
	</div>
</section>
