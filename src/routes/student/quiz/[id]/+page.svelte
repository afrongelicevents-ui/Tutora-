<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDate, fromLocal } from '#lib/tz.ts';
	import QuestionList from '#lib/components/study/QuestionList.svelte';
	import AnswerReview from '#lib/components/study/AnswerReview.svelte';
	let { data, form } = $props();
	const q = $derived(data.quiz);
</script>

<svelte:head><title>{q.title} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/student/study" aria-label={m.st5_back_study()}>‹</a>
	<span class="eyebrow"
		>{q.kind === 'test' ? m.st5_kind_test() : m.st5_kind_quiz()} · {q.subject}</span
	>
	<h1>{q.title}</h1>
	<p class="note">
		{q.topic} · {m.st5_from_tutor({ name: q.tutorName })}{q.dueOn
			? ` · ${m.st5_due({ date: fmtDate(fromLocal(q.dueOn)) })}`
			: ''}
	</p>
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}

	{#if form?.marked}
		<div class="score">
			<span class="bignum">{form.marked.score}/{form.marked.maxScore}</span>
			<span class="lead">{m.st5_quiz_saved()}</span>
		</div>
		<AnswerReview items={form.marked.review} />
		<a class="btn btn-secondary" href="/student/study">{m.st5_back_study()}</a>
	{:else if q.doneAt}
		<div class="score">
			{#if q.result}<span class="bignum">{q.result.score}/{q.result.maxScore}</span>{/if}
			<span class="lead">{m.st5_quiz_done_on({ date: fmtDate(q.doneAt) })}</span>
		</div>
		<a class="btn btn-secondary" href="/student/study">{m.st5_back_study()}</a>
	{:else if q.questions.length}
		<p class="lead">
			{q.questions.length === 1
				? m.st5_quiz_lead_one()
				: m.st5_quiz_lead({ n: q.questions.length })}
		</p>
		<form method="POST" class="stack">
			<QuestionList questions={q.questions} />
			<button class="btn btn-block" type="submit">{m.st5_quiz_submit()}</button>
		</form>
	{:else}
		<p class="note">{m.st5_quiz_no_questions()}</p>
	{/if}
</div>

<style>
	.score {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
</style>
