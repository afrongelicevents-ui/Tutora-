<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDayTime } from '#lib/tz.ts';
	let { data } = $props();
	const sites = $derived([
		{ name: m.fl_site_live(), s: data.live },
		{ name: m.fl_site_test(), s: data.test }
	]);
	const nf = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });
	const n = (v: number) => nf.format(v);
	const pct = (share: number) => `${Math.round(share * 100)}%`;
</script>

<svelte:head><title>{m.fl_title()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<h1>{m.fl_title()}</h1>
	<p class="small muted">{m.fl_lead()}</p>

	{#each sites as { name, s } (name)}
		<h2 class="h3">{name}</h2>
		{#if !s}
			<p class="softcard">{m.fl_none_yet()}</p>
		{:else}
			<p class="small muted">{m.fl_checked({ when: fmtDayTime(new Date(s.at)) })}</p>
			<ul class="list card">
				{#each s.meters as mt (mt.key)}
					<li class="meter {mt.level}">
						<span class="what"
							><b>{t(`fl_name_${mt.key}`)}</b><span class="small muted block"
								>{t(`fl_hint_${mt.key}`)}</span
							></span
						>
						<span class="num">
							{#if mt.key === 'limitErrors'}
								{mt.used === 0 ? m.fl_no_errors() : m.fl_errors({ n: mt.used })}
							{:else}
								{n(mt.used)} / {n(mt.limit)}{mt.key === 'cpu' ? ' ms' : ''}
								<span class="small">({pct(mt.share)})</span>
							{/if}
						</span>
						{#if mt.key !== 'limitErrors'}<span class="bar" aria-hidden="true"
								><span style="width: {Math.min(100, mt.share * 100)}%"></span></span
							>{/if}
					</li>
				{/each}
			</ul>
			{#if !s.usage.cloudflare.ok}<p class="note">
					{t(`fl_why_cf_${s.usage.cloudflare.reason}`)}
				</p>{/if}
			{#if !s.usage.neon.ok}<p class="note">{t(`fl_why_neon_${s.usage.neon.reason}`)}</p>{/if}
			{#if s.usage.slowest?.length}
				<h3 class="small">{m.fl_slowest()}</h3>
				<ul class="list card">
					{#each s.usage.slowest.slice(0, 8) as r (r.route)}
						<li>
							<span class="what">{r.route}</span><span class="num"
								>{n(r.p50)} ms <span class="small muted">({m.fl_p90({ ms: n(r.p90) })})</span></span
							>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	{/each}

	<h2 class="h3">{m.fl_if_over_h()}</h2>
	<ul class="small plain">
		<li>{m.fl_if_requests()}</li>
		<li>{m.fl_if_cpu()}</li>
		<li>{m.fl_if_neon()}</li>
	</ul>
</section>

<style>
	.meter {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 6px 12px;
		align-items: center;
	}
	.num {
		font-variant-numeric: tabular-nums;
		text-align: right;
		white-space: nowrap;
	}
	.bar {
		grid-column: 1 / -1;
		height: 6px;
		border-radius: 3px;
		background: var(--border);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--navy);
	}
	.warn .bar span {
		background: #b7791f;
	}
	.over .bar span,
	.over .num {
		color: #b42318;
	}
	.over .bar span {
		background: #b42318;
	}
	.plain {
		padding-left: 18px;
	}
</style>
