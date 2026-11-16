<script lang="ts">
	import Head from '#lib/components/owner/Head.svelte';
	import Filters from '#lib/components/owner/Filters.svelte';
	import Pager from '#lib/components/owner/Pager.svelte';
	import Empty from '#lib/components/owner/Empty.svelte';
	import Pill from '#lib/components/owner/Pill.svelte';
	import { m } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	import { formatMoney } from '#lib/money.ts';
	import { methodLabel } from '#lib/components/tutor/labels.ts';
	import OwnerFamilyInvoices from '#lib/components/family/OwnerFamilyInvoices.svelte';
	let { data, form } = $props();
	const label = (s: string) =>
		({
			'': m.ow_all(),
			pending: m.ow_pay_waiting(),
			stale: m.ow_pay_stale(),
			confirmed: m.pay_paid(),
			rejected: m.status_rejected()
		})[s] ?? s;
	const counts = $derived<Record<string, number>>('counts' in data ? (data.counts ?? {}) : {});
	const chips = $derived(
		['', 'pending', 'stale', 'confirmed', 'rejected'].map((v) => ({
			value: v,
			label: label(v),
			count: counts[v] ?? 0
		}))
	);
</script>

<svelte:head><title>{m.ow_payments()} · {m.ow_label()} · Tutora</title></svelte:head>

<div class="oa">
	<Head title={m.ow_payments()} lead={m.ow_payments_lead()} icon="wallet" tone="green">
		<a class="ui-btn-soft" href="/owner/settings#family-pay">{m.fb_o_settings()}</a>
	</Head>

	<nav class="oa-chips views" aria-label={m.ow_payments()}>
		<a
			class="oa-chip"
			href="/owner/payments"
			aria-current={data.view === 'tutor' ? 'page' : undefined}>{m.ow_pay_tutor_tab()}</a
		>
		<a
			class="oa-chip"
			href="/owner/payments?view=family"
			aria-current={data.view === 'family' ? 'page' : undefined}
			>{m.fb_o_stats()}{#if data.proofsWaiting}<span class="c">{data.proofsWaiting}</span>{/if}</a
		>
	</nav>

	{#if data.view === 'family'}
		<p class="small muted">{m.ow_family_lead()}</p>
		{#if form && 'familyConfirmed' in form && form.familyConfirmed}
			<p class="notice" role="status">
				{m.ow_family_confirmed({ receipt: String(form.familyConfirmed) })}
			</p>
		{/if}
		{#if form && 'familyRejected' in form && form.familyRejected}
			<p class="notice" role="status">{m.ow_family_rejected()}</p>
		{/if}
		<OwnerFamilyInvoices
			invoices={data.family.invoices}
			status={data.family.status}
			error={form && 'familyError' in form ? String(form.familyError) : null}
		/>
	{:else}
		{#if data.proofsWaiting}
			<a class="ui-card sky waiting" href="/owner/payments?view=family&fstatus=proof_sent"
				>{m.ow_family_proofs({ n: data.proofsWaiting })} ›</a
			>
		{/if}
		<p class="small muted">{m.owner_pay_lead()}</p>
		<Filters {chips} search placeholder={m.ow_search_payment()} label={m.ow_payments()} />

		{#if data.payments.length}
			<table class="oa-table">
				<thead>
					<tr>
						<th>{m.ow_col_student()}</th>
						<th>{m.ow_col_tutor()}</th>
						<th>{m.ow_col_date()}</th>
						<th>{m.ow_col_method()}</th>
						<th>{m.ow_col_status()}</th>
						<th class="num">{m.ow_col_amount()}</th>
						<th>{m.ow_col_receipt()}</th>
					</tr>
				</thead>
				<tbody>
					{#each data.payments as p (p.id)}
						<tr>
							<td class="lead strong">{p.studentName}</td>
							<td data-l={m.ow_col_tutor()}>{p.tutorName ?? '—'}</td>
							<td data-l={m.ow_col_date()}>{fmtDay(p.createdAt)}</td>
							<td data-l={m.ow_col_method()}>{methodLabel(p.method)}</td>
							<td data-l={m.ow_col_status()}
								><Pill
									tone={p.status === 'confirmed' ? 'ok' : p.status === 'rejected' ? 'no' : 'wait'}
									text={p.stale ? label('stale') : label(p.status)}
								/></td
							>
							<td class="num strong" data-l={m.ow_col_amount()}
								>{formatMoney(p.amountCents, p.currency)}</td
							>
							<td data-l={m.ow_col_receipt()}
								>{#if p.status === 'confirmed' && p.receiptNo}<a
										href="/owner/payments/{p.id}/receipt"
										download>#{p.receiptNo}</a
									>{:else}<span class="muted">—</span>{/if}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
			<Pager page={data.page} total={data.total} />
		{:else}
			<Empty icon="wallet" text={data.q ? m.ow_search_none({ q: data.q }) : m.ow_payments_none()} />
		{/if}
	{/if}
</div>

<style>
	.views .oa-chip {
		min-height: 44px;
		font-size: 1rem;
	}
	.waiting {
		font-weight: 600;
		color: var(--navy);
		text-decoration: none;
	}
</style>
