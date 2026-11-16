<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	import { formatMoney } from '#lib/money.ts';
	/** The payer's Tutora invoices with the next step for each. */
	type Inv = {
		id: number;
		children: string[];
		periodMonths: number;
		amountCents: number;
		status: string;
		dueOn: Date | string;
		rejectReason: string | null;
	};
	let {
		invoices,
		payHref,
		receiptHref,
		pilot = false
	}: {
		invoices: Inv[];
		/** during the pilot nothing is due: no Pay buttons, no overdue warnings */
		pilot?: boolean;
		/** where "Pay" / "Upload proof" leads, given the invoice id */
		payHref: (id: number) => string;
		receiptHref: (id: number) => string;
	} = $props();
	const shown = $derived(invoices.filter((i) => i.status !== 'cancelled'));
</script>

{#if !shown.length}
	<p class="muted">{m.fb_no_invoices()}</p>
{:else}
	<ul class="fam-inv stack-s" role="list">
		{#each shown as i (i.id)}
			<li class="ui-card">
				<div class="row">
					<strong>{formatMoney(i.amountCents)}</strong>
					<span
						class="ui-pill"
						class:ok={i.status === 'paid'}
						class:warn={!pilot && (i.status === 'overdue' || i.status === 'rejected')}
						>{pilot && i.status !== 'paid' && i.status !== 'proof_sent'
							? m.fb_st_pilot()
							: t(`fb_st_${i.status}`)}</span
					>
				</div>
				<p class="small muted">
					{i.children.join(', ')} · {t(`fb_months_${i.periodMonths}`)} · {m.fb_due_on({
						date: fmtDay(new Date(i.dueOn))
					})}
				</p>
				{#if i.status === 'rejected' && i.rejectReason}
					<p class="small">{m.fb_rejected_why({ reason: i.rejectReason })}</p>
				{/if}
				{#if pilot && i.status !== 'paid' && i.status !== 'proof_sent'}
					<p class="small">{m.fb_pilot_nothing_due()}</p>
				{:else if i.status === 'paid'}
					<a class="ui-btn-soft" href={receiptHref(i.id)}>{m.fb_view_receipt()}</a>
				{:else if i.status === 'proof_sent'}
					<p class="small">{m.fb_waiting()}</p>
				{:else if i.status === 'due' || i.status === 'overdue'}
					<a class="ui-btn" href={payHref(i.id)}>{m.fb_pay()}</a>
				{:else if i.status === 'rejected'}
					<a class="ui-btn" href={payHref(i.id)}>{m.fb_upload_proof()}</a>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.fam-inv {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.fam-inv .row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}
	.fam-inv p {
		margin: 0.25rem 0 0.5rem;
	}
</style>
