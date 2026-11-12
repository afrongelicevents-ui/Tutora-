<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDate, fmtMinutes, fmtTime, fromLocal } from '#lib/tz.ts';
	import SessionTimer from '#lib/components/study/SessionTimer.svelte';
	let { data, form } = $props();

	const WEEK = [1, 2, 3, 4, 5, 6, 0];
	const dayName = (d: number) => t(`st5_day_${d}`);
	const slotsOn = (d: number) => data.plan.filter((p) => p.weekday === d);
	const stateLabel = (s: string) => t(`st5_state_${s}`);
	const stateClass = (s: string) =>
		s === 'done'
			? 'ok-t'
			: s === 'now' || s === 'next'
				? 'next-t'
				: s === 'missed'
					? 'warn-t'
					: 'muted';
	const openQuizzes = $derived(data.quizzes.filter((q) => !q.doneAt));
	const doneQuizzes = $derived(data.quizzes.filter((q) => q.doneAt).slice(0, 5));
	const errFor = (name: string) => (form?.error && form?.form === name ? t(form.error) : '');
	const generalErr = $derived(form?.error && !form?.form ? t(form.error) : '');
</script>

<svelte:head><title>{m.st5_study_title()} · Tutora</title></svelte:head>

<div class="screen">
	<h1>{m.st5_study_title()}</h1>
	{#if generalErr}<p class="alert" role="alert">{generalErr}</p>{/if}
	{#if form?.done}<p class="notice" role="status">{t(`st5_done_${form.done}`)}</p>{/if}

	{#if data.running}
		<section class="navycard" aria-labelledby="focus-h">
			<span class="eyebrow" id="focus-h">{m.st5_focus_now()}</span>
			<strong>{data.running.subject}{data.running.topic ? ` · ${data.running.topic}` : ''}</strong>
			<SessionTimer endsAt={data.running.endsAt} now={data.now} />
			<span class="sub"
				>{m.st5_started_until({
					start: fmtTime(data.running.startedAt),
					end: fmtTime(data.running.endsAt)
				})}</span
			>
			<div class="actions">
				<form method="POST" action="?/finish">
					<input type="hidden" name="id" value={data.running.id} />
					<button class="btn" type="submit">{m.st5_finish()}</button>
				</form>
				<form method="POST" action="?/stop">
					<input type="hidden" name="id" value={data.running.id} />
					<button class="btn btn-ghost" type="submit">{m.st5_stop()}</button>
				</form>
			</div>
			<span class="sub">{m.st5_finish_note()}</span>
		</section>
	{/if}

	<div class="stat3">
		<div>
			<strong>{data.streak}</strong><span
				>{data.streak === 1 ? m.st5_streak_one() : m.st5_streak_days()}</span
			>
		</div>
		<div>
			<strong>{m.st5_x_of_y({ x: data.week.done, y: data.week.planned })}</strong><span
				>{m.st5_week_sessions()}</span
			>
		</div>
		<div>
			<strong>{data.week.minutes}</strong><span>{m.st5_week_minutes()}</span>
		</div>
	</div>

	<section class="part">
		<div class="section-h"><h2>{m.st5_today_plan()}</h2></div>
		{#if data.todayPlan.length}
			<ul class="rows">
				{#each data.todayPlan as s (s.id)}
					<li>
						<span
							class:strike={s.state === 'done'}
							class:strong={s.state === 'now' || s.state === 'next'}
							>{fmtMinutes(s.startMinute)}
							{s.subject}{s.topic ? ` · ${s.topic}` : ''}
							<span class="small muted">· {m.st5_min({ n: s.minutes })}</span></span
						>
						<span class="right">
							<span class={stateClass(s.state)}>{stateLabel(s.state)}</span>
							{#if !data.running && s.state !== 'done'}
								<form method="POST" action="?/start">
									<input type="hidden" name="planItemId" value={s.id} />
									<button class="btn btn-secondary btn-sm" type="submit">{m.st5_start()}</button>
								</form>
							{/if}
						</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="note">{m.st5_today_empty()}</p>
		{/if}
		{#if !data.running}
			<details class="more" id="focus" open={form?.form === 'start' || !!data.prefillSubject}>
				<summary>{m.st5_free_session()}</summary>
				<form method="POST" action="?/start" class="stack">
					{#if errFor('start')}<p class="error" role="alert">{errFor('start')}</p>{/if}
					<div class="field">
						<label for="fs-subject">{m.st5_subject()}</label>
						<input
							id="fs-subject"
							name="subject"
							required
							maxlength="60"
							value={data.prefillSubject}
						/>
					</div>
					<div class="field">
						<label for="fs-topic">{m.st5_topic_opt()}</label>
						<input id="fs-topic" name="topic" maxlength="80" />
					</div>
					<div class="field">
						<label for="fs-min">{m.st5_minutes()}</label>
						<input id="fs-min" name="minutes" type="number" min="5" max="240" value="25" required />
					</div>
					<button class="btn" type="submit">{m.st5_start_focus()}</button>
				</form>
			</details>
		{/if}
	</section>

	<a class="softcard check" href="/student/check">
		<span class="eyebrow">{m.st5_check_eyebrow()}</span>
		{#if data.check}
			<strong>{m.st5_check_done_today({ x: data.check.score, y: data.check.maxScore })}</strong>
			<span class="small">{m.st5_check_come_back()}</span>
		{:else}
			<strong>{m.st5_check_cta()}</strong>
			<span class="small">{m.st5_check_cta_sub()}</span>
		{/if}
	</a>

	<section class="part">
		<div class="section-h"><h2>{m.st5_quizzes()}</h2></div>
		{#if data.quizzes.length}
			<ul class="rows">
				{#each openQuizzes as q (q.id)}
					<li>
						<a href="/student/quiz/{q.id}" class="grow"
							><strong>{q.title}</strong><span class="small muted block"
								>{q.subject} · {q.topic} · {q.tutorName}</span
							></a
						>
						<span class="next-t"
							>{q.dueOn ? m.st5_due({ date: fmtDate(fromLocal(q.dueOn)) }) : m.st5_open()}</span
						>
					</li>
				{/each}
				{#each doneQuizzes as q (q.id)}
					<li>
						<a href="/student/quiz/{q.id}" class="grow"
							><span>{q.title}</span><span class="small muted block">{q.subject} · {q.topic}</span
							></a
						>
						<span class="ok-t">{m.st5_state_done()}</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="note">{m.st5_quizzes_empty()}</p>
		{/if}
	</section>

	<section class="part">
		<div class="section-h"><h2>{m.st5_exams()}</h2></div>
		{#if data.exams.length}
			<ul class="rows">
				{#each data.exams as e (e.id)}
					<li class="exam">
						<div class="grow">
							<strong>{e.subject} · {e.title}</strong>
							<span class="small muted block"
								>{#if e.daysLeft !== null}{e.daysLeft === 0
										? m.st5_exam_today()
										: e.daysLeft === 1
											? m.st5_day_left()
											: m.st5_days_left({ n: e.daysLeft })}{:else}{m.st5_no_date()}{/if}</span
							>
							<span class="small"
								>{m.st5_topics_ready({ x: e.ready, y: e.total })}{#if e.topics.length}:
									{e.topics
										.map((tp) =>
											tp.pct === null
												? `${tp.topic} (${m.st5_no_results()})`
												: `${tp.topic} ${tp.pct}%`
										)
										.join(', ')}{/if}</span
							>
						</div>
						<form method="POST" action="?/removeExam">
							<input type="hidden" name="id" value={e.id} />
							<button class="btn-link small" type="submit">{m.st5_remove()}</button>
						</form>
					</li>
				{/each}
			</ul>
			<p class="note">{m.st5_ready_note()}</p>
		{:else}
			<p class="note">{m.st5_exams_empty()}</p>
		{/if}
		<details class="more" open={form?.form === 'exam'}>
			<summary>{m.st5_add_exam()}</summary>
			<form method="POST" action="?/addExam" class="stack">
				{#if errFor('exam')}<p class="error" role="alert">{errFor('exam')}</p>{/if}
				<div class="field">
					<label for="ex-subject">{m.st5_subject()}</label>
					<input id="ex-subject" name="subject" required maxlength="60" />
				</div>
				<div class="field">
					<label for="ex-title">{m.st5_exam_title()}</label>
					<input
						id="ex-title"
						name="title"
						required
						maxlength="120"
						placeholder={m.st5_exam_title_ph()}
					/>
				</div>
				<div class="field">
					<label for="ex-date">{m.st5_exam_date()}</label>
					<input id="ex-date" name="examOn" type="date" min={data.today} />
				</div>
				<div class="field">
					<label for="ex-topics">{m.st5_exam_topics()}</label>
					<span class="hint" id="ex-topics-hint">{m.st5_exam_topics_hint()}</span>
					<input id="ex-topics" name="topics" required aria-describedby="ex-topics-hint" />
				</div>
				<button class="btn" type="submit">{m.st5_add_exam()}</button>
			</form>
		</details>
	</section>

	<section class="part">
		<div class="section-h"><h2>{m.st5_week_plan()}</h2></div>
		{#if data.plan.length}
			<ul class="rows week">
				{#each WEEK as d (d)}
					<li>
						<span class="day">{dayName(d)}</span>
						<span class="slots">
							{#each slotsOn(d) as s (s.id)}
								<span class="slot">
									<span
										>{fmtMinutes(s.startMinute)} · {s.subject}{s.topic ? ` · ${s.topic}` : ''}
										<span class="muted">· {m.st5_min({ n: s.minutes })}</span></span
									>
									<form method="POST" action="?/removeSlot">
										<input type="hidden" name="id" value={s.id} />
										<button
											class="btn-link small"
											type="submit"
											aria-label={m.st5_remove_slot({
												day: dayName(d),
												time: fmtMinutes(s.startMinute)
											})}>{m.st5_remove()}</button
										>
									</form>
								</span>
							{:else}
								<span class="muted small">{m.st5_free_day()}</span>
							{/each}
						</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="note">{m.st5_plan_empty()}</p>
		{/if}
		<details class="more" open={form?.form === 'slot' || !data.plan.length}>
			<summary>{m.st5_add_slot()}</summary>
			<form method="POST" action="?/addSlot" class="stack">
				{#if errFor('slot')}<p class="error" role="alert">{errFor('slot')}</p>{/if}
				<div class="field">
					<label for="sl-day">{m.st5_day()}</label>
					<select id="sl-day" name="weekday">
						{#each WEEK as d (d)}<option value={d}>{dayName(d)}</option>{/each}
					</select>
				</div>
				<div class="two">
					<div class="field">
						<label for="sl-start">{m.st5_start_time()}</label>
						<input id="sl-start" name="start" type="time" value="16:00" required />
					</div>
					<div class="field">
						<label for="sl-min">{m.st5_minutes()}</label>
						<input id="sl-min" name="minutes" type="number" min="5" max="240" value="45" required />
					</div>
				</div>
				<div class="field">
					<label for="sl-subject">{m.st5_subject()}</label>
					<input id="sl-subject" name="subject" required maxlength="60" />
				</div>
				<div class="field">
					<label for="sl-topic">{m.st5_topic_opt()}</label>
					<input id="sl-topic" name="topic" maxlength="80" />
				</div>
				<button class="btn" type="submit">{m.st5_add_slot()}</button>
				<p class="note">{m.st5_plan_family_note()}</p>
			</form>
		</details>
	</section>
</div>

<style>
	.part {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.actions {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		margin-top: 8px;
	}
	.strike {
		color: var(--muted);
		text-decoration: line-through;
	}
	.strong {
		font-weight: 700;
	}
	.right {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
	}
	.grow {
		flex: 1;
		min-width: 0;
		color: inherit;
		text-decoration: none;
	}
	.check {
		text-decoration: none;
		color: var(--text);
	}
	.check strong {
		font-size: 1.0625rem;
	}
	.rows .exam {
		align-items: flex-start;
	}
	.exam .grow {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.week > li {
		align-items: flex-start;
	}
	.day {
		font-weight: 600;
		width: 3.5em;
		flex-shrink: 0;
	}
	.slots {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.slot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}
	.more {
		margin-top: 8px;
	}
	.more summary {
		cursor: pointer;
		font-weight: 600;
		color: var(--ocean);
		min-height: 44px;
		display: flex;
		align-items: center;
	}
	.two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	span.block {
		display: block;
	}
	.btn-sm {
		min-height: 40px;
	}
</style>
