<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { dtf, fmtDay } from '#lib/tz.ts';
	import LineIcon from '#lib/components/LineIcon.svelte';
	import Hero from '#lib/components/ui/Hero.svelte';
	import Avatar from '#lib/components/ui/Avatar.svelte';
	import ProgressRing from '#lib/components/ui/ProgressRing.svelte';
	import ChildSwitcher from '#lib/components/parent/ChildSwitcher.svelte';
	import { MOOD_LEVEL } from '#lib/checkin-copy.ts';
	let { data } = $props();
	const c = $derived(data.child);
	// the line chart: points across 300 x 100
	const line = $derived.by(() => {
		const pts = c?.trend ?? [];
		if (pts.length < 2) return null;
		const step = 300 / (pts.length - 1);
		return pts.map((p, i) => `${(i * step).toFixed(1)},${(100 - p.pct).toFixed(1)}`).join(' ');
	});
	const dayName = (d: string) =>
		dtf('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));
	const tone = (p: number) => (p >= 70 ? 'var(--ok)' : p >= 50 ? '#c58a1b' : '#b4433a');
	const moodTone = (mood: string) =>
		['#b4433a', '#c58a1b', 'var(--ok)'][MOOD_LEVEL[mood as keyof typeof MOOD_LEVEL] ?? 1];
</script>

<svelte:head><title>{m.v3_nav_progress()} · Tutora</title></svelte:head>

<div class="screen ui-page">
	<Hero title={m.pf_progress_h()} lead={m.pf_progress_lead()} />
	<ChildSwitcher kids={data.kids} current={data.current} base="/parent/progress" />

	{#if !c}
		<div class="ui-card">
			<p class="muted">{m.par_no_children()}</p>
			<a class="ui-btn" href="/parent/settings#add">{m.par_add_child_code_h()}</a>
		</div>
	{:else}
		<header class="ui-card who">
			<Avatar name={c.name} photo={c.photo} size={56} />
			<div>
				<h2 class="ui-serif">{c.name}</h2>
				{#if c.level}<span class="small muted">{c.level}</span>{/if}
			</div>
			<a class="ui-btn-soft" href="/parent/child/{c.id}">{m.pf_view_child({ name: c.name })} ›</a>
		</header>

		<div class="ui-cols">
			<div>
				<section class="ui-card" aria-labelledby="acad-h">
					<div class="ui-sec-h">
						<h2 id="acad-h"><LineIcon name="progress" size={22} /> {m.pf_academic()}</h2>
					</div>
					{#if !c.progressShared}
						<p class="muted">{m.pf_not_shared({ name: c.name })}</p>
					{:else if !c.overall && !c.trend.length}
						<p class="muted">{m.par3_no_scores()}</p>
					{:else}
						{#if c.overall}
							<div class="ov">
								<ProgressRing pct={c.overall.pct} size={92} />
								<div>
									<strong>{m.par3_overall()}</strong>
									{#if c.overall.change !== null}
										<span class="chg" class:down={c.overall.change < 0}
											>{c.overall.change >= 0 ? '↑ +' : '↓ '}{c.overall.change}% · {m.pf_vs_before()}</span
										>
									{/if}
									<span class="small muted">{m.pf_last30()}</span>
								</div>
							</div>
						{/if}
						{#if line}
							<h3 class="sub">{m.pf_recent_marks()}</h3>
							<svg class="chart" viewBox="-6 -6 312 112" role="img" aria-label={m.pf_trend_aria()}>
								<line x1="0" y1="30" x2="300" y2="30" class="grid" />
								<line x1="0" y1="50" x2="300" y2="50" class="grid" />
								<polyline points={line} class="line" />
								{#each c.trend as p, i (i)}
									<circle
										cx={(i * 300) / (c.trend.length - 1)}
										cy={100 - p.pct}
										r="3.5"
										fill={tone(p.pct)}><title>{p.title}: {p.pct}%</title></circle
									>
								{/each}
							</svg>
							<p class="small muted legend">{m.pf_trend_legend()}</p>
						{/if}
						{#if c.topics.length}
							<h3 class="sub">{m.pf_topics()}</h3>
							<ul class="bars">
								{#each c.topics as tp (tp.subject + tp.topic)}
									<li>
										<span class="lbl"
											>{tp.topic} <span class="small muted">· {tp.subject}</span></span
										>
										<span class="bar"
											><span style="width:{tp.pct}%;background:{tone(tp.pct)}"></span></span
										>
										<strong>{tp.pct}%</strong>
									</li>
								{/each}
							</ul>
						{/if}
					{/if}
					<a class="ui-btn-soft" href="/parent/report?child={encodeURIComponent(c.id)}"
						>{m.par3_weekly()} ›</a
					>
				</section>
			</div>

			<div>
				<section class="ui-card" aria-labelledby="pers-h">
					<div class="ui-sec-h">
						<h2 id="pers-h"><LineIcon name="target" size={22} /> {m.pf_personal()}</h2>
					</div>
					{#if !c.week}
						<p class="muted">{m.pf_report_private({ name: c.name })}</p>
					{:else}
						<p class="small">
							{m.pf_week_line({ planned: c.week.daysPlanned, followed: c.week.daysFollowed })}
						</p>
						<div class="days" role="img" aria-label={m.pf_week_aria()}>
							{#each c.week.days as d (d.date)}
								<div class="day" class:future={d.future}>
									<span class="col"
										><span style="height:{d.pct ?? 0}%" class:none={d.pct === null}></span></span
									>
									<span class="small muted">{dayName(d.date)}</span>
								</div>
							{/each}
						</div>
						<a class="ui-btn-soft" href="/parent/personal?child={encodeURIComponent(c.id)}"
							>{m.pf_personal_report()} ›</a
						>
					{/if}
				</section>

				<section class="ui-card cream" aria-labelledby="feel-h">
					<div class="ui-sec-h"><h2 id="feel-h">{m.pf_feelings()}</h2></div>
					{#each c.feelings as f, i (i)}
						<p class="feel">
							<span class="dot" style="background:{moodTone(f.mood)}"></span>
							<strong>{t(`ci_${f.mood}`)}</strong>
							<span class="small muted">{fmtDay(new Date(f.at))}</span>
						</p>
					{:else}
						<p class="muted">{m.pf_no_checkin({ name: c.name })}</p>
					{/each}
				</section>
			</div>
		</div>
	{/if}
</div>

<style>
	.ui-card.who {
		flex-direction: row;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}
	.who > div {
		flex: 1;
		min-width: 0;
	}
	.who h2 {
		margin: 0;
		font-size: 1.375rem;
	}
	.ui-sec-h h2 {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 1.3rem !important;
	}
	.ui-card {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.ui-card .ui-btn-soft {
		align-self: flex-start;
	}
	.ov {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.ov div {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.chg {
		color: var(--ok);
		font-weight: 600;
	}
	.chg.down {
		color: var(--danger-700);
	}
	.sub {
		margin: 6px 0 0;
		font-size: 0.9375rem;
		color: var(--muted);
	}
	.chart {
		width: 100%;
		height: auto;
		max-height: 160px;
	}
	.grid {
		stroke: var(--border);
		stroke-dasharray: 4 4;
	}
	.line {
		fill: none;
		stroke: var(--ocean);
		stroke-width: 2.5;
		stroke-linejoin: round;
	}
	.legend {
		margin: 0;
	}
	.bars {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.bars li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 90px 44px;
		gap: 10px;
		align-items: center;
	}
	.lbl {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.bar {
		height: 8px;
		border-radius: 4px;
		background: var(--border);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		border-radius: 4px;
	}
	.days {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 6px;
		align-items: end;
	}
	.day {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}
	.day.future {
		opacity: 0.45;
	}
	.col {
		width: 100%;
		max-width: 28px;
		height: 90px;
		border-radius: 8px;
		background: var(--ice);
		display: flex;
		align-items: flex-end;
		overflow: hidden;
	}
	.col span {
		display: block;
		width: 100%;
		background: var(--ocean);
		border-radius: 8px;
	}
	.feel {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 0;
	}
	.dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
	}
	.ui-cols > div {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.ui-cols {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	@media (min-width: 900px) {
		.ui-cols {
			display: grid;
		}
	}
</style>
