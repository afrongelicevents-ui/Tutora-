<script lang="ts">
	// More: the tutor's teaching centre. Profile, my teaching day, student success, my own
	// achievements, teaching tools, and one way into account & settings.
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay, fmtTime, fmtWeekday } from '#lib/tz.ts';
	import LineIcon from '#lib/components/LineIcon.svelte';
	import type { IconName } from '#lib/components/LineIcon.svelte';
	import Face from '#lib/components/people/Face.svelte';
	let { data } = $props();
	const p = $derived(data.profile);
	const c = $derived(data.centre);
	const earned = $derived(c.achievements.filter((a) => a.earned).length);
	const tasksDone = $derived(data.day.tasks.filter((x) => x.done).length);
	const ACH_ICON: Record<string, IconName> = {
		consistency: 'flame',
		milestone: 'trophy',
		routine: 'calendar',
		marking: 'clipboard',
		tasks: 'check',
		reviews: 'star'
	};
	const TOOLS: [string, IconName, string, string][] = [
		['/tutor/homework', 'clipboard', 'v3_nav_marking', 'tut3_more_marking_hint'],
		['/tutor/assessments', 'check', 'v3_nav_assessments', 'tut3_more_assess_hint'],
		['/tutor/resources', 'book', 'res3_nav', 'res3_hint'],
		['/tutor/tools', 'link', 'v3_nav_tools', 'tut3_more_tools_hint'],
		['/tutor/school-plus', 'school', 'sp3_title', 'sp3_more_hint'],
		['/tutor/reviews', 'star', 'reviews_title', 'tut3_more_reviews_hint']
	];
	const now = $derived(new Date(data.day.date));
</script>

<svelte:head><title>{m.v3_nav_more()} · Tutora</title></svelte:head>

<section class="screen">
	<header>
		<h1>{m.v3_nav_more()}</h1>
		<p class="lead">{m.mo_lead()}</p>
	</header>

	<!-- A. my teacher profile -->
	<section class="prof">
		{#if p.photo}
			<img class="ph" src={p.photo} alt="" width="84" height="84" />
		{:else}
			<Face name={p.name} size={84} />
		{/if}
		<div class="pb">
			<h2>{p.name}</h2>
			{#if p.verified}<span class="ver"><LineIcon name="check" size={16} /> {m.mo_verified()}</span
				>{/if}
			{#if c.rating !== null}<span class="rt"
					><span class="star" aria-hidden="true">★</span>
					{m.mo_rating({ rating: c.rating, n: c.reviewCount })}</span
				>{/if}
			{#if p.subjects.length}<span class="subs"
					><LineIcon name="book" size={16} /> {p.subjects.join(' • ')}</span
				>{/if}
		</div>
		<div class="pacts btn-row">
			<a class="btn btn-secondary" href="/tutor/settings/profile"
				><LineIcon name="pencil" size={16} /> {m.mo_edit()}</a
			>
			{#if p.verified}<a class="btn btn-secondary" href="/t/{p.slug}">{m.mo_preview()}</a>{/if}
		</div>
	</section>

	<div class="stats4">
		<a href="/tutor/students"
			><LineIcon name="tutors" size={26} /><strong>{c.students}</strong><span
				>{m.mo_students()}</span
			></a
		>
		<a href="/tutor/calendar?view=all"
			><LineIcon name="calendar" size={26} /><strong>{c.lessonsDone}</strong><span
				>{m.mo_lessons()}</span
			></a
		>
		<a href="#achievements"
			><LineIcon name="trophy" size={26} /><strong>{earned}</strong><span
				>{m.mo_achievements()}</span
			></a
		>
		<a href="/tutor/reviews"
			><LineIcon name="star" size={26} /><strong>{c.rating ?? '–'}</strong><span
				>{m.mo_rating_l()}</span
			></a
		>
	</div>

	<!-- B. my teaching day -->
	<section class="block" aria-labelledby="day-h">
		<div class="bh">
			<h2 id="day-h">{m.mo_day()}</h2>
			<a href="/tutor/day">{m.mo_open_day()} <LineIcon name="chevron" size={16} /></a>
		</div>
		<div class="daycard">
			<div class="datebox">
				<span>{fmtWeekday(now)}</span>
				<strong>{fmtDay(now).split(' ')[1]}</strong>
				<span>{fmtDay(now).split(' ')[2]}</span>
			</div>
			<div class="dayb">
				<strong
					>{data.day.lessons.length === 1
						? m.mo_one_lesson_today()
						: m.mo_lessons_today({ n: data.day.lessons.length })}</strong
				>
				<ul>
					{#each data.day.lessons.slice(0, 3) as l (l.id)}
						<li>
							<a href="/tutor/lessons/{l.id}"
								>{fmtTime(l.startsAt)} – {l.who.join(', ') || m.tut3_nobody()} ({l.subjectName ??
									m.intro_chat()})</a
							>
						</li>
					{/each}
				</ul>
				<span class="small muted"
					>{data.day.tasks.length
						? m.mo_tasks({ done: tasksDone, total: data.day.tasks.length })
						: m.mo_no_tasks()}{data.day.toCheck
						? ` · ${m.mo_to_mark({ n: data.day.toCheck })}`
						: ''}</span
				>
			</div>
		</div>
		<div class="btn-row">
			<a class="btn navy" href="/tutor/day">{m.mo_plan_day()}</a>
			<a class="btn btn-secondary" href="/tutor/calendar">{m.mo_view_schedule()}</a>
		</div>
	</section>

	<!-- C. student success and teaching impact -->
	<section class="block" aria-labelledby="succ-h">
		<div class="bh">
			<h2 id="succ-h"><LineIcon name="progress" size={22} /> {m.mo_success()}</h2>
		</div>
		{#if c.improved.length}
			<ul class="succ">
				{#each c.improved as s (s.id)}
					<li>
						<Face name={s.name} size={56} />
						<div class="sb">
							<a href="/tutor/students/{s.id}">{s.name}</a>
							{#if s.subjects.length}<span class="small muted">{s.subjects.join(' • ')}</span>{/if}
							<strong class="up">↑ {s.first}% → {s.latest}%</strong>
						</div>
						<span class="gain">+{s.latest - s.first}</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="note">{m.mo_success_none()}</p>
		{/if}
		{#each c.feedback as f, i (i)}
			<blockquote class="fb">
				<p>“{f.text}”</p>
				<footer class="small muted">{f.name} · {f.rating}/5</footer>
			</blockquote>
		{/each}
	</section>

	<!-- D. my personal achievements -->
	<section class="block" id="achievements" aria-labelledby="ach-h">
		<div class="bh"><h2 id="ach-h"><LineIcon name="trophy" size={22} /> {m.mo_my_ach()}</h2></div>
		<p class="small muted">{m.mo_my_ach_lead()}</p>
		<ul class="ach">
			{#each c.achievements as a (a.key)}
				<li class:earned={a.earned}>
					<span class="ai"><LineIcon name={ACH_ICON[a.key]} size={26} /></span>
					<strong>{t(`ach_${a.key}_t`)}</strong>
					<span
						>{a.earned
							? t(`ach_${a.key}_d`, { n: a.n })
							: t(`ach_${a.key}_next`, { n: a.n, target: a.target ?? 0 })}</span
					>
				</li>
			{/each}
		</ul>
		{#if !c.hasTasks}<p class="small">
				<a href="/tutor/day">{m.mo_tasks_hint()}</a>
			</p>{/if}
	</section>

	<!-- E. teaching tools and resources -->
	<section class="block" aria-labelledby="tools-h">
		<div class="bh"><h2 id="tools-h"><LineIcon name="cog" size={22} /> {m.mo_tools()}</h2></div>
		<div class="tools">
			{#each TOOLS as [href, icon, title, hint] (href)}
				<a {href}
					><LineIcon name={icon} size={26} /><strong>{t(title)}</strong><span>{t(hint)}</span></a
				>
			{/each}
		</div>
	</section>

	<!-- F. account and settings -->
	<a class="settings" href="/tutor/more/settings"
		><span class="si"><LineIcon name="cog" size={22} /></span><span class="sb2"
			><strong>{m.mo_settings()}</strong><span class="small muted">{m.mo_settings_hint()}</span
			></span
		><LineIcon name="chevron" size={20} /></a
	>
	<form method="POST" action="/logout">
		<button class="btn btn-secondary btn-block" type="submit">{m.nav_logout()}</button>
	</form>
</section>

<style>
	header h1 {
		margin: 0;
	}
	header .lead {
		margin: 4px 0 0;
	}
	.prof {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 14px;
		align-items: center;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 24px;
		padding: 16px;
		box-shadow: var(--shadow-soft);
	}
	.ph {
		width: 84px;
		height: 84px;
		border-radius: 50%;
		object-fit: cover;
		box-shadow:
			0 0 0 3px #fff,
			0 0 0 5px var(--ocean);
	}
	.pb {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.pb h2 {
		margin: 0;
		font-size: 1.5rem;
		color: var(--navy);
	}
	.ver {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		background: var(--ice);
		color: var(--navy);
		border-radius: 99px;
		padding: 3px 10px;
		font-size: 0.8125rem;
		font-weight: 700;
	}
	.rt,
	.subs {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 0.875rem;
		color: var(--text);
	}
	.star {
		color: #e0a100;
	}
	.pacts {
		grid-column: 1 / -1;
	}
	.stats4 {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 6px;
	}
	.stats4 a {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 2px;
		padding: 12px 4px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 18px;
		color: var(--ocean);
		text-decoration: none;
	}
	.stats4 strong {
		font: 600 1.375rem var(--font-display);
		color: var(--navy);
	}
	.stats4 span {
		font-size: 0.6875rem;
		color: var(--text);
		line-height: 1.2;
	}
	.block {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.bh {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}
	.bh h2 {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 1.375rem;
		color: var(--navy);
	}
	.bh a {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--navy);
		font-weight: 600;
		font-size: 0.875rem;
		text-decoration: none;
	}
	.daycard {
		display: flex;
		gap: 14px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 22px;
		padding: 14px;
	}
	.datebox {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: var(--ice);
		border-radius: 16px;
		padding: 8px 14px;
		color: var(--navy);
		font-weight: 600;
		flex: none;
	}
	.datebox strong {
		font: 600 2rem var(--font-display);
		line-height: 1;
	}
	.dayb {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
		color: var(--navy);
	}
	.dayb ul {
		margin: 0;
		padding-left: 16px;
		font-size: 0.875rem;
	}
	.dayb a {
		color: var(--text);
	}
	.btn.navy {
		background: var(--navy);
		border-color: var(--navy);
	}
	.succ {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.succ li {
		display: flex;
		align-items: center;
		gap: 12px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 20px;
		padding: 12px;
	}
	.sb {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.sb a {
		font: 600 1.0625rem var(--font-display);
		color: var(--navy);
		text-decoration: none;
	}
	.up {
		color: var(--ok);
	}
	.gain {
		background: var(--ok-bg);
		color: var(--ok);
		border-radius: 99px;
		padding: 4px 10px;
		font-weight: 700;
		white-space: nowrap;
	}
	.fb {
		margin: 0;
		background: #fff;
		border-left: 4px solid var(--sky);
		border-radius: 12px;
		padding: 10px 14px;
	}
	.fb p {
		margin: 0;
	}
	.ach {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
	}
	.ach li {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 4px;
		padding: 12px 6px;
		background: #fff;
		border: 1px dashed var(--border-strong);
		border-radius: 18px;
		color: var(--muted);
	}
	.ach li.earned {
		border-style: solid;
		border-color: var(--border);
		color: var(--navy);
		box-shadow: var(--shadow-soft);
	}
	.ach li.earned .ai {
		color: #c48a00;
	}
	.ach strong {
		font-size: 0.8125rem;
		line-height: 1.2;
	}
	.ach span {
		font-size: 0.6875rem;
		line-height: 1.25;
	}
	.tools {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
	}
	.tools a {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 14px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 18px;
		color: var(--ocean);
		text-decoration: none;
	}
	.tools strong {
		color: var(--navy);
		font-size: 0.9375rem;
	}
	.tools span {
		color: var(--muted);
		font-size: 0.75rem;
		line-height: 1.3;
	}
	.settings {
		display: flex;
		align-items: center;
		gap: 12px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 20px;
		padding: 14px;
		color: var(--navy);
		text-decoration: none;
	}
	.si {
		width: 42px;
		height: 42px;
		border-radius: 12px;
		background: var(--ice);
		display: grid;
		place-items: center;
		color: var(--ocean);
	}
	.sb2 {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
</style>
