<script lang="ts">
	// Student Home: where am I, what can I continue, what next. Nothing else competes.
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay, fmtTime, localDate } from '#lib/tz.ts';
	import { formatMoney } from '#lib/money.ts';
	import LineIcon, { subjectIcon } from '#lib/components/LineIcon.svelte';
	let { data } = $props();

	const greet = $derived(
		data.partOfDay === 'morning'
			? m.sh2_good_morning({ name: data.firstName })
			: data.partOfDay === 'afternoon'
				? m.sh2_good_afternoon({ name: data.firstName })
				: m.sh2_good_evening({ name: data.firstName })
	);
	const isNew = $derived(!data.journey && !data.tiles.some((x) => x.mine));
	const subjectHref = (name: string) => `/student/subjects/${encodeURIComponent(name)}`;

	/** whole days between two Zimbabwe dates */
	const daysAgo = (d: Date) =>
		Math.round((Date.parse(localDate(data.now)) - Date.parse(localDate(d))) / 86_400_000);
	const lastStudied = $derived.by(() => {
		const j = data.journey;
		if (!j || j.from === 'running') return '';
		if (j.from === 'lesson') return m.sh2_last_lesson({ date: fmtDay(j.at) });
		const n = daysAgo(j.at);
		return n <= 0 ? m.sh2_last_today() : n === 1 ? m.sh2_last_yesterday() : m.sh2_last_days({ n });
	});
	const resumeHref = $derived(
		!data.journey
			? '/student/subjects'
			: data.journey.from === 'running'
				? '/student/study'
				: data.journey.from === 'lesson'
					? subjectHref(data.journey.subject)
					: `/student/study?subject=${encodeURIComponent(data.journey.subject)}#focus`
	);

	const dayWord = (d: Date) => {
		const today = localDate(data.now);
		const tomorrow = localDate(new Date(data.now.getTime() + 86_400_000));
		const day = localDate(d);
		return day === today ? m.sh_today() : day === tomorrow ? m.sh_tomorrow() : fmtDay(d);
	};
	const weekPct = $derived(
		data.week.planned ? Math.min(100, Math.round((100 * data.week.done) / data.week.planned)) : 0
	);
</script>

<svelte:head><title>{m.v3_nav_home()} · Tutora</title></svelte:head>

<div class="home">
	<header class="welcome">
		<h1>{greet}</h1>
		<p>{isNew ? m.sh2_welcome() : m.sh2_keep_going()}</p>
	</header>

	<!-- A. the one feature card: what to continue (real activity only) -->
	<a class="navycard journey" href={resumeHref}>
		<span class="eyebrow">{m.sh2_journey()}</span>
		{#if data.journey}
			<strong class="j-title"
				>{data.journey.from === 'running'
					? m.sh2_studying_now({ subject: data.journey.subject })
					: m.sh2_continue({ subject: data.journey.subject })}</strong
			>
			{#if data.journey.topic}<span class="sub">{data.journey.topic}</span>{/if}
			{#if lastStudied}<span class="sub">{lastStudied}</span>{/if}
			<span class="btn j-btn"
				>{data.journey.from === 'running' ? m.sh2_back_to_session() : m.sh2_resume()}
				<span aria-hidden="true">→</span></span
			>
		{:else}
			<strong class="j-title">{m.sh2_start_title()}</strong>
			<span class="sub">{m.sh2_start_sub()}</span>
			<span class="btn j-btn">{m.sh2_explore()} <span aria-hidden="true">→</span></span>
		{/if}
	</a>

	<!-- B. subjects: the student's own first, then subjects to explore -->
	<section aria-labelledby="subj-h">
		<div class="section-h">
			<h2 id="subj-h">{m.sh2_your_subjects()}</h2>
			<a href="/student/subjects">{m.sh2_view_all()} <span aria-hidden="true">→</span></a>
		</div>
		<ul class="tiles">
			{#each data.tiles as s (s.name)}
				<li>
					<a class="tile" href={subjectHref(s.name)}
						><LineIcon name={subjectIcon(s.name)} size={26} /><span>{s.name}</span></a
					>
				</li>
			{/each}
			<li>
				<a class="tile" href="/student/subjects"
					><LineIcon name="more" size={26} /><span>{m.sh2_more()}</span></a
				>
			</li>
		</ul>
	</section>

	<!-- C. one next step: something that needs you, else the next lesson, else book one -->
	{#if data.urgent}
		<a class="step glass" href={data.urgent.link}>
			<span class="step-text">
				<span class="eyebrow">{m.sh2_next_step()}</span>
				<strong
					>{data.urgent.kind === 'owe'
						? m.att_owe({
								amount: formatMoney(
									Number(data.urgent.text.values.amount),
									String(data.urgent.text.values.currency) as 'USD'
								),
								name: String(data.urgent.text.values.name)
							})
						: t(data.urgent.text.key, data.urgent.text.values)}</strong
				>
			</span>
			<span class="go" aria-hidden="true">→</span>
		</a>
	{:else if data.next}
		<a class="step glass" href="/student/lessons/{data.next.id}">
			<span class="step-text">
				<span class="eyebrow">{m.sh_next_lesson()}</span>
				<strong
					>{data.next.kind === 'intro'
						? m.sh_intro_with({ tutor: data.next.tutorName ?? '' })
						: m.sh_lesson_with({
								subject: data.next.subjectName ?? '',
								tutor: data.next.tutorName ?? ''
							})}</strong
				>
				<span class="muted">{dayWord(data.next.startsAt)} · {fmtTime(data.next.startsAt)}</span>
			</span>
			<span class="go" aria-hidden="true">→</span>
		</a>
	{:else}
		<a class="step glass" href="/student/find">
			<span class="step-text">
				<span class="eyebrow">{m.sh2_next_step()}</span>
				<strong>{m.sh2_book_title()}</strong>
				<span class="muted">{m.sh2_book_sub()}</span>
			</span>
			<span class="go" aria-hidden="true">→</span>
		</a>
	{/if}

	<!-- D/E. homework, then study progress -->
	<div class="pair">
		<a class="mini" href="/student/homework">
			<span class="eyebrow">{m.sh2_homework()}</span>
			<strong
				>{data.due === 0
					? m.sh2_hw_none()
					: data.due === 1
						? m.sh2_hw_one()
						: m.sh2_hw_many({ n: data.due })}</strong
			>
			<span class="link">{m.sh2_view_homework()} <span aria-hidden="true">→</span></span>
		</a>
		<a
			class="mini"
			href={data.week.planned || data.week.done ? '/student/progress' : '/student/study'}
		>
			<span class="eyebrow">{m.sh2_progress()}</span>
			{#if data.week.planned}
				<strong>{m.sh2_week({ done: data.week.done, planned: data.week.planned })}</strong>
				<span
					class="meter"
					role="img"
					aria-label={m.sh2_week({ done: data.week.done, planned: data.week.planned })}
					><span style="width:{weekPct}%"></span></span
				>
			{:else if data.week.done}
				<strong
					>{data.week.done === 1
						? m.sh2_week_one()
						: m.sh2_week_many({ n: data.week.done })}</strong
				>
			{:else}
				<strong>{m.sh2_no_plan()}</strong>
			{/if}
			{#if data.streak}<span class="muted small"
					>{data.streak === 1 ? m.sh2_streak_one() : m.sh2_streak({ n: data.streak })}</span
				>{/if}
			<span class="link"
				>{data.week.planned || data.week.done ? m.sh2_see_details() : m.sh2_make_plan()}
				<span aria-hidden="true">→</span></span
			>
		</a>
	</div>
</div>

<style>
	.home {
		max-width: 720px;
		margin: 0 auto;
		padding: 10px 20px 32px;
		display: flex;
		flex-direction: column;
		gap: 22px;
	}
	.welcome h1 {
		margin: 0;
		font-size: 1.75rem;
		line-height: 1.15;
		color: var(--navy);
		letter-spacing: -0.01em;
	}
	.welcome p {
		margin: 6px 0 0;
		color: var(--muted);
	}
	.eyebrow {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
	}

	/* A. learning journey */
	.journey {
		gap: 8px;
		padding: 22px 20px 20px;
		min-height: 176px;
	}
	.journey .eyebrow {
		color: var(--on-navy);
	}
	.j-title {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 1.75rem;
		line-height: 1.12;
		color: #fff;
	}
	.journey .sub {
		color: var(--on-navy);
		font-size: 0.9375rem;
	}
	.j-btn {
		align-self: flex-start;
		margin-top: 8px;
		min-height: 46px;
		padding: 0 20px;
	}
	.journey:hover .j-btn {
		background: #fff;
		border-color: #fff;
	}

	/* B. subjects */
	.section-h {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
		margin-bottom: 12px;
	}
	.section-h h2 {
		margin: 0;
		font-size: 1.25rem;
		color: var(--navy);
	}
	.section-h a {
		font-weight: 600;
		font-size: 0.9375rem;
		color: var(--ocean);
		text-decoration: none;
		padding: 10px 0;
	}
	.tiles {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 10px;
	}
	.tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 92px;
		padding: 12px 3px;
		border-radius: 16px;
		background: linear-gradient(180deg, rgb(255 255 255 / 0.82), rgb(231 240 250 / 0.7));
		border: 1px solid var(--glass-border);
		box-shadow: var(--shadow-soft);
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
		color: var(--ocean);
		text-decoration: none;
	}
	.tile span {
		color: var(--text);
		font-size: 0.75rem;
		font-weight: 600;
		text-align: center;
		line-height: 1.2;
		letter-spacing: -0.01em;
		/* whole words: long names wrap between words, never mid-word */
		overflow-wrap: normal;
		hyphens: manual;
	}
	.tile:hover {
		border-color: var(--border-strong);
	}

	/* C. next step */
	.glass {
		background: var(--glass);
		border: 1px solid var(--glass-border);
		box-shadow: var(--shadow-soft);
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
	}
	.step {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 16px 16px 16px 18px;
		border-radius: 18px;
		color: var(--text);
		text-decoration: none;
	}
	.step-text {
		display: flex;
		flex-direction: column;
		gap: 3px;
		flex: 1;
		min-width: 0;
	}
	.step strong {
		font-size: 1.0625rem;
		color: var(--navy);
	}
	.step .muted {
		font-size: 0.875rem;
	}
	.go {
		flex: none;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--navy);
		color: #fff;
		font-size: 1.125rem;
	}

	/* D/E. homework and progress */
	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.mini {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 16px;
		border-radius: 18px;
		background: #fff;
		border: 1px solid var(--border);
		color: var(--text);
		text-decoration: none;
	}
	.mini strong {
		font-size: 1rem;
		line-height: 1.3;
		color: var(--navy);
	}
	.mini .link {
		margin-top: auto;
		padding-top: 6px;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--ocean);
	}
	.meter {
		display: block;
		height: 6px;
		border-radius: 99px;
		background: var(--ice);
		overflow: hidden;
	}
	.meter span {
		display: block;
		height: 100%;
		border-radius: 99px;
		background: linear-gradient(90deg, var(--ocean), var(--sky));
	}
	@media (max-width: 359px) {
		.pair {
			grid-template-columns: 1fr;
		}
		.tiles {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (min-width: 600px) {
		.tile span {
			font-size: 0.875rem;
		}
	}
	@media (min-width: 900px) {
		.home {
			padding-top: 40px;
			gap: 28px;
		}
		.welcome h1 {
			font-size: 2.125rem;
		}
		.journey {
			padding: 28px 28px 26px;
		}
		.j-title {
			font-size: 2.125rem;
		}
	}
	@media (prefers-reduced-transparency: reduce) {
		.tile,
		.glass {
			-webkit-backdrop-filter: none;
			backdrop-filter: none;
			background: #fff;
		}
	}
</style>
