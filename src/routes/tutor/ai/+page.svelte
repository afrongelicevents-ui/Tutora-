<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import ProLocked from '#lib/components/pro/ProLocked.svelte';
	import ProPill from '#lib/components/pro/ProPill.svelte';
	let { data, form } = $props();
	const v = $derived(form?.input);
	const resting = $derived(data.resting || form?.error === 'ai_err_resting');
</script>

<svelte:head><title>{m.ai_title()} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/tutor/assessments" aria-label={m.st5_tutor_title()}>‹</a>
	<h1>{m.ai_title()} <ProPill /></h1>
	<p class="lead">{m.ai_lead()}</p>

	{#if !data.pro}
		<ProLocked feature="ai" />
		<p class="note">{m.ai_free_alt()} <a href="/tutor/tests/new">{m.qb_build_title()}</a></p>
	{:else if resting}
		<div class="ui-card cream" role="status">
			<p><strong>{m.ai_resting()}</strong></p>
			<p class="acts">
				<a class="ui-btn" href="/tutor/tests/new">{m.qb_build_title()}</a>
				<a class="ui-btn-soft" href="/tutor/bank">{m.qb_title()}</a>
			</p>
		</div>
	{:else if !data.available}
		<div class="ui-card sky" role="status">
			<p>{m.ai_unavailable()}</p>
			<p><a class="ui-btn" href="/tutor/tests/new">{m.qb_build_title()}</a></p>
		</div>
	{:else}
		{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
		{#if form && 'raw' in form && form.raw}<pre class="small" data-raw>{form.raw}</pre>{/if}
		{#if data.tutorFull}<p class="alert" role="alert">{m.ai_err_tutor_cap()}</p>{/if}
		{#if data.drafts}
			<a class="ui-card sky drafts" href="/tutor/bank?status=draft"
				><strong>{m.qb_drafts_n({ n: data.drafts })}</strong>
				<span class="small">{m.qb_drafts_hint()}</span></a
			>
		{/if}
		<form method="POST" class="stack">
			<div class="field">
				<label for="ai-notes">{m.ai_notes()}</label>
				<textarea
					id="ai-notes"
					name="notes"
					required
					rows="7"
					maxlength={data.maxNotes}
					placeholder={m.ai_notes_ph()}
					defaultValue={v?.notes ?? ''}></textarea>
				<span class="hint">{m.ai_notes_hint()}</span>
			</div>
			<div class="row2">
				<div class="field">
					<label for="ai-subject">{m.qb_subject()}</label>
					<input
						id="ai-subject"
						name="subject"
						required
						maxlength="60"
						list="ai-subjects"
						defaultValue={v?.subject ?? data.subjects[0] ?? ''}
					/>
					<datalist id="ai-subjects"
						>{#each data.subjects as s (s)}<option value={s}></option>{/each}</datalist
					>
				</div>
				<div class="field">
					<label for="ai-form">{m.qb_form()}</label>
					<input
						id="ai-form"
						name="form"
						maxlength="40"
						placeholder={m.qb_form_ph()}
						defaultValue={v?.form ?? ''}
					/>
				</div>
			</div>
			<div class="row2">
				<div class="field">
					<label for="ai-chapter">{m.qb_chapter()}</label>
					<input
						id="ai-chapter"
						name="chapter"
						required
						maxlength="80"
						defaultValue={v?.chapter ?? ''}
					/>
				</div>
				<div class="field">
					<label for="ai-count">{m.qb_how_many()}</label>
					<input
						id="ai-count"
						name="count"
						type="number"
						min="1"
						max={data.maxDrafts}
						value={v?.count ?? 5}
					/>
				</div>
			</div>
			<div class="row2">
				<div class="field">
					<label for="ai-type">{m.qb_type()}</label>
					<select id="ai-type" name="type">
						<option value="mixed">{m.ai_type_mixed()}</option>
						<option value="mcq">{m.qb_type_mcq()}</option>
						<option value="short">{m.qb_type_short()}</option>
						<option value="written">{m.qb_type_written()}</option>
					</select>
				</div>
				<div class="field">
					<label for="ai-diff">{m.qb_difficulty()}</label>
					<select id="ai-diff" name="difficulty">
						<option value="">{m.qb_any()}</option>
						{#each ['easy', 'medium', 'hard'] as d (d)}<option value={d}>{t(`qb_diff_${d}`)}</option
							>{/each}
					</select>
				</div>
			</div>
			<p class="note small">{m.ai_check_note()}</p>
			<button class="btn btn-block" type="submit">{m.ai_make()}</button>
		</form>
		<p class="small muted">
			{m.ai_today()}
			{data.left === 1 ? m.ai_left_one() : m.ai_left({ n: data.left })}
		</p>
	{/if}
</div>

<style>
	.row2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.drafts {
		display: flex;
		flex-direction: column;
		gap: 2px;
		text-decoration: none;
		color: inherit;
	}
	.acts {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}
	h1 :global(.pro-pill),
	h1 :global(span) {
		vertical-align: middle;
	}
</style>
