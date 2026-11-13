<script lang="ts">
	// My personal report: personal wellbeing and organisation (not school marks).
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay, fmtWeekday } from '#lib/tz.ts';
	import LineIcon from '#lib/components/LineIcon.svelte';
	import CheckinCard from '#lib/components/progress/CheckinCard.svelte';
	import WeekFeelings from '#lib/components/progress/WeekFeelings.svelte';
	import { followupKey, responseKey, type Mood } from '#lib/checkin-copy.ts';
	let { data, form } = $props();
	const s = $derived(data.today.stats);
	const tasks = $derived(data.today.items.filter((i) => i.kind === 'task'));
	const wd = (d: string) => fmtWeekday(new Date(d + 'T12:00:00Z'));
	const maxTasks = $derived(Math.max(1, ...data.week.days.map((d) => d.tasksTotal)));
	const names = $derived(
		data.family.length <= 1
			? (data.family[0] ?? '')
			: `${data.family.slice(0, -1).join(', ')} ${m.and_word()} ${data.family.at(-1)}`
	);
	const insightText = $derived(
		data.insight
			? t(data.insight.key, {
					n: data.insight.n ?? 0,
					day: data.insight.day ? fmtDay(new Date(data.insight.day + 'T12:00:00Z')) : ''
				})
			: null
	);
	const start = $derived(data.ck.start);
	const fu = $derived(data.ck.followup);
</script>

<svelte:head><title>{m.pr_title()} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/student/me">← {m.me_title()}</a>
	<h1>{m.pr_title()}</h1>
	<p class="lead">{m.pr_lead()}</p>

	<!-- TODAY -->
	<section class="softcard" aria-labelledby="pr-today">
		<h2 id="pr-today" class="h3">{m.pr_today()}</h2>
		{#if s.planned}
			<div class="planline">
				<strong>{m.pr_plan_vs_done({ done: s.done, planned: s.planned })}</strong>
				<span class="pct">{s.pct}%</span>
			</div>
			<div class="bar" role="img" aria-label="{s.pct}%"><span style="width:{s.pct}%"></span></div>
		{:else}
			<p class="muted">{m.pr_no_plan()} <a href="/student/planner">{m.me_plan_day()} →</a></p>
		{/if}

		<h3 class="sub">{m.pr_tasks_ticked()}</h3>
		{#if tasks.length}
			<ul class="ticks">
				{#each tasks as tk (tk.key)}
					<li class:done={tk.done}>
						<span class="box" aria-hidden="true"
							>{#if tk.done}<LineIcon name="check" size={16} />{/if}</span
						>{tk.title}<span class="sr-only">{tk.done ? '✓' : ''}</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted small">{m.pr_no_tasks()}</p>
		{/if}

		<h3 class="sub">{m.pr_checkins()}</h3>
		<dl class="cks">
			<div>
				<dt>{m.pr_morning()}</dt>
				<dd>
					{#if start}
						<strong>{t(`ci_${start.mood}`)}</strong>
						<span
							>{t(responseKey(start.mood as Mood, !!start.planSubject), {
								subject: start.planSubject ?? ''
							})}</span
						>
					{:else}<span class="muted">{m.pr_not_yet()}</span>{/if}
				</dd>
			</div>
			<div>
				<dt>{m.pr_evening()}</dt>
				<dd>
					{#if fu}
						<strong>{t(`ci_${fu.mood}`)}</strong>
						<span>{t(followupKey(fu.mood as Mood))}</span>
					{:else}<span class="muted">{m.pr_not_yet()}</span>{/if}
				</dd>
			</div>
		</dl>

		<div class="summary">
			<span class="lbl">{m.pr_summary()}</span>
			<p>{t(data.summary.key, { n: data.summary.n ?? 0 })}</p>
		</div>
	</section>

	<CheckinCard family={data.family} ck={data.ck} talk={data.talk} {form} />

	<!-- THIS WEEK -->
	<section class="softcard" aria-labelledby="pr-week">
		<h2 id="pr-week" class="h3">{m.pr_week()}</h2>
		{#if insightText}<p class="insight">{insightText}</p>{/if}
		<p>
			{data.week.daysPlanned
				? m.pr_days_followed({ followed: data.week.daysFollowed, planned: data.week.daysPlanned })
				: m.pr_days_none()}
		</p>
		<ol class="wk" aria-label={m.pr_tasks_week()}>
			{#each data.week.days as d (d.date)}
				<li class:future={'future' in d}>
					<span
						class="dot"
						class:planned={d.planned > 0}
						class:followed={(d.pct ?? 0) >= 60}
						title={d.pct !== null ? `${d.pct}%` : ''}
					></span>
					<span class="col" aria-hidden="true"
						><span style="height:{(100 * d.tasksDone) / maxTasks}%"></span></span
					>
					<span class="n">{d.tasksDone}</span>
					<span class="d">{wd(d.date).slice(0, 2)}</span>
					<span class="sr-only"
						>{wd(d.date)}: {d.pct !== null ? `${d.pct}%` : '—'}, {d.tasksDone} / {d.tasksTotal}</span
					>
				</li>
			{/each}
		</ol>
		<p class="small muted">{m.pr_tasks_week()}</p>
		<p>
			<LineIcon name="trophy" size={18} />
			{m.pr_goals_week({ n: data.goalsReachedThisWeek })}
		</p>
	</section>

	<WeekFeelings days={data.feelings.days} insight={data.feelings.insight} />

	<!-- HISTORY -->
	<section class="softcard" aria-labelledby="pr-hist">
		<h2 id="pr-hist" class="h3">{m.pr_history()}</h2>
		{#if data.history.length}
			<ul class="hist">
				{#each data.history as h (h.date)}
					<li>
						<strong>{fmtDay(new Date(h.date + 'T12:00:00Z'))}</strong>
						<span class="small"
							>{h.planned
								? m.pr_plan_vs_done({ done: h.done, planned: h.planned })
								: m.pr_no_plan()}
							{#if h.tasksTotal}· {m.me_tasks_done()} {h.tasksDone}/{h.tasksTotal}{/if}</span
						>
						{#if h.startMood || h.endMood}<span class="small muted"
								>{h.startMood ? t(`ci_${h.startMood}`) : '—'} → {h.endMood
									? t(`ci_${h.endMood}`)
									: '—'}</span
							>{/if}
						<span class="small line">{t(h.line.key, { n: h.line.n ?? 0 })}</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted">{m.pr_history_none()}</p>
		{/if}
		{#if data.moreHistory}<a class="btn btn-secondary" href="?before={data.olderFrom}#pr-hist"
				>{m.pr_older()}</a
			>{/if}
	</section>

	<!-- sharing -->
	{#if data.family.length}
		<form method="POST" action="?/shareReport" class="softcard share">
			<strong>{m.pr_share_h()}</strong>
			<p class="small">{m.pr_share_lead()}</p>
			<span class="yn">
				<button
					class="yn-b"
					class:on={data.shared}
					type="submit"
					name="answer"
					value="yes"
					aria-pressed={data.shared}>{m.ck_yes()}</button
				><button
					class="yn-b"
					class:on={!data.shared}
					type="submit"
					name="answer"
					value="no"
					aria-pressed={!data.shared}>{m.ck_no()}</button
				>
			</span>
			<span class="small muted">{data.shared ? `${m.pr_shared()} (${names})` : m.pr_private()}</span
			>
		</form>
	{/if}
</div>

<style>
	.back {
		align-self: flex-start;
		color: var(--ocean);
		font-weight: 600;
		text-decoration: none;
		padding: 8px 0;
	}
	.planline {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		color: var(--navy);
	}
	.pct {
		font-weight: 700;
		color: var(--ocean);
	}
	.bar {
		height: 10px;
		border-radius: 99px;
		background: #fff;
		border: 1px solid var(--border);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, var(--sky), var(--ocean));
	}
	.sub {
		margin: 6px 0 0;
		font: 700 0.875rem var(--font);
		color: var(--navy);
	}
	.ticks {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.ticks li {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.ticks li.done {
		color: var(--muted);
		text-decoration: line-through;
	}
	.box {
		width: 22px;
		height: 22px;
		border-radius: 6px;
		border: 2px solid var(--navy);
		display: grid;
		place-items: center;
		flex: none;
	}
	li.done .box {
		background: var(--navy);
		color: #fff;
	}
	.cks {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.cks > div {
		display: grid;
		grid-template-columns: 76px 1fr;
		gap: 8px;
	}
	.cks dt {
		font-size: 0.8125rem;
		color: var(--muted);
		font-weight: 600;
	}
	.cks dd {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		line-height: 1.4;
	}
	.cks dd strong {
		color: var(--navy);
	}
	.summary {
		background: #fff;
		border-radius: 14px;
		border: 1px solid var(--border);
		padding: 10px 12px;
	}
	.summary .lbl {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted);
	}
	.summary p {
		margin: 2px 0 0;
		color: var(--navy);
		font-weight: 600;
	}
	.insight {
		margin: 0;
		color: var(--navy);
		font-weight: 700;
	}
	.wk {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 6px;
		text-align: center;
	}
	.wk li {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}
	.wk li.future {
		opacity: 0.4;
	}
	.dot {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 2px solid var(--border-strong);
	}
	.dot.planned {
		border-color: var(--ocean);
	}
	.dot.followed {
		background: var(--ocean);
	}
	.col {
		width: 18px;
		height: 56px;
		background: #fff;
		border-radius: 6px;
		display: flex;
		align-items: flex-end;
		overflow: hidden;
		border: 1px solid var(--border);
	}
	.col span {
		display: block;
		width: 100%;
		background: var(--navy);
	}
	.n {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--navy);
	}
	.d {
		font-size: 0.6875rem;
		color: var(--muted);
	}
	.hist {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}
	.hist li {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px 0;
		border-bottom: 1px solid var(--border);
		color: var(--navy);
	}
	.line {
		color: var(--ocean);
		font-weight: 600;
	}
	.share {
		gap: 8px;
	}
	.share p {
		margin: 0;
	}
	.yn {
		display: inline-flex;
		align-self: flex-start;
		border: 1.5px solid var(--navy);
		border-radius: 99px;
		overflow: hidden;
	}
	.yn-b {
		min-width: 64px;
		min-height: 40px;
		border: 0;
		background: #fff;
		color: var(--navy);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}
	.yn-b.on {
		background: var(--navy);
		color: #fff;
	}
</style>
