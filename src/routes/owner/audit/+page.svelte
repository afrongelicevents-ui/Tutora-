<script lang="ts">
	import Head from '#lib/components/owner/Head.svelte';
	import Pager from '#lib/components/owner/Pager.svelte';
	import Empty from '#lib/components/owner/Empty.svelte';
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay, fmtTime } from '#lib/tz.ts';
	import { T_MESSAGES } from '#lib/t-keys.gen.ts';
	let { data } = $props();
	const known = new Set<string>(Object.keys(T_MESSAGES));
	/** In plain words ("Tutor approved"); an older or unknown entry falls back to its code. */
	const what = (action: string) =>
		known.has(`audit_${action}`) ? t(`audit_${action}`) : action.replace(/_/g, ' ');
	// one heading per day
	const days = $derived.by(() => {
		const out: { day: string; items: typeof data.log }[] = [];
		for (const a of data.log) {
			const d = fmtDay(a.createdAt);
			if (out.at(-1)?.day !== d) out.push({ day: d, items: [] });
			out.at(-1)!.items.push(a);
		}
		return out;
	});
</script>

<svelte:head><title>{m.ow_log()} · {m.ow_label()} · Tutora</title></svelte:head>

<div class="oa">
	<Head title={m.ow_log()} lead={m.oa_lead()} icon="clipboard" tone="navy" />
	{#if data.log.length}
		{#each days as d (d.day)}
			<section class="oa-sec" aria-label={d.day}>
				<h2 class="day">{d.day}</h2>
				<ul class="ui-card log">
					{#each d.items as a (a.id)}
						<li>
							<span class="time">{fmtTime(a.createdAt)}</span>
							<span class="grow"
								><b>{what(a.action)}</b>{#if a.detail}<span class="small block">{a.detail}</span
									>{/if}<span class="small muted block">{a.actor ?? '—'}</span></span
							>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
		<Pager page={data.page} total={data.total} />
	{:else}
		<Empty icon="clipboard" text={m.ow_log_none()} />
	{/if}
</div>

<style>
	.day {
		font-size: 1.0625rem !important;
	}
	.log {
		list-style: none;
		margin: 0;
		padding: 4px 16px;
	}
	.log li {
		display: flex;
		gap: 14px;
		padding: 12px 0;
		border-top: 1px solid var(--border);
	}
	.log li:first-child {
		border-top: 0;
	}
	.time {
		flex-shrink: 0;
		width: 52px;
		font-variant-numeric: tabular-nums;
		color: var(--muted);
		font-size: 0.875rem;
		padding-top: 2px;
	}
	.grow {
		min-width: 0;
		overflow-wrap: anywhere;
	}
</style>
