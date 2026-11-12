<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { fmtDay, fmtTime, localDate } from '#lib/tz.ts';
	import { READY_PCT_CLIENT } from '#lib/progress-ui.ts';
	let { data } = $props();
	const enc = $derived(encodeURIComponent(data.subject));
	const daysAgo = (d: Date) =>
		Math.round((Date.parse(localDate(data.now)) - Date.parse(localDate(d))) / 86_400_000);
	const last = $derived.by(() => {
		if (!data.lastStudied) return '';
		const n = daysAgo(data.lastStudied);
		return n <= 0 ? m.sh2_last_today() : n === 1 ? m.sh2_last_yesterday() : m.sh2_last_days({ n });
	});
	const nothing = $derived(
		!data.topics.length &&
			!data.results.length &&
			!data.homework.length &&
			!data.nextLesson &&
			!data.lessonsDone &&
			!data.lastStudied
	);
	const pctOf = (s: number, mx: number) => (mx > 0 ? Math.round((100 * s) / mx) : 0);
	const tone = (p: number) => (p >= READY_PCT_CLIENT ? 'good' : p >= 50 ? 'mid' : 'low');
</script>

<svelte:head><title>{data.subject} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/student/subjects">← {m.subj_back()}</a>
	<div>
		<h1>{data.subject}</h1>
		{#if last || data.lessonsDone}
			<p class="muted sub">
				{[
					last,
					data.lessonsDone === 0
						? ''
						: data.lessonsDone === 1
							? m.subj_lessons_one()
							: m.subj_lessons_many({ n: data.lessonsDone })
				]
					.filter(Boolean)
					.join(' · ')}
			</p>
		{/if}
	</div>

	<div class="acts">
		<a class="btn" href="/student/study?subject={enc}#focus">{m.subj_start()}</a>
		<a class="btn btn-secondary" href="/student/find?subject={enc}"
			>{m.subj_find({ subject: data.subject })}</a
		>
	</div>

	{#if nothing}
		<p class="softcard">{m.subj_new({ subject: data.subject })}</p>
	{/if}

	{#if data.nextLesson}
		<a class="navycard" href="/student/lessons/{data.nextLesson.id}">
			<span class="eyebrow">{m.sh_next_lesson()}</span>
			<strong>{fmtDay(data.nextLesson.startsAt)} · {fmtTime(data.nextLesson.startsAt)}</strong>
			{#if data.nextLesson.tutorName}<span class="sub">{data.nextLesson.tutorName}</span>{/if}
		</a>
	{/if}

	{#if !nothing}
		<section>
			<div class="section-h"><h2>{m.subj_topics()}</h2></div>
			{#if data.topics.length}
				<ul class="rows">
					{#each data.topics as tp (tp.topic)}
						<li>
							<span>{tp.topic}</span>
							<span class="score {tone(tp.pct)}">{tp.pct}%</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="muted small">{m.subj_topics_empty({ subject: data.subject })}</p>
			{/if}
		</section>

		<section>
			<div class="section-h"><h2>{m.subj_homework()}</h2></div>
			{#if data.homework.length}
				<ul class="rows">
					{#each data.homework as h (h.id)}
						<li>
							<a href="/student/homework">{h.title}</a>
							{#if h.dueOn}<span class="muted small"
									>{m.subj_due({ date: fmtDay(new Date(h.dueOn + 'T12:00:00Z')) })}</span
								>{/if}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="muted small">{m.subj_hw_empty({ subject: data.subject })}</p>
			{/if}
		</section>

		{#if data.results.length}
			<section>
				<div class="section-h">
					<h2>{m.subj_results()}</h2>
					<a href="/student/progress">{m.sh2_see_details()}</a>
				</div>
				<ul class="rows">
					{#each data.results as r (r.id)}
						<li>
							<span>{r.title}<span class="muted small block">{r.topic}</span></span>
							<span class="score {tone(pctOf(r.score, r.maxScore))}">{r.score}/{r.maxScore}</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
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
	.sub {
		margin: 6px 0 0;
	}
	.acts {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.navycard .eyebrow {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
	}
	.rows li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		min-height: 52px;
		padding: 8px 16px;
	}
	.rows li + li {
		border-top: 1px solid var(--border);
	}
	.rows a {
		color: var(--text);
		font-weight: 600;
	}
	.block {
		display: block;
	}
	.score {
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.score.good {
		color: var(--ok);
	}
	.score.mid {
		color: var(--ocean);
	}
	.score.low {
		color: var(--warn);
	}
</style>
