<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { formatMoney } from '#lib/money.ts';
	/**
	 * Owner dashboard: Tutora Family (and, when given, Tutora Pro) figures, and accounts with
	 * 4+ children to look at. Two figures per row on phones, four on wide screens.
	 */
	let {
		stats,
		pro = null
	}: {
		stats: {
			activeSubscriptions: number;
			children: number;
			moneyThisMonthCents: number;
			overdueAccounts: number;
			proofsWaiting: number;
			manyChildren: { parentId: string; name: string; email: string; children: number }[];
		};
		pro?: {
			proTutors: number;
			giftedPro: number;
			moneyThisMonthCents: number;
			proofsWaiting: number;
			overdueTutors: number;
		} | null;
	} = $props();
	const money = $derived(stats.moneyThisMonthCents + (pro?.moneyThisMonthCents ?? 0));
	const waiting = $derived(stats.proofsWaiting + (pro?.proofsWaiting ?? 0));
</script>

<section class="ui-card stack-s" aria-labelledby="ofs-h">
	<h2 id="ofs-h" class="ui-serif">{pro ? m.pro_o_plans_title() : m.fb_o_stats()}</h2>
	<div class="ofs">
		<div><strong>{stats.activeSubscriptions}</strong><span>{m.fb_o_active()}</span></div>
		<div><strong>{stats.children}</strong><span>{m.fb_o_children()}</span></div>
		{#if pro}
			<div>
				<strong>{pro.proTutors + pro.giftedPro}</strong><span>{m.pro_o_tutors()}</span>
			</div>
		{/if}
		<div>
			<strong>{formatMoney(money)}</strong><span>{m.fb_o_money()}</span>
		</div>
		<div>
			<strong>{stats.overdueAccounts + (pro?.overdueTutors ?? 0)}</strong><span
				>{m.fb_o_overdue()}</span
			>
		</div>
	</div>
	{#if waiting}
		<p class="ofs-wait"><span class="ui-pill warn">{m.fb_o_waiting()}: {waiting}</span></p>
	{/if}
	{#if stats.manyChildren.length}
		<h3 class="ui-serif">{m.fb_o_many()}</h3>
		<ul class="small">
			{#each stats.manyChildren as p (p.parentId)}
				<li>{p.name} · {p.email} · {m.fb_o_kids({ n: p.children })}</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.ofs {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.9rem 1rem;
	}
	@media (min-width: 760px) {
		.ofs {
			grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		}
	}
	.ofs div {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}
	.ofs strong {
		font-size: 1.4rem;
		line-height: 1.1;
	}
	.ofs span {
		font-size: 0.85rem;
		opacity: 0.75;
		overflow-wrap: anywhere;
		line-height: 1.25;
	}
	.ofs-wait {
		margin: 0;
	}
</style>
