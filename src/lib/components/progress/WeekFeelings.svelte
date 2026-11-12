<script lang="ts">
	// The last 7 days of check-ins as a tiny SVG chart: an open dot for how the day started,
	// a filled dot for how it ended. Rows are Good / Okay / Tough. Plus one plain-words insight.
	import { m, t } from '#lib/i18n.ts';
	import { fmtWeekday } from '#lib/tz.ts';
	import { MOOD_LEVEL, type Mood } from '#lib/checkin-copy.ts';
	let {
		days,
		insight
	}: {
		days: { date: string; start: string | null; end: string | null; studied: boolean }[];
		insight: { key: string; n?: number; mood?: string } | null;
	} = $props();

	const W = 320;
	const H = 132;
	const left = 46;
	const colW = (W - left - 8) / 7;
	const rowY = [96, 60, 24]; // tough, okay, good
	const x = (i: number) => left + colW * i + colW / 2;
	const y = (md: string) => rowY[MOOD_LEVEL[md as Mood]];
	const any = $derived(days.some((d) => d.start || d.end));
	const text = $derived(
		insight
			? t(insight.key, {
					n: insight.n ?? 0,
					mood: insight.mood ? t(`ci_${insight.mood}`) : ''
				})
			: m.ck_week_none()
	);
	const label = $derived(
		days
			.map(
				(d) =>
					`${fmtWeekday(new Date(d.date + 'T12:00:00Z'))}: ${d.start ? t(`ci_${d.start}`) : '–'}${d.end ? ` → ${t(`ci_${d.end}`)}` : ''}`
			)
			.join('; ')
	);
</script>

<section class="softcard wk" aria-labelledby="wk-h">
	<strong id="wk-h">{m.ck_week_h()}</strong>
	{#if any}
		<svg viewBox="0 0 {W} {H}" role="img" aria-label={label}>
			{#each [m.ck_good(), m.ck_okay(), m.ck_tough()] as r, i (r)}
				<text x="0" y={rowY[2 - i] + 4} class="ax">{r}</text>
				<line x1={left} x2={W - 8} y1={rowY[2 - i]} y2={rowY[2 - i]} class="grid" />
			{/each}
			{#each days as d, i (d.date)}
				{#if d.start && d.end}
					<line x1={x(i)} x2={x(i)} y1={y(d.start)} y2={y(d.end)} class="link" />
				{/if}
				{#if d.start}<circle cx={x(i)} cy={y(d.start)} r="6" class="startdot" />{/if}
				{#if d.end}<circle cx={x(i)} cy={y(d.end)} r="6" class="enddot" />{/if}
				<text x={x(i)} y={H - 4} text-anchor="middle" class="ax"
					>{fmtWeekday(new Date(d.date + 'T12:00:00Z')).slice(0, 2)}</text
				>
			{/each}
		</svg>
		<p class="legend small muted">
			<span class="k open"></span>{m.ck_start_dot()} <span class="k full"></span>{m.ck_end_dot()}
		</p>
	{/if}
	<p class="ins">{text}</p>
</section>

<style>
	.wk {
		gap: 8px;
	}
	svg {
		width: 100%;
		height: auto;
		display: block;
	}
	.ax {
		font-size: 11px;
		fill: var(--muted);
	}
	.grid {
		stroke: var(--border);
		stroke-width: 1;
	}
	.link {
		stroke: var(--sky);
		stroke-width: 3;
	}
	.startdot {
		fill: #fff;
		stroke: var(--ocean);
		stroke-width: 2.5;
	}
	.enddot {
		fill: var(--navy);
	}
	.legend {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.k {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		display: inline-block;
	}
	.k.open {
		border: 2px solid var(--ocean);
	}
	.k.full {
		background: var(--navy);
		margin-left: 8px;
	}
	.ins {
		margin: 0;
		color: var(--navy);
		font-weight: 600;
		line-height: 1.45;
	}
</style>
