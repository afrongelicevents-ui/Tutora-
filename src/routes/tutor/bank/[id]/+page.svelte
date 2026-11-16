<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import BankFields from '#lib/components/tests/BankFields.svelte';
	import QuestionTags from '#lib/components/tests/QuestionTags.svelte';
	let { data, form } = $props();
	const q = $derived(data.q);
	const draft = $derived(q.status === 'draft');
</script>

<svelte:head
	><title>{draft ? m.qb_check_draft() : m.st5_edit()} · {m.qb_title()} · Tutora</title></svelte:head
>

<div class="screen">
	<a
		class="back"
		href={draft ? '/tutor/bank?status=draft' : '/tutor/bank'}
		aria-label={m.qb_title()}>‹</a
	>
	<span class="eyebrow">{m.qb_title()}</span>
	<h1>{draft ? m.qb_check_draft() : m.st5_edit()}</h1>
	<QuestionTags q={{ ...q, maths: !!q.template, inQuiz: !!q.setId, hidden: !!q.hiddenAt }} />
	{#if draft}<p class="ui-card sky small">{m.qb_draft_check_lead()}</p>{/if}
	{#if form?.done}<p class="notice" role="status">{t(`qb_done_${form.done}`)}</p>{/if}
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}

	{#if data.examples.length}
		<section class="ui-card cream">
			<h2 class="small">{m.qb_examples()}</h2>
			<ul class="small plain">
				{#each data.examples as e, i (i)}<li>{e.prompt} → <strong>{e.answer}</strong></li>{/each}
			</ul>
		</section>
	{/if}

	<form method="POST" action="?/save" class="stack">
		<BankFields {q} maths={data.maths} key="q{q.id}" tags={data.tags} />
		{#if draft}
			<button class="btn" type="submit" name="approve" value="1">{m.qb_approve()}</button>
			<button class="btn btn-secondary" type="submit">{m.qb_save_draft()}</button>
		{:else}
			<button class="btn" type="submit">{m.st5_save()}</button>
		{/if}
	</form>

	<details class="sure">
		<summary>{m.st5_remove_question()}</summary>
		<form method="POST" action="?/remove" class="stack-s">
			<label class="small"
				><input type="checkbox" name="sure" required /> {m.qb_sure_remove()}</label
			>
			<button class="btn btn-warn btn-sm" type="submit">{m.st5_remove_question()}</button>
		</form>
	</details>
</div>

<style>
	.plain {
		margin: 0;
		padding-left: 18px;
	}
	.sure summary {
		cursor: pointer;
		color: var(--ocean);
		min-height: 44px;
		display: flex;
		align-items: center;
	}
	h2.small {
		margin: 0 0 6px;
	}
</style>
