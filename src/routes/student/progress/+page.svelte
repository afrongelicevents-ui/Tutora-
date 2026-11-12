<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { READY_PCT_CLIENT } from '#lib/progress-ui.ts';
	import SchoolWork from '#lib/components/progress/SchoolWork.svelte';
	import CheckinCard from '#lib/components/progress/CheckinCard.svelte';
	import LineIcon, { subjectIcon } from '#lib/components/LineIcon.svelte';
	import { fmtMinutes, fmtTime } from '#lib/tz.ts';
	let { data, form } = $props();
	const greet = $derived(
		data.partOfDay === 'morning'
			? m.sh2_good_morning({ name: data.firstName })
			: data.partOfDay === 'afternoon'
				? m.sh2_good_afternoon({ name: data.firstName })
				: m.sh2_good_evening({ name: data.firstName })
	);
	const pctNow = $derived(data.overall.current?.pct ?? null);
	// ring: r=42 → circumference 263.9
	const C = 2 * Math.PI * 42;
	const studyTime = $derived(
		data.week.minutes >= 60
			? m.pg4_hours({ h: Math.floor(data.week.minutes / 60), m: data.week.minutes % 60 })
			: m.pg4_minutes({ m: data.week.minutes })
	);
	const subjHref = (n: string) => `/student/subjects/${encodeURIComponent(n)}`;
	const dayNum = (d: Date) =>
		new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'Africa/Harare' }).format(d);
	const dayName = (d: Date) =>
		new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'Africa/Harare' }).format(d);
	const monName = (d: Date) =>
		new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'Africa/Harare' }).format(d);
	const tone = (p: number) => (p >= READY_PCT_CLIENT ? '' : p >= 50 ? 'mid' : 'low');
	const change = $derived(
		data.overall.current && data.overall.previous
			? data.overall.current.pct - data.overall.previous.pct
			: null
	);
	const weeks = (d: number) => Math.max(1, Math.round(d / 7));
</script>

<svelte:head><title>{m.pg3_title()} · Tutora</title></svelte:head>

<div class="progress-page">
	<!-- hero: greeting and the real streak -->
	<header class="hero">
		<div class="hero-text">
			<span class="kicker">{m.pg3_title()}</span>
			<h1>{greet}</h1>
			<p>{data.week.done ? m.pg4_sub_good() : m.pg4_sub_start()}</p>
		</div>
		<div class="streak">
			<a class="streak-box" href="/student/study"
				><LineIcon name="flame" size={30} /><span
					><strong>{data.streak}</strong><span>{m.pg4_streak_label()}</span></span
				><span class="chev" aria-hidden="true">›</span></a
			>
			<span class="motto">“{m.pg4_motto()}”</span>
		</div>
	</header>

	<!-- stats: every number from the student's own records -->
	<section class="stats" aria-label={m.pg3_title()}>
		<div class="stat ring-stat">
			<svg
				viewBox="0 0 100 100"
				class="ring"
				role="img"
				aria-label="{m.pg4_overall()} {pctNow ?? '—'}%"
			>
				<defs
					><linearGradient id="ringg" x1="0" y1="0" x2="1" y2="1"
						><stop offset="0" stop-color="#6fb3ea" /><stop
							offset="1"
							stop-color="#1a5fae"
						/></linearGradient
					></defs
				>
				<circle cx="50" cy="50" r="42" class="track" />
				{#if pctNow !== null}<circle
						cx="50"
						cy="50"
						r="42"
						class="bar"
						stroke-dasharray="{(C * pctNow) / 100} {C}"
					/>{/if}
				<text x="50" y="57" text-anchor="middle">{pctNow !== null ? `${pctNow}%` : '—'}</text>
			</svg>
			<span class="label">{m.pg4_overall()}</span>
			{#if change !== null && change !== 0}<span
					class:up={change > 0}
					class:down={change < 0}
					class="delta">{change > 0 ? '↑' : '↓'} {change > 0 ? '+' : ''}{change}%</span
				>{:else if pctNow === null}<span class="delta muted">{m.pg4_no_marks()}</span>{/if}
		</div>
		<div class="stat">
			<span class="ic"><LineIcon name="progress" /></span>
			<strong
				>{data.week.planned ? `${data.week.done} / ${data.week.planned}` : data.week.done}</strong
			>
			<span class="label">{m.pg4_sessions()}</span>
		</div>
		<div class="stat">
			<span class="ic"><LineIcon name="clock" /></span>
			<strong>{studyTime}</strong>
			<span class="label">{m.pg4_time()}</span>
		</div>
		<div class="stat">
			<span class="ic"><LineIcon name="check" /></span>
			<strong
				>{data.topicsReady.total
					? `${data.topicsReady.ready} / ${data.topicsReady.total}`
					: '0'}</strong
			>
			<span class="label">{m.pg4_topics_ready()}</span>
		</div>
	</section>

	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if form?.saved}<p class="notice" role="status">{m.sw3_saved()}</p>{/if}

	<!-- today's study plan -->
	<section class="panel">
		<div class="panel-h">
			<h2><LineIcon name="calendar" />{m.pg4_schedule()}</h2>
			<a href="/student/study">{m.pg4_full_schedule()} <span aria-hidden="true">→</span></a>
		</div>
		{#if data.today.length}
			<ol class="timeline">
				{#each data.today as slot (slot.id)}
					<li
						class:now={slot.state === 'now' || slot.state === 'next'}
						class:done={slot.state === 'done'}
					>
						<span class="when"
							>{#if slot.state === 'now'}<span class="pill-now">{m.pg4_now()}</span
								>{:else}{fmtMinutes(slot.startMinute)}{/if}</span
						>
						<span class="dot" aria-hidden="true"></span>
						<span class="what"
							><strong>{slot.subject}</strong>{slot.topic ? ` – ${slot.topic}` : ''}</span
						>
						{#if slot.state === 'now' || slot.state === 'next'}<a
								class="btn start"
								href="/student/study">{m.pg4_start()}</a
							>{:else if slot.state === 'done'}<span class="done-t">{m.sh_done()}</span>{/if}
					</li>
				{/each}
			</ol>
		{:else}
			<p class="muted empty">
				{m.pg4_no_schedule()} <a href="/student/study">{m.pg4_make_plan()} →</a>
			</p>
		{/if}
	</section>

	<!-- shortcuts to real features only -->
	<nav class="shortcuts" aria-label={m.pg3_title()}>
		<a href="/student/find"
			><LineIcon name="search" size={26} /><strong>{m.pg4_t_find()}</strong><span
				>{m.pg4_t_find_a()} →</span
			></a
		>
		<a href="/student/study"
			><LineIcon name="calendar" size={26} /><strong>{m.pg4_t_plan()}</strong><span
				>{m.pg4_t_plan_a()} →</span
			></a
		>
		<a href="/student/check"
			><LineIcon name="check" size={26} /><strong>{m.pg4_t_check()}</strong><span
				>{m.pg4_t_check_a()} →</span
			></a
		>
		<a href="/student/homework"
			><LineIcon name="book" size={26} /><strong>{m.pg4_t_hw()}</strong><span
				>{m.pg4_t_hw_a()} →</span
			></a
		>
		<a href="/student/tools"
			><LineIcon name="link" size={26} /><strong>{m.pg4_t_tools()}</strong><span
				>{m.pg4_t_tools_a()} →</span
			></a
		>
		<a href="/student/family"
			><LineIcon name="family" size={26} /><strong>{m.pg4_t_family()}</strong><span
				>{m.pg4_t_family_a()} →</span
			></a
		>
	</nav>

	<!-- subject progress -->
	<section class="panel">
		<div class="panel-h">
			<h2><LineIcon name="book" />{m.pg4_subjects()}</h2>
			{#if data.topics.length}<a href="#topics"
					>{m.pg4_see_details()} <span aria-hidden="true">→</span></a
				>{/if}
		</div>
		{#if data.subjectCards.top.length}
			<ul class="subj">
				{#each data.subjectCards.top as sc, i (sc.name)}
					<li>
						<a href={subjHref(sc.name)}>
							<span class="ic"><LineIcon name={subjectIcon(sc.name)} size={24} /></span>
							<span class="sname">{sc.name}</span>
							<strong>{sc.pct}%</strong>
							<span class="bar b{i}"><span style="width:{sc.pct}%"></span></span>
						</a>
					</li>
				{/each}
				{#if data.subjectCards.other}
					<li>
						<a href="/student/subjects">
							<span class="ic"><LineIcon name="more" size={24} /></span>
							<span class="sname">{m.pg4_other()}</span>
							<strong>{data.subjectCards.other.pct}%</strong>
							<span class="bar b3"><span style="width:{data.subjectCards.other.pct}%"></span></span>
						</a>
					</li>
				{/if}
			</ul>
		{:else}
			<p class="muted empty">{m.pg4_subjects_empty()}</p>
		{/if}
	</section>

	<!-- upcoming lessons -->
	<section class="panel">
		<div class="panel-h">
			<h2><LineIcon name="clock" />{m.pg4_upcoming()}</h2>
			<a href="/student/lessons">{m.pg4_view_calendar()} <span aria-hidden="true">→</span></a>
		</div>
		{#each data.upcoming as l (l.id)}
			<div class="lesson">
				<span class="date"
					><span>{dayName(l.startsAt)}</span><strong>{dayNum(l.startsAt)}</strong><span
						>{monName(l.startsAt)}</span
					></span
				>
				<span class="linfo"
					><strong
						>{l.kind === 'intro'
							? m.sh_intro_with({ tutor: l.tutorName ?? '' })
							: (l.subjectName ?? '')}</strong
					><span class="muted"
						>{fmtTime(l.startsAt)} – {fmtTime(l.endsAt)}{l.tutorName && l.kind !== 'intro'
							? ` · ${l.tutorName}`
							: ''}</span
					></span
				>
				{#if l.open}<a class="btn join" href="/student/lessons/{l.id}">{m.pg4_join()}</a>{:else}<a
						class="btn btn-secondary join"
						href="/student/lessons/{l.id}">{m.pg4_view()}</a
					>{/if}
			</div>
		{:else}
			<p class="muted empty">{m.pg4_no_upcoming()} <a href="/student/find">{m.pg4_book()} →</a></p>
		{/each}
	</section>

	<!-- everything that was already here, in detail -->
	<h2 class="details-h" id="topics">{m.pg4_details()}</h2>

	<CheckinCard family={data.family} checkin={data.checkin} checkinId={data.checkinId} {form} />

	{#if !data.overall.current}
		<div class="softcard">
			<strong>{m.pg3_none()}</strong>
			<span class="small">{m.pg3_none_lead()}</span>
			<a class="btn btn-ghost" href="/student/check">{m.sh_check_link()}</a>
		</div>
	{/if}

	{#each data.topics.slice(0, 8) as tp (tp.subject + tp.topic)}
		<div class="topic">
			<div class="tl">
				<span>{tp.topic} <span class="muted small">· {tp.subject}</span></span><strong
					>{tp.pct}%</strong
				>
			</div>
			<div class="meter {tone(tp.pct)}" role="img" aria-label="{tp.topic} {tp.pct}%">
				<span style="width:{tp.pct}%"></span>
			</div>
		</div>
	{/each}

	{#if data.weak}
		<p class="advice">
			{data.weak.examDays !== null
				? m.pg3_weak_exam({ topic: data.weak.topic, weeks: weeks(data.weak.examDays) })
				: m.pg3_weak({ topic: data.weak.topic })}
			{data.weak.slots ? m.pg3_weak_plan({ n: data.weak.slots }) : m.pg3_weak_add()}
		</p>
	{/if}

	<SchoolWork school={data.school} editable />

	<div class="rows">
		{#each data.exams as e (e.id)}
			<div>
				<span
					>{m.pg3_exam({ title: e.title })}{e.daysLeft !== null
						? ` · ${m.pg3_days({ n: e.daysLeft })}`
						: ''}</span
				>
				<strong
					>{e.total ? m.pg3_ready({ ready: e.ready, total: e.total }) : m.pg3_no_topics()}</strong
				>
			</div>
		{:else}
			<div><span>{m.pg3_exam_none()}</span><a href="/student/study">{m.pg3_add_exam()}</a></div>
		{/each}
		<div>
			<span>{m.pg3_sessions()}</span>
			<strong
				>{data.week.planned
					? m.pg3_of({ done: data.week.done, planned: data.week.planned })
					: data.week.done}</strong
			>
		</div>
	</div>

	{#if data.results.length}
		<section>
			<div class="section-h"><h2>{m.pg3_marked()}</h2></div>
			<div class="rows">
				{#each data.results as r (r.id)}
					<details>
						<summary
							><span>{r.title} · {r.topic}</span><strong>{r.score}/{r.maxScore}</strong></summary
						>
						<p class="small muted">{r.subject} · {r.takenOn} · {t(`pg3_src_${r.source}`)}</p>
						{#if r.feedback}<p class="prewrap small">{r.feedback}</p>{/if}
					</details>
				{/each}
			</div>
		</section>
	{/if}
</div>

<style>
	.progress-page {
		max-width: 760px;
		margin: 0 auto;
		width: 100%;
		padding: 8px 16px 32px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	/* hero */
	.hero {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 16px;
		align-items: start;
		padding: 22px 20px 50px;
		border-radius: 24px;
		color: #fff;
		background:
			radial-gradient(110% 90% at 100% 0%, rgb(111 179 234 / 0.3), transparent 60%),
			linear-gradient(160deg, #143a6b, var(--navy) 75%);
	}
	.kicker {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--on-navy);
	}
	.hero h1 {
		margin: 4px 0 6px;
		font-size: 1.75rem;
		line-height: 1.12;
		color: #fff;
	}
	.hero p {
		margin: 0;
		color: var(--on-navy);
		font-size: 0.9375rem;
	}
	.streak {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.streak-box {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		border-radius: 16px;
		border: 1px solid rgb(255 255 255 / 0.3);
		background: rgb(255 255 255 / 0.08);
		color: #ffd29a;
		text-decoration: none;
	}
	.streak-box > span:not(.chev) {
		display: flex;
		flex-direction: column;
		line-height: 1.05;
	}
	.streak-box strong {
		font-size: 1.5rem;
		color: #fff;
	}
	.streak-box span span {
		font-size: 0.75rem;
		color: var(--on-navy);
		white-space: nowrap;
	}
	.chev {
		color: var(--on-navy);
		font-size: 1.25rem;
	}
	.motto {
		font-size: 0.8125rem;
		color: var(--on-navy);
		font-style: italic;
	}
	/* stats */
	.stats {
		display: grid;
		grid-template-columns: 1.15fr repeat(3, minmax(0, 1fr));
		margin: -46px 6px 0;
		padding: 14px 6px;
		border-radius: 22px;
		background: rgb(255 255 255 / 0.9);
		border: 1px solid var(--glass-border);
		box-shadow: var(--shadow-soft);
		-webkit-backdrop-filter: blur(10px);
		backdrop-filter: blur(10px);
	}
	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 2px 4px;
		text-align: center;
		min-width: 0;
	}
	.stat + .stat {
		border-left: 1px solid var(--border);
	}
	.stat .ic {
		color: var(--ocean);
	}
	.stat strong {
		font-size: 1.25rem;
		color: var(--navy);
		line-height: 1.1;
	}
	.stat .label {
		font-size: 0.6875rem;
		line-height: 1.25;
		color: var(--muted);
	}
	.ring {
		width: 70px;
		height: 70px;
	}
	.ring .track {
		fill: none;
		stroke: var(--ice);
		stroke-width: 9;
	}
	.ring .bar {
		fill: none;
		stroke: url(#ringg);
		stroke-width: 9;
		stroke-linecap: round;
		transform: rotate(-90deg);
		transform-origin: 50% 50%;
	}
	.ring text {
		font: 700 20px var(--font);
		fill: var(--navy);
	}
	.delta {
		font-size: 0.75rem;
		font-weight: 700;
	}
	/* panels */
	.panel {
		padding: 16px;
		border-radius: 20px;
		background: #fff;
		border: 1px solid var(--border);
	}
	.panel-h {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		margin-bottom: 10px;
	}
	.panel-h h2 {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 0;
		font-family: var(--font);
		font-size: 1rem;
		font-weight: 700;
		color: var(--navy);
	}
	.panel-h h2 :global(svg) {
		color: var(--navy);
	}
	.panel-h a {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--ocean);
		text-decoration: none;
		white-space: nowrap;
		padding: 8px 0;
	}
	.empty {
		margin: 0;
		font-size: 0.9375rem;
	}
	.timeline {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.timeline li {
		display: grid;
		grid-template-columns: 74px 14px minmax(0, 1fr) auto;
		align-items: center;
		gap: 8px;
		min-height: 48px;
		font-size: 0.875rem;
	}
	.when {
		color: var(--muted);
		font-variant-numeric: tabular-nums;
		font-size: 0.8125rem;
	}
	.pill-now {
		display: inline-block;
		padding: 5px 14px;
		border-radius: 99px;
		background: var(--ocean);
		color: #fff;
		font-weight: 700;
	}
	.dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 2px solid var(--border-strong);
		background: #fff;
	}
	.timeline li.now .dot {
		border-color: var(--ocean);
		background: var(--ocean);
	}
	.timeline li.done .what {
		color: var(--muted);
		text-decoration: line-through;
	}
	.what strong {
		color: var(--navy);
	}
	.start {
		min-height: 40px;
		padding: 0 18px;
		background: var(--navy);
		border-color: var(--navy);
	}
	.done-t {
		font-size: 0.8125rem;
		color: var(--ok);
		font-weight: 600;
	}
	/* shortcuts */
	.shortcuts {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
	}
	.shortcuts a {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 14px 6px;
		border-radius: 18px;
		text-align: center;
		color: var(--ocean);
		text-decoration: none;
		background: linear-gradient(180deg, rgb(255 255 255 / 0.9), rgb(231 240 250 / 0.75));
		border: 1px solid var(--glass-border);
		box-shadow: var(--shadow-soft);
	}
	.shortcuts strong {
		margin-top: 4px;
		font-size: 0.8125rem;
		color: var(--navy);
		line-height: 1.2;
	}
	.shortcuts span {
		font-size: 0.75rem;
		font-weight: 600;
	}
	/* subjects */
	.subj {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 8px;
	}
	.subj a {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 12px 6px;
		border-radius: 16px;
		background: var(--snow);
		border: 1px solid var(--border);
		text-decoration: none;
		color: var(--ocean);
		text-align: center;
	}
	.sname {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text);
		line-height: 1.2;
	}
	.subj strong {
		font-size: 1.125rem;
		color: var(--navy);
	}
	.subj .bar {
		display: block;
		width: 80%;
		height: 5px;
		border-radius: 99px;
		background: var(--ice);
		overflow: hidden;
	}
	.subj .bar span {
		display: block;
		height: 100%;
		border-radius: 99px;
	}
	.b0 span {
		background: #1a5fae;
	}
	.b1 span {
		background: #3d86d8;
	}
	.b2 span {
		background: #1f7a4d;
	}
	.b3 span {
		background: var(--navy);
	}
	/* upcoming lessons */
	.lesson {
		display: grid;
		grid-template-columns: 56px minmax(0, 1fr) auto;
		align-items: center;
		gap: 12px;
		padding: 8px 0;
	}
	.lesson + .lesson {
		border-top: 1px solid var(--border);
	}
	.date {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 6px 0;
		border-radius: 12px;
		background: var(--snow);
		border: 1px solid var(--border);
		font-size: 0.75rem;
		color: var(--muted);
		line-height: 1.15;
	}
	.date strong {
		font-size: 1.375rem;
		color: var(--navy);
	}
	.linfo {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		font-size: 0.875rem;
	}
	.linfo strong {
		color: var(--navy);
		font-size: 1rem;
	}
	.join {
		min-height: 42px;
		padding: 0 18px;
	}
	.details-h {
		margin: 12px 0 0;
		font-size: 1.25rem;
		color: var(--navy);
	}
	@media (max-width: 380px) {
		.stats {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			row-gap: 12px;
		}
		.stat:nth-child(3) {
			border-left: 0;
		}
		.subj {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (min-width: 900px) {
		.progress-page {
			padding-top: 32px;
			gap: 20px;
		}
		.hero {
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: center;
			padding: 30px 30px 64px;
		}
		.streak {
			flex-direction: column;
			align-items: flex-end;
			max-width: 220px;
		}
		.motto {
			text-align: right;
		}
		.hero h1 {
			font-size: 2.25rem;
		}
		.stat strong {
			font-size: 1.625rem;
		}
		.stat .label {
			font-size: 0.8125rem;
		}
		.ring {
			width: 92px;
			height: 92px;
		}
		.shortcuts {
			grid-template-columns: repeat(6, minmax(0, 1fr));
		}
	}
	.overall {
		display: flex;
		align-items: baseline;
		gap: 10px;
		flex-wrap: wrap;
	}
	.up {
		color: var(--ok);
		font-weight: 600;
	}
	.down {
		color: var(--warn);
		font-weight: 600;
	}
	.topic {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.tl {
		display: flex;
		justify-content: space-between;
		font-size: 0.9375rem;
	}
	.advice {
		margin: 0;
		font-size: 0.9375rem;
		line-height: 1.6;
		padding-top: 12px;
		border-top: 1px solid var(--border);
	}
	details summary {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		cursor: pointer;
		list-style: none;
		width: 100%;
	}
	.rows > details {
		display: block;
	}
</style>
