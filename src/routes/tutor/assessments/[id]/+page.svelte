<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDate, fromLocal } from '#lib/tz.ts';
	import SetFields from '../SetFields.svelte';
	import QuestionFields from './QuestionFields.svelte';
	let { data, form } = $props();
	const errFor = (name: string) => (form?.error && form?.form === name ? t(form.error) : '');
	const s = $derived(data.set);
	const notAssigned = $derived(
		data.students.filter((x) => !data.assigned.some((a) => a.studentId === x.id))
	);
</script>

<svelte:head><title>{s.title} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/tutor/assessments" aria-label={m.st5_tutor_title()}>‹</a>
	<span class="eyebrow"
		>{s.kind === 'test' ? m.st5_kind_test() : m.st5_kind_quiz()} · {s.subject}</span
	>
	<h1>{s.title}</h1>
	<p class="note">
		{s.topic}{s.level ? ` · ${s.level}` : ''} · {m.st5_n_questions({
			n: data.questions.length
		})}{s.dailyChecks ? ` · ${m.st5_in_daily()}` : ''}
	</p>
	{#if form?.done}<p class="notice" role="status">{t(`st5_done_${form.done}`)}</p>{/if}

	<section class="part">
		<div class="section-h"><h2>{m.st5_questions()}</h2></div>
		{#if data.questions.length}
			<ol class="rows qlist">
				{#each data.questions as q, i (q.id)}
					<li>
						<div class="grow">
							<p class="prompt"><span class="n">{i + 1}.</span> {q.prompt}</p>
							<ul class="small plain">
								{#each q.choices as c, j (j)}
									<li class:ok-t={j === q.answer}>
										{c}{j === q.answer ? ` · ${m.st5_right_answer()}` : ''}
									</li>
								{/each}
							</ul>
							{#if q.explanation}<p class="small muted">{q.explanation}</p>{/if}
							<details open={form?.form === `q${q.id}`}>
								<summary class="small">{m.st5_edit()}</summary>
								<form method="POST" action="?/editQuestion" class="stack">
									{#if errFor(`q${q.id}`)}<p class="error" role="alert">
											{errFor(`q${q.id}`)}
										</p>{/if}
									<input type="hidden" name="id" value={q.id} />
									<QuestionFields {q} key="q{q.id}" />
									<button class="btn btn-sm" type="submit">{m.st5_save()}</button>
								</form>
								<form method="POST" action="?/removeQuestion">
									<input type="hidden" name="id" value={q.id} />
									<button class="btn-link small" type="submit">{m.st5_remove_question()}</button>
								</form>
							</details>
						</div>
					</li>
				{/each}
			</ol>
		{:else}
			<p class="note">{m.st5_questions_empty()}</p>
		{/if}
		<details class="more" open={!data.questions.length || form?.form === 'new'}>
			<summary>{m.st5_add_question()}</summary>
			<form method="POST" action="?/addQuestion" class="stack">
				{#if errFor('new')}<p class="error" role="alert">{errFor('new')}</p>{/if}
				<QuestionFields key="new" />
				<button class="btn" type="submit">{m.st5_add_question()}</button>
			</form>
		</details>
	</section>

	<section class="part">
		<div class="section-h"><h2>{m.st5_assigned()}</h2></div>
		{#if data.assigned.length}
			<ul class="rows">
				{#each data.assigned as a (a.id)}
					<li>
						<span class="grow"
							><strong>{a.name}</strong><span class="small muted block"
								>{#if a.doneAt}{m.st5_done_on({
										date: fmtDate(a.doneAt)
									})}{:else if a.dueOn}{m.st5_due({
										date: fmtDate(fromLocal(a.dueOn))
									})}{:else}{m.st5_not_done()}{/if}</span
							></span
						>
						{#if a.doneAt && a.score !== null}
							<strong>{a.score}/{a.maxScore}</strong>
						{:else}
							<form method="POST" action="?/unassign">
								<input type="hidden" name="id" value={a.id} />
								<button class="btn-link small" type="submit">{m.st5_unassign()}</button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="note">{m.st5_assigned_empty()}</p>
		{/if}
		{#if !data.students.length}
			<p class="note">{m.st5_no_students()}</p>
		{:else if !data.questions.length}
			<p class="note">{m.st5_assign_needs_q()}</p>
		{:else}
			<form method="POST" action="?/assign" class="stack assign">
				{#if errFor('assign')}<p class="error" role="alert">{errFor('assign')}</p>{/if}
				<div class="field">
					<label for="as-student">{m.st5_assign_to()}</label>
					<select id="as-student" name="studentId" required>
						{#each notAssigned.length ? notAssigned : data.students as st (st.id)}
							<option value={st.id}>{st.name}</option>
						{/each}
					</select>
				</div>
				<div class="field">
					<label for="as-due">{m.st5_due_opt()}</label>
					<input id="as-due" name="dueOn" type="date" min={data.today} />
				</div>
				<button class="btn" type="submit">{m.st5_assign()}</button>
			</form>
		{/if}
	</section>

	<details class="more" open={form?.form === 'set'}>
		<summary>{m.st5_edit_set()}</summary>
		<form method="POST" action="?/save" class="stack">
			{#if errFor('set')}<p class="error" role="alert">{errFor('set')}</p>{/if}
			<SetFields set={s} />
			<button class="btn" type="submit">{m.st5_save()}</button>
		</form>
		<form method="POST" action="?/delete" class="del">
			<button class="btn btn-warn btn-sm" type="submit">{m.st5_delete_set()}</button>
			<p class="note">{m.st5_delete_note()}</p>
		</form>
	</details>
</div>

<style>
	.part {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.grow {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.qlist > li {
		align-items: flex-start;
	}
	.prompt {
		margin: 0;
		font-weight: 600;
	}
	.n {
		color: var(--ocean);
	}
	.plain {
		margin: 0;
		padding-left: 18px;
	}
	.block {
		display: block;
	}
	.more summary,
	details summary {
		cursor: pointer;
		font-weight: 600;
		color: var(--ocean);
		min-height: 44px;
		display: flex;
		align-items: center;
	}
	.del {
		margin-top: 16px;
	}
	.assign {
		margin-top: 12px;
	}
</style>
