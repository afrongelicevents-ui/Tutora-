<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import BankFields from '#lib/components/tests/BankFields.svelte';
	import QuestionTags from '#lib/components/tests/QuestionTags.svelte';
	let { data, form } = $props();
	const f = $derived(data.filter);
	const errFor = (name: string) => (form?.error && form?.form === name ? t(form.error) : '');
	const qs = (over: Record<string, string | number | undefined>) => {
		const parts = Object.entries({ ...f, ...over })
			.filter(([, v]) => v !== undefined && v !== '' && String(v) !== '0')
			.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
		return `?${parts.join('&')}`;
	};
	const chapters = $derived(
		[
			...new Set(
				data.tags.chapters
					.filter((c) => !f.subject || c.subject.toLowerCase() === f.subject.toLowerCase())
					.map((c) => c.chapter)
			)
		].sort()
	);
</script>

<svelte:head><title>{m.qb_title()} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/tutor/assessments" aria-label={m.st5_tutor_title()}>‹</a>
	<h1>{m.qb_title()}</h1>
	<p class="lead">{m.qb_lead()}</p>

	<nav class="tabs" aria-label={m.qb_title()}>
		<a href="/tutor/bank" aria-current={!data.shared ? 'page' : undefined}>{m.qb_mine()}</a>
		<a href="/tutor/bank?view=shared" aria-current={data.shared ? 'page' : undefined}
			>{m.qb_tutora_bank()}</a
		>
	</nav>

	{#if form?.done}<p class="notice" role="status">{t(`qb_done_${form.done}`)}</p>{/if}
	{#if data.made && !form}<p class="notice" role="status">{m.ai_made_n({ n: data.made })}</p>{/if}
	{#if form?.error && !form?.form?.startsWith('q') && !form?.form?.startsWith('s') && form?.form !== 'add'}
		<p class="alert" role="alert">{t(form.error)}</p>
	{/if}

	{#if !data.shared && data.drafts}
		<a class="ui-card sky drafts" href="/tutor/bank?status=draft">
			<strong>{m.qb_drafts_n({ n: data.drafts })}</strong>
			<span class="small">{m.qb_drafts_hint()}</span>
		</a>
	{/if}

	<form method="GET" class="filters" aria-label={m.qb_filter()}>
		{#if data.shared}<input type="hidden" name="view" value="shared" />{/if}
		<select name="subject" aria-label={m.qb_subject()}>
			<option value="">{m.qb_all_subjects()}</option>
			{#each data.tags.subjects as s (s)}<option value={s} selected={f.subject === s}>{s}</option
				>{/each}
		</select>
		<select name="chapter" aria-label={m.qb_chapter()}>
			<option value="">{m.qb_all_chapters()}</option>
			{#each chapters as c (c)}<option value={c} selected={f.chapter === c}>{c}</option>{/each}
		</select>
		<select name="type" aria-label={m.qb_type()}>
			<option value="">{m.qb_all_types()}</option>
			{#each ['mcq', 'short', 'written', 'maths'] as ty (ty)}<option
					value={ty}
					selected={f.type === ty}>{t(`qb_type_${ty}`)}</option
				>{/each}
		</select>
		<select name="difficulty" aria-label={m.qb_difficulty()}>
			<option value="">{m.qb_any_difficulty()}</option>
			{#each ['easy', 'medium', 'hard'] as d (d)}<option value={d} selected={f.difficulty === d}
					>{t(`qb_diff_${d}`)}</option
				>{/each}
		</select>
		{#if f.status}<input type="hidden" name="status" value={f.status} />{/if}
		<input name="q" type="search" placeholder={m.qb_search()} defaultValue={f.q ?? ''} />
		<button class="btn btn-sm" type="submit">{m.qb_show()}</button>
	</form>

	{#if data.shared}
		<p class="note small">{m.qb_tutora_bank_hint()}</p>
		{#if data.others.length}
			<ul class="rows">
				{#each data.others as q (q.id)}
					<li class="qrow">
						<div class="grow">
							<p class="prompt">{q.prompt}</p>
							<QuestionTags {q} />
							<span class="small muted">{m.qb_by({ name: q.by })}</span>
							{#if errFor(`s${q.id}`)}<p class="error" role="alert">{errFor(`s${q.id}`)}</p>{/if}
						</div>
						<form method="POST" action="?/copy">
							<input type="hidden" name="id" value={q.id} />
							<button class="btn btn-sm btn-secondary" type="submit">{m.qb_copy()}</button>
						</form>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="note">{m.qb_tutora_bank_empty()}</p>
		{/if}
	{:else}
		<details class="more" open={form?.form === 'add' || !data.total}>
			<summary>{m.qb_add()}</summary>
			<form method="POST" action="?/add" class="stack">
				{#if errFor('add')}<p class="error" role="alert">{errFor('add')}</p>{/if}
				<BankFields
					key="new"
					tags={data.tags}
					defaults={{ subject: f.subject, chapter: f.chapter }}
				/>
				<button class="btn" type="submit">{m.qb_add()}</button>
			</form>
		</details>

		<p class="small muted">
			{f.status === 'draft' ? m.qb_count_drafts({ n: data.total }) : m.qb_count({ n: data.total })}
		</p>
		{#if data.questions.length}
			<ul class="rows">
				{#each data.questions as q (q.id)}
					<li class="qrow">
						<div class="grow">
							<p class="prompt">{q.prompt}</p>
							<QuestionTags {q} />
							{#if q.type === 'mcq'}
								<span class="small muted">{m.st5_right_answer()}: {q.choices[q.answer]}</span>
							{:else if q.type === 'short' && !q.maths}
								<span class="small muted">{m.st5_right_answer()}: {q.accepted.join(' / ')}</span>
							{/if}
							{#if errFor(`q${q.id}`)}<p class="error" role="alert">{errFor(`q${q.id}`)}</p>{/if}
							<div class="acts">
								<a
									class="btn btn-sm {q.status === 'draft' ? '' : 'btn-secondary'}"
									href="/tutor/bank/{q.id}"
									>{q.status === 'draft' ? m.qb_check_draft() : m.st5_edit()}</a
								>
								{#if q.status === 'ready'}
									<form method="POST" action="?/share">
										<input type="hidden" name="id" value={q.id} />
										<input type="hidden" name="shared" value={q.shared ? '0' : '1'} />
										<button class="btn-link small" type="submit"
											>{q.shared ? m.qb_unshare() : m.qb_share_short()}</button
										>
									</form>
								{/if}
								<details class="sure">
									<summary class="small">{m.st5_remove_question()}</summary>
									<form method="POST" action="?/remove" class="stack-s">
										<input type="hidden" name="id" value={q.id} />
										<label class="small"
											><input type="checkbox" name="sure" required /> {m.qb_sure_remove()}</label
										>
										<button class="btn btn-warn btn-sm" type="submit"
											>{m.st5_remove_question()}</button
										>
									</form>
								</details>
							</div>
						</div>
					</li>
				{/each}
			</ul>
			{#if data.pages > 1}
				<nav class="pager" aria-label={m.qb_pages()}>
					{#if data.page > 0}<a href={qs({ p: data.page - 1 })}>‹ {m.qb_prev()}</a>{/if}
					<span class="small muted">{data.page + 1} / {data.pages}</span>
					{#if data.page + 1 < data.pages}<a href={qs({ p: data.page + 1 })}>{m.qb_next()} ›</a
						>{/if}
				</nav>
			{/if}
		{:else}
			<p class="note">{data.total ? '' : m.qb_empty()}</p>
		{/if}
	{/if}
</div>

<style>
	.drafts {
		display: flex;
		flex-direction: column;
		gap: 2px;
		text-decoration: none;
		color: inherit;
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.filters select,
	.filters input {
		flex: 1 1 8rem;
		min-width: 0;
	}
	.qrow {
		align-items: flex-start;
	}
	.grow {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.prompt {
		margin: 0;
		font-weight: 600;
		white-space: pre-line;
	}
	.acts {
		display: flex;
		gap: 12px;
		align-items: center;
		flex-wrap: wrap;
	}
	.sure summary,
	.more summary {
		cursor: pointer;
		color: var(--ocean);
		min-height: 44px;
		display: flex;
		align-items: center;
	}
	.more summary {
		font-weight: 600;
	}
	.pager {
		display: flex;
		gap: 16px;
		align-items: center;
		justify-content: center;
	}
</style>
