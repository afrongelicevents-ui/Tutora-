<script lang="ts">
	// "You": profile, personal progress, today's plan, Family Connection, exams and achievements.
	import { m, t } from '#lib/i18n.ts';
	import { fmtMinutes } from '#lib/tz.ts';
	import LineIcon from '#lib/components/LineIcon.svelte';
	import { KIND_ICON } from '#lib/components/schedule/kinds.ts';
	let { data } = $props();

	const initials = $derived(
		data.name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0]!.toUpperCase())
			.join('')
	);
	const dayPct = $derived(data.personal.pct);
	const C = 2 * Math.PI * 42;
	const names = $derived(
		data.family.length <= 1
			? (data.family[0]?.name ?? '')
			: `${data.family
					.slice(0, -1)
					.map((f) => f.name)
					.join(', ')} ${m.and_word()} ${data.family.at(-1)!.name}`
	);
	const sees = $derived(
		[
			data.sees.progress && m.me_see_progress(),
			data.sees.lessons && m.me_see_lessons(),
			data.sees.homework && m.me_see_homework(),
			data.sees.study && m.me_see_study()
		].filter(Boolean) as string[]
	);
</script>

<svelte:head><title>{m.me_title()} · Tutora</title></svelte:head>

<h1 class="sr-only">{m.me_title()}</h1>

<div class="me">
	<!-- profile -->
	<section class="profile">
		{#if data.photoUrl}
			<img class="me-avatar" src={data.photoUrl} alt="" width="76" height="76" />
		{:else}
			<span class="me-avatar" aria-hidden="true">{initials}</span>
		{/if}
		<div class="who">
			<h2>{data.name}</h2>
			<ul>
				<li><LineIcon name="user" size={18} />{m.me_student()}</li>
				{#if data.school}<li><LineIcon name="school" size={18} />{data.school}</li>{/if}
				{#if data.email}<li class="mail"><LineIcon name="mail" size={18} />{data.email}</li>{/if}
			</ul>
			{#if data.bio}<p class="bio">{data.bio}</p>{/if}
		</div>
		<a class="edit" href="/student/me/edit"><LineIcon name="pencil" size={16} />{m.me_edit()}</a>
	</section>

	<!-- personal progress -->
	<section class="panel">
		<div class="panel-h">
			<h2><LineIcon name="trophy" />{m.me_progress()}</h2>
			<a href="/student/report">{m.me_view_details()} <span aria-hidden="true">→</span></a>
		</div>
		<div class="stats">
			<div class="stat">
				{#if dayPct !== null}
					<a class="ringlink" href="/student/planner">
						<svg
							viewBox="0 0 100 100"
							class="ring"
							role="img"
							aria-label="{m.me_day_planned()} {dayPct}%"
						>
							<defs
								><linearGradient id="meg" x1="0" y1="0" x2="1" y2="1"
									><stop offset="0" stop-color="#6fb3ea" /><stop
										offset="1"
										stop-color="#1a5fae"
									/></linearGradient
								></defs
							>
							<circle cx="50" cy="50" r="42" class="track" />
							{#if dayPct}<circle
									cx="50"
									cy="50"
									r="42"
									class="bar"
									stroke-dasharray="{(C * dayPct) / 100} {C}"
								/>{/if}
							<text x="50" y="57" text-anchor="middle">{dayPct}%</text>
						</svg>
					</a>
					<span class="label">{m.me_day_planned()}</span>
				{:else}
					<a class="plan-btn" href="/student/schedule">{m.me_plan_day()}</a>
				{/if}
			</div>
			<a class="stat" href="/student/planner#tasks">
				<span class="ic"><LineIcon name="check" /></span>
				<strong>{data.personal.tasksDone} / {data.personal.tasksTotal}</strong>
				<span class="label">{m.me_tasks_done()}</span>
			</a>
			<a class="stat" href="/student/planner#goals">
				<span class="ic gold"><LineIcon name="trophy" /></span>
				<strong>{data.personal.achievements}</strong>
				<span class="label">{m.me_achievements()}</span>
			</a>
			<a class="stat" href="/student/report#checkin">
				<span class="ic"><LineIcon name="eye" /></span>
				{#if data.personal.feel}
					<strong class="feel">{t(`ci_${data.personal.feel}`)}</strong>
				{:else}
					<strong class="feel cta">{m.me_check_in()}</strong>
				{/if}
				<span class="label">{m.me_feel()}</span>
			</a>
		</div>
		<p class="consist">
			{data.personal.consistency !== null
				? m.me_consistency_line({ pct: data.personal.consistency })
				: m.me_consistency_none()}
		</p>
	</section>

	<!-- today's plan -->
	<section class="panel">
		<div class="panel-h">
			<h2><LineIcon name="calendar" />{m.me_schedule()}</h2>
			<a href="/student/planner">{m.me_view_schedule()} <span aria-hidden="true">→</span></a>
		</div>
		{#if data.blocks.length}
			<div class="sched">
				<ul>
					{#each data.blocks.slice(0, 4) as b (b.key)}
						<li class:done={b.done}>
							<span class="bi k-{b.kind}"><LineIcon name={KIND_ICON[b.kind]} size={20} /></span>
							<span class="t">{fmtMinutes(b.start)} – {fmtMinutes(b.end % 1440)}</span>
							<span
								>{b.kind === 'study'
									? `${b.subject}${b.label ? ` · ${b.label}` : ''}`
									: (b.label ?? t(`ps_k_${b.kind}`))}</span
							>
						</li>
					{/each}
				</ul>
				{#if data.today.length}
					<span class="chip" class:warn={!data.onTrack}
						>{#if data.onTrack}<LineIcon name="check" size={18} />{/if}{data.onTrack
							? m.me_on_track()
							: m.me_missed()}</span
					>
				{/if}
			</div>
		{:else}
			<p class="muted empty">
				{m.me_no_schedule()} <a href="/student/schedule">{m.me_make_schedule()} →</a>
			</p>
		{/if}
	</section>

	<!-- Family Connection -->
	<section class="panel family">
		<div class="fam-main">
			<h2><LineIcon name="family" size={26} />{m.me_family()}</h2>
			<p class="muted">
				{data.family.length ? m.me_family_with({ names }) : m.me_family_none()}
			</p>
			<a class="btn" href="/student/family"
				>{data.family.length ? m.me_family_manage() : `+ ${m.me_family_add()}`}</a
			>
		</div>
		<div class="fam-side">
			<LineIcon name="eye" />
			{#if data.family.length}
				<span>{m.me_they_view()}</span>
				<span>{sees.length ? sees.join(', ') : m.me_they_nothing()}</span>
			{:else}
				<span>{m.me_they_choose()}</span>
				<span>{m.me_they_choose_list()}</span>
			{/if}
		</div>
	</section>

	<!-- exams and achievements -->
	<section class="panel">
		<div class="panel-h">
			<h2><LineIcon name="target" />{m.me_goals()}</h2>
			<a href="/student/progress">{m.me_view_all()} <span aria-hidden="true">→</span></a>
		</div>
		<div class="goals">
			<a href="/student/study">
				<span class="gi"><LineIcon name="target" size={26} /></span>
				<span
					><strong>{m.me_exams()}</strong><span
						>{data.examsAhead ? m.me_exams_n({ n: data.examsAhead }) : m.me_exams_none()}</span
					></span
				>
				<span class="chev" aria-hidden="true">›</span>
			</a>
			<a href="/student/progress#topics">
				<span class="gi gold"><LineIcon name="trophy" size={26} /></span>
				<span
					><strong>{m.me_ready()}</strong><span class="ok"
						>{m.me_ready_n({ n: data.topicsReady })}</span
					></span
				>
				<span class="chev" aria-hidden="true">›</span>
			</a>
		</div>
	</section>

	<a class="account" href="/account">{m.me_account()} <span aria-hidden="true">›</span></a>
</div>

<style>
	.me {
		max-width: 760px;
		margin: 0 auto;
		width: 100%;
		padding: 8px 16px 32px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	/* profile card: the first thing on the page */
	.profile {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 14px;
		align-items: center;
		padding: 16px;
		border-radius: 22px;
		background: rgb(255 255 255 / 0.92);
		border: 1px solid var(--glass-border);
		box-shadow: var(--shadow-soft);
		-webkit-backdrop-filter: blur(10px);
		backdrop-filter: blur(10px);
		position: relative;
	}
	.me-avatar {
		display: grid;
		place-items: center;
		width: 76px;
		height: 76px;
		border-radius: 50%;
		background: linear-gradient(160deg, #dcebfa, #b9d6f3);
		box-shadow:
			0 0 0 3px #fff,
			0 0 0 5px var(--ocean);
		color: var(--navy);
		font: 600 1.625rem var(--font-display);
	}
	img.me-avatar {
		object-fit: cover;
		background: #fff;
	}
	.bio {
		margin: 6px 0 0;
		font-size: 0.875rem;
		line-height: 1.45;
		color: var(--text);
		overflow-wrap: anywhere;
	}
	.who h2 {
		margin: 0 0 4px;
		font-size: 1.375rem;
		color: var(--navy);
		padding-right: 4px;
	}
	.who ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
		font-size: 0.875rem;
		color: var(--text);
	}
	.who li {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.who li :global(svg) {
		color: var(--ocean);
		flex: none;
	}
	.mail {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.edit {
		grid-column: 1 / -1;
		justify-self: start;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 40px;
		padding: 0 14px;
		border-radius: 99px;
		background: var(--ice);
		color: var(--ocean);
		font-size: 0.875rem;
		font-weight: 600;
		text-decoration: none;
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
		margin-bottom: 12px;
	}
	.panel-h h2,
	.fam-main h2 {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 0;
		font-family: var(--font);
		font-size: 1rem;
		font-weight: 700;
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
	.stats {
		display: grid;
		grid-template-columns: 1.15fr repeat(3, minmax(0, 1fr));
	}
	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 0 4px;
		text-align: center;
		min-width: 0;
	}
	.stat + .stat {
		border-left: 1px solid var(--border);
	}
	.stat .ic {
		color: var(--ocean);
	}
	.stat .gold {
		color: #c48a00;
	}
	a.stat {
		text-decoration: none;
		color: inherit;
	}
	.ringlink {
		display: block;
		line-height: 0;
	}
	.feel {
		font-size: 0.875rem !important;
		line-height: 1.2 !important;
	}
	.feel.cta {
		color: var(--ocean) !important;
	}
	.plan-btn {
		display: grid;
		place-items: center;
		text-align: center;
		width: 72px;
		height: 72px;
		border-radius: 50%;
		background: var(--navy);
		color: #fff;
		font-size: 0.75rem;
		font-weight: 700;
		line-height: 1.15;
		text-decoration: none;
		padding: 6px;
	}
	.consist {
		margin: 10px 0 0;
		font-size: 0.75rem;
		color: var(--muted);
		text-align: center;
	}
	.stat strong {
		font-size: 1.25rem;
		color: var(--navy);
		line-height: 1.1;
	}
	.label {
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
		stroke: url(#meg);
		stroke-width: 9;
		stroke-linecap: round;
		transform: rotate(-90deg);
		transform-origin: 50% 50%;
	}
	.ring text {
		font: 700 20px var(--font);
		fill: var(--navy);
	}
	.sched {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
	}
	.sched ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: 0.9375rem;
	}
	.sched li {
		display: grid;
		grid-template-columns: 24px 128px minmax(0, 1fr);
		align-items: center;
		gap: 10px;
		color: var(--navy);
		font-weight: 600;
	}
	.sched li.done {
		color: var(--muted);
		text-decoration: line-through;
		font-weight: 400;
	}
	.bi {
		color: var(--ocean);
		display: grid;
		place-items: center;
	}
	.bi.k-school {
		color: #e0a100;
	}
	.sched .t {
		color: var(--muted);
		font-weight: 400;
		font-variant-numeric: tabular-nums;
		font-size: 0.8125rem;
		padding-top: 2px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		border-radius: 99px;
		background: var(--ok-bg);
		color: var(--ok);
		font-size: 0.8125rem;
		font-weight: 700;
		white-space: nowrap;
	}
	.chip.warn {
		background: var(--warn-bg);
		color: var(--warn);
	}
	/* family */
	.family {
		display: grid;
		grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
		gap: 14px;
		align-items: center;
	}
	.fam-main {
		display: flex;
		flex-direction: column;
		gap: 8px;
		align-items: flex-start;
	}
	.fam-main h2 :global(svg) {
		color: var(--ocean);
	}
	.fam-main p {
		margin: 0;
		font-size: 0.875rem;
	}
	.fam-main .btn {
		min-height: 46px;
		background: var(--navy);
		border-color: var(--navy);
	}
	.fam-side {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding-left: 12px;
		border-left: 1px solid var(--border);
		text-align: center;
		font-size: 0.75rem;
		color: var(--muted);
	}
	.fam-side :global(svg) {
		color: var(--navy);
		margin-bottom: 4px;
	}
	/* goals */
	.goals {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.goals a {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 10px;
		padding: 12px;
		border-radius: 16px;
		background: var(--snow);
		border: 1px solid var(--border);
		text-decoration: none;
		color: var(--text);
	}
	.goals a > span:nth-child(2) {
		display: flex;
		flex-direction: column;
		font-size: 0.8125rem;
	}
	.goals strong {
		color: var(--navy);
	}
	.goals a > span:nth-child(2) > span {
		color: var(--ocean);
		font-weight: 700;
		font-size: 0.9375rem;
	}
	.goals .ok {
		color: var(--ok) !important;
	}
	.gi {
		color: var(--ocean);
	}
	.gi.gold {
		color: #b9852f;
	}
	.chev {
		color: var(--muted);
		font-size: 1.25rem;
	}
	.account {
		display: flex;
		justify-content: space-between;
		align-items: center;
		min-height: 52px;
		padding: 0 16px;
		border-radius: 16px;
		background: #fff;
		border: 1px solid var(--border);
		color: var(--text);
		font-weight: 600;
		text-decoration: none;
	}
	@media (max-width: 520px) {
		.family {
			grid-template-columns: 1fr;
		}
		.fam-side {
			flex-direction: row;
			flex-wrap: wrap;
			justify-content: flex-start;
			gap: 6px;
			padding: 10px 0 0;
			border-left: 0;
			border-top: 1px solid var(--border);
			text-align: left;
		}
		.fam-side :global(svg) {
			margin: 0;
		}
		.goals {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 380px) {
		.stats {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			row-gap: 12px;
		}
		.stat:nth-child(3) {
			border-left: 0;
		}
		.family,
		.goals {
			grid-template-columns: 1fr;
		}
		.fam-side {
			border-left: 0;
			padding-left: 0;
		}
	}
	@media (min-width: 600px) {
		.profile {
			grid-template-columns: auto minmax(0, 1fr) auto;
		}
		.edit {
			grid-column: auto;
			align-self: start;
		}
	}
	@media (min-width: 900px) {
		.me {
			padding-top: 32px;
			gap: 20px;
		}
		.stat strong {
			font-size: 1.625rem;
		}
		.label {
			font-size: 0.8125rem;
		}
		.ring {
			width: 92px;
			height: 92px;
		}
	}
</style>
