<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { formatMoney } from '#lib/money.ts';
	import { fmtDay } from '#lib/tz.ts';
	/** Owner: Tutora Pro invoices (tutors paying Tutora), proof first; confirm or reject with a reason. */
	type Inv = {
		id: number;
		tutorName: string;
		tutorEmail: string;
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

<section class="ui-card stack-s" aria-labelledby="opi-h">
	<h2 id="opi-h" class="ui-serif">{m.pro_o_invoices()}</h2>
	<nav class="ofi-f" aria-label={m.pro_o_invoices()}>
		{#each filters as f (f)}
			<a href="?view=pro&pstatus={f}" aria-current={status === f ? 'true' : undefined}
				>{f === 'open' || f === 'all' ? f : t(`fb_st_${f}`)}</a
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
						<strong>{i.tutorName}</strong>
						<span
							class="ui-pill"
							class:ok={i.status === 'paid'}
							class:warn={i.status === 'proof_sent' || i.status === 'overdue'}
							>{t(`fb_st_${i.status}`)}</span
						>
					</div>
					<p class="small muted">
						{i.tutorEmail} · Tutora Pro · {t(`fb_months_${i.periodMonths}`)} ·
						<strong>{formatMoney(i.amountCents)}</strong> · {m.fb_due_on({
							date: fmtDay(new Date(i.dueOn))
						})}
					</p>
					{#if i.method || i.reference}
						<p class="small">{i.method ? t(`fb_m_${i.method}`) : ''} {i.reference ?? ''}</p>
					{/if}
					{#if i.receipt}<p class="small">{i.receipt}</p>{/if}
					{#if i.rejectReason}<p class="small">
							{m.fb_rejected_why({ reason: i.rejectReason })}
						</p>{/if}
					{#if i.proofUrl}<a href={i.proofUrl} target="_blank" rel="noopener">{m.fb_o_proof()}</a
						>{/if}
					{#if i.status !== 'paid' && i.status !== 'cancelled'}
						<div class="ofi-act">
							<form method="POST" action="?/proConfirm">
								<input type="hidden" name="id" value={i.id} />
								<button class="ui-btn sm" type="submit">{m.fb_o_confirm()}</button>
							</form>
							{#if i.status !== 'rejected'}
								<form method="POST" action="?/proReject" class="ofi-rej">
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
							{/if}
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
