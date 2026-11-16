<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { formatMoney } from '#lib/money.ts';
	/** Owner dashboard: Tutora Family figures, and accounts with 4+ children to look at. */
	let {
		stats
	}: {
		stats: {
			activeSubscriptions: number;
			children: number;
			moneyThisMonthCents: number;
			overdueAccounts: number;
			proofsWaiting: number;
			manyChildren: { parentId: string; name: string; email: string; children: number }[];
		};
	} = $props();
</script>

<section class="ui-card stack-s" aria-labelledby="ofs-h">
	<h2 id="ofs-h" class="ui-serif">{m.fb_o_stats()}</h2>
	<div class="ui-grid4 ofs">
		<div><strong>{stats.activeSubscriptions}</strong><span>{m.fb_o_active()}</span></div>
		<div><strong>{stats.children}</strong><span>{m.fb_o_children()}</span></div>
		<div>
			<strong>{formatMoney(stats.moneyThisMonthCents)}</strong><span>{m.fb_o_money()}</span>
		</div>
		<div><strong>{stats.overdueAccounts}</strong><span>{m.fb_o_overdue()}</span></div>
	</div>
	{#if stats.proofsWaiting}
		<p class="ui-pill warn">{m.fb_o_waiting()}: {stats.proofsWaiting}</p>
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
	.ofs div {
		display: grid;
		gap: 0.15rem;
	}
	.ofs strong {
		font-size: 1.4rem;
	}
	.ofs span {
		font-size: 0.85rem;
		opacity: 0.75;
	}
</style>
