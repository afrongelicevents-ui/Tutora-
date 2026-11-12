<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import QuestionList from '#lib/components/study/QuestionList.svelte';
	import AnswerReview from '#lib/components/study/AnswerReview.svelte';
	let { data, form } = $props();
</script>

<svelte:head><title>{m.st5_check_title()} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/student/study" aria-label={m.st5_back_study()}>‹</a>
	<h1>{m.st5_check_title()}</h1>
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}

	{#if form?.marked}
		<div class="score">
			<span class="bignum">{form.marked.score}/{form.marked.maxScore}</span>
			<span class="lead"
				>{form.marked.score === form.marked.maxScore
					? m.st5_all_right()
					: m.st5_well_done_check()}</span
			>
		</div>
		<AnswerReview items={form.marked.review} />
		<a class="btn btn-secondary" href="/student/study">{m.st5_back_study()}</a>
	{:else if data.done}
		<div class="score">
			<span class="bignum">{data.done.score}/{data.done.maxScore}</span>
			<span class="lead">{m.st5_check_done_lead()}</span>
		</div>
		<a class="btn btn-secondary" href="/student/study">{m.st5_back_study()}</a>
	{:else if data.questions.length && data.token}
		<p class="lead">{m.st5_check_lead({ n: data.questions.length })}</p>
		<form method="POST" class="stack">
			<input type="hidden" name="token" value={data.token} />
			<QuestionList questions={data.questions} />
			<button class="btn btn-block" type="submit">{m.st5_check_submit()}</button>
		</form>
	{:else}
		<div class="softcard">
			<strong>{m.st5_check_empty()}</strong>
			<span class="small">{m.st5_check_empty_sub()}</span>
		</div>
	{/if}
</div>

<style>
	.score {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
</style>
