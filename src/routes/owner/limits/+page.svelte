<script lang="ts">
	import Head from '#lib/components/owner/Head.svelte';
	import Empty from '#lib/components/owner/Empty.svelte';
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

<svelte:head><title>{m.fl_title()} · {m.ow_label()} · Tutora</title></svelte:head>

<div class="oa">
	<Head title={m.fl_title()} lead={m.fl_lead()} icon="progress" tone="green" />

	<div class="ui-cols">
		{#each sites as { name, s } (name)}
			<div>
				<section class="ui-card oa-sec" aria-label={name}>
					<h2>{name}</h2>
					{#if !s}
						<Empty icon="clock" text={m.fl_none_yet()} />
					{:else}
						<p class="small muted">{m.fl_checked({ when: fmtDayTime(new Date(s.at)) })}</p>
						{#each s.meters as mt (mt.key)}
							<div class="oa-meter {mt.level}">
								<span
									><b>{t(`fl_name_${mt.key}`)}</b><span class="small muted block"
										>{t(`fl_hint_${mt.key}`)}</span
									></span
								>
								<span class="val">
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
							</div>
						{/each}
						{#if !s.usage.cloudflare.ok}<p class="note">
								{t(`fl_why_cf_${s.usage.cloudflare.reason}`)}
							</p>{/if}
						{#if !s.usage.neon.ok}<p class="note">{t(`fl_why_neon_${s.usage.neon.reason}`)}</p>{/if}
						{#if s.usage.slowest?.length}
							<h3>{m.fl_slowest()}</h3>
							<table class="oa-table">
								<tbody>
									{#each s.usage.slowest.slice(0, 8) as r (r.route)}
										<tr>
											<td class="lead">{r.route}</td>
											<td class="num"
												>{n(r.p50)} ms
												<span class="small muted">({m.fl_p90({ ms: n(r.p90) })})</span></td
											>
										</tr>
									{/each}
								</tbody>
							</table>
						{/if}
					{/if}
				</section>
			</div>
		{/each}
	</div>

	<section class="ui-card cream oa-sec" aria-labelledby="if-h">
		<h2 id="if-h">{m.fl_if_over_h()}</h2>
		<ul class="small plain">
			<li>{m.fl_if_requests()}</li>
			<li>{m.fl_if_cpu()}</li>
			<li>{m.fl_if_neon()}</li>
		</ul>
	</section>
</div>

<style>
	.plain {
		margin: 0;
		padding-left: 18px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.oa-meter {
		padding: 8px 0;
	}
</style>
