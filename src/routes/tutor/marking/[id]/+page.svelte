<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDayTime } from '#lib/tz.ts';
	let { data, form } = $props();
	const right = (it: (typeof data.items)[number]) =>
		it.type === 'mcq'
			? it.choices[it.answerIdx]
			: it.expected !== null
				? String(it.expected)
				: it.accepted.join(' / ');
	const shown = (it: (typeof data.items)[number]) =>
		it.type === 'mcq' && it.given !== null
			? (it.choices[Number(it.given)] ?? '')
			: (it.given ?? '');
</script>

<svelte:head><title>{data.name} · {data.title} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/tutor/marking" aria-label={m.qb_marking_title()}>‹</a>
	<span class="eyebrow">{data.title}</span>
	<h1>{data.name}</h1>
	<p class="note">
		{m.qb_handed_in({ when: fmtDayTime(data.submittedAt) })}{data.late
			? ` · ${m.qb_late()}`
			: ''}{data.autoClosed ? ` · ${m.qb_time_ran_out()}` : ''}
	</p>
	<p class="lead">
		<strong>{data.score}/{data.maxScore}</strong>{data.toMark
			? ` · ${m.qb_n_to_mark({ n: data.toMark })}`
			: ''}
	</p>
	{#if form?.done}<p class="notice" role="status">{t(`qb_done_${form.done}`)}</p>{/if}
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}

	<form method="POST" class="stack">
		<ol class="rows qlist">
			{#each data.items as it, i (it.qid)}
				<li class:todo={it.awarded === null}>
					<div class="grow">
						<p class="prompt"><span class="n">{i + 1}.</span> {it.prompt}</p>
						<span class="small muted"
							>{t(`qb_type_${it.expected !== null ? 'maths' : it.type}`)} · {it.chapter}</span
						>
						<p class="ans">
							<span class="small muted">{m.qb_their_answer()}</span>
							{shown(it) || m.qb_no_answer()}
						</p>
						{#if it.type !== 'written'}
							<span class="small muted">{m.st5_right_answer()}: {right(it)}</span>
						{:else if it.explanation}
							<span class="small muted">{m.qb_model_answer()}: {it.explanation}</span>
						{/if}
					</div>
					<label class="mk">
						<span class="small">{m.qb_marks_of({ n: it.marks })}</span>
						<input
							name="m{it.qid}"
							type="number"
							min="0"
							max={it.marks}
							inputmode="numeric"
							required={it.awarded === null}
							defaultValue={it.awarded === null ? '' : String(it.awarded)}
						/>
					</label>
				</li>
			{/each}
		</ol>
		<button class="btn btn-block" type="submit">{m.qb_save_marks()}</button>
	</form>
</div>

<style>
	.qlist > li {
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
	.n {
		color: var(--ocean);
	}
	.ans {
		margin: 0;
		white-space: pre-line;
	}
	.ans .small {
		display: block;
	}
	.mk {
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: 5.5rem;
	}
	.todo {
		border-left: 3px solid var(--amber, #d89b2b);
		padding-left: 8px;
	}
</style>
