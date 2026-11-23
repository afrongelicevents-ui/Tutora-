<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { formatMoney } from '#lib/money.ts';
	import { fmtDay } from '#lib/tz.ts';
	import ShareWhatsApp from '#lib/components/ShareWhatsApp.svelte';
	/** Owner: Tutora Family invoices, proof first; confirm (receipt) or reject with a reason. */
	type Inv = {
		id: number;
		parentName: string;
		parentEmail: string;
		children: string[];
		periodMonths: number;
		amountCents: number;
		status: string;
		dueOn: Date | string;
		reference: string | null;
		method: string | null;
		rejectReason: string | null;
		receipt: string | null;
		proofUrl: string | null;
	};
	let {
		invoices,
		status = 'open',
		error = null
	}: { invoices: Inv[]; status?: string; error?: string | null } = $props();
	const filters = ['open', 'proof_sent', 'overdue', 'paid', 'rejected', 'all'];
</script>

<section class="ui-card stack-s" aria-labelledby="ofi-h">
	<h2 id="ofi-h" class="ui-serif">{m.fb_o_invoices()}</h2>
	<nav class="ofi-f" aria-label={m.fb_o_invoices()}>
		{#each filters as f (f)}
			<a href="?fstatus={f}" aria-current={status === f ? 'true' : undefined}
				>{f === 'open' ? m.fb_o_f_open() : f === 'all' ? m.fb_o_f_all() : t(`fb_st_${f}`)}</a
			>
		{/each}
	</nav>
	{#if error}<p class="alert" role="alert">{t(error)}</p>{/if}
	{#if !invoices.length}
		<p class="muted">{m.fb_o_none()}</p>
	{:else}
		<ul class="ofi stack-s" role="list">
			{#each invoices as i (i.id)}
				<li>
					<div class="row">
						<strong>{i.parentName}</strong>
						<span
							class="ui-pill"
							class:ok={i.status === 'paid'}
							class:warn={i.status === 'proof_sent' || i.status === 'overdue'}
							>{t(`fb_st_${i.status}`)}</span
						>
					</div>
					<p class="small muted">
						{i.parentEmail} · {i.children.join(', ')} · {t(`fb_months_${i.periodMonths}`)} ·
						<strong>{formatMoney(i.amountCents)}</strong> · {m.fb_due_on({
							date: fmtDay(new Date(i.dueOn))
						})}
					</p>
					{#if i.method || i.reference}
						<p class="small">{i.method ? t(`fb_m_${i.method}`) : ''} {i.reference ?? ''}</p>
					{/if}
					{#if i.receipt}<p class="small">{i.receipt}</p>
						<ShareWhatsApp
							text={m.share_tutora_receipt({
								plan: m.share_plan_family(),
								number: i.receipt,
								amount: formatMoney(i.amountCents)
							})}
							path="/parent/billing"
						/>{/if}
					{#if i.rejectReason}<p class="small">
							{m.fb_rejected_why({ reason: i.rejectReason })}
						</p>{/if}
					{#if i.proofUrl}<a href={i.proofUrl} target="_blank" rel="noopener">{m.fb_o_proof()}</a
						>{/if}
					<!-- only a sent proof can be confirmed or rejected -->
					{#if i.status === 'proof_sent'}
						<div class="ofi-act">
							<form method="POST" action="?/familyConfirm">
								<input type="hidden" name="id" value={i.id} />
								<button class="ui-btn sm" type="submit">{m.fb_o_confirm()}</button>
							</form>
							<form method="POST" action="?/familyReject" class="ofi-rej">
								<input type="hidden" name="id" value={i.id} />
								<input
									name="reason"
									required
									maxlength="300"
									aria-label={m.fb_o_reason()}
									placeholder={m.fb_o_reason()}
								/>
								<button class="ui-btn-soft sm" type="submit">{m.fb_o_reject()}</button>
							</form>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.ofi {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.ofi li {
		border-top: 1px solid rgba(0, 0, 0, 0.08);
		padding-top: 0.6rem;
	}
	.ofi .row {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.ofi p {
		margin: 0.2rem 0;
	}
	.ofi-f {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		font-size: 0.9rem;
	}
	.ofi-act,
	.ofi-rej {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		margin-top: 0.4rem;
	}
</style>
