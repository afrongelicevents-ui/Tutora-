<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/i18n.ts';
	/** The fields of one question-bank question (all four kinds). */
	interface Q {
		type: string;
		prompt: string;
		choices: string[];
		answer: number;
		accepted: string[];
		marks: number;
		explanation: string | null;
		subject: string | null;
		form: string | null;
		chapter: string | null;
		term: string | null;
		difficulty: string | null;
		shared: boolean;
		status?: string;
		setId?: number | null;
	}
	interface Maths {
		type: string;
		vars: { name: string; min: number; max: number; step?: number }[];
		lets: string;
		formula: string;
		decimals: number;
	}
	let {
		q = null,
		maths = null,
		key,
		tags = { subjects: [], forms: [], chapters: [] },
		defaults = {}
	}: {
		q?: Q | null;
		maths?: Maths | null;
		key: string;
		tags?: { subjects: string[]; forms: string[]; chapters: { chapter: string }[] };
		defaults?: { subject?: string; form?: string; chapter?: string };
	} = $props();
	// svelte-ignore state_referenced_locally
	let type = $state(maths?.type ?? q?.type ?? 'mcq');
	const inQuiz = $derived(!!q?.setId);
	const slots = [0, 1, 2, 3, 4];
	// the kind can be changed once the page is ready (tests wait for this)
	let ready = $state(false);
	onMount(() => (ready = true));
	const varRows = [0, 1, 2, 3];
	const chapterNames = $derived([...new Set(tags.chapters.map((c) => c.chapter))]);
</script>

<p class="note small">{m.qb_original_only()}</p>

<div class="field">
	<label for="{key}-type">{m.qb_type()}</label>
	<select
		id="{key}-type"
		name="type"
		bind:value={type}
		disabled={inQuiz}
		data-ready={ready || undefined}
	>
		<option value="mcq">{m.qb_type_mcq()}</option>
		<option value="short">{m.qb_type_short()}</option>
		<option value="written">{m.qb_type_written()}</option>
		<option value="maths">{m.qb_type_maths()}</option>
	</select>
	{#if inQuiz}<input type="hidden" name="type" value="mcq" /><span class="hint"
			>{m.qb_in_quiz_hint()}</span
		>{/if}
</div>

<div class="field">
	<label for="{key}-prompt">{m.st5_q_prompt()}</label>
	<textarea
		id="{key}-prompt"
		name="prompt"
		required
		maxlength="1500"
		rows="3"
		defaultValue={q?.prompt ?? ''}></textarea>
	{#if type === 'maths'}<span class="hint"
			>{m.qb_maths_prompt_hint()} <code>{'Solve {a}x + {b} = {c}'}</code></span
		>{/if}
</div>

{#if type === 'mcq'}
	<fieldset class="choices">
		<legend class="label">{m.st5_q_choices()}</legend>
		<span class="hint">{m.st5_q_choices_hint()}</span>
		{#each slots as i (i)}
			<div class="choice">
				<input
					type="radio"
					name="answer"
					value={i}
					id="{key}-ans{i}"
					checked={q && q.type === 'mcq' ? q.answer === i : i === 0}
					aria-label={m.st5_q_mark_right({ n: i + 1 })}
				/>
				<label class="sr-only" for="{key}-c{i}">{m.st5_q_choice_n({ n: i + 1 })}</label>
				<input
					id="{key}-c{i}"
					name="choice{i}"
					maxlength="300"
					required={i < 2}
					placeholder={m.st5_q_choice_n({ n: i + 1 })}
					defaultValue={q?.choices[i] ?? ''}
				/>
			</div>
		{/each}
	</fieldset>
{:else if type === 'short'}
	<div class="field">
		<label for="{key}-acc">{m.qb_accepted()}</label>
		<textarea
			id="{key}-acc"
			name="accepted"
			rows="3"
			maxlength="2000"
			required
			defaultValue={q?.accepted.join('\n') ?? ''}></textarea>
		<span class="hint">{m.qb_accepted_hint()}</span>
	</div>
{:else if type === 'written'}
	<p class="note small">{m.qb_written_hint()}</p>
{:else}
	<fieldset class="vars">
		<legend class="label">{m.qb_vars()}</legend>
		<span class="hint">{m.qb_vars_hint()}</span>
		{#each varRows as i (i)}
			{@const v = maths?.vars[i]}
			<div class="var">
				<input
					name="v{i}name"
					maxlength="8"
					aria-label={m.qb_var_name({ n: i + 1 })}
					placeholder={['a', 'b', 'c', 'd'][i]}
					defaultValue={v?.name ?? ''}
				/>
				<input
					name="v{i}min"
					inputmode="decimal"
					aria-label={m.qb_var_from({ n: i + 1 })}
					placeholder={m.qb_from()}
					defaultValue={v ? String(v.min) : ''}
				/>
				<input
					name="v{i}max"
					inputmode="decimal"
					aria-label={m.qb_var_to({ n: i + 1 })}
					placeholder={m.qb_to()}
					defaultValue={v ? String(v.max) : ''}
				/>
			</div>
		{/each}
	</fieldset>
	<div class="field">
		<label for="{key}-lets">{m.qb_lets()}</label>
		<textarea
			id="{key}-lets"
			name="lets"
			rows="2"
			maxlength="400"
			placeholder="c = a * x + b"
			defaultValue={maths?.lets ?? ''}></textarea>
		<span class="hint">{m.qb_lets_hint()}</span>
	</div>
	<div class="row2">
		<div class="field">
			<label for="{key}-formula">{m.qb_formula()}</label>
			<input
				id="{key}-formula"
				name="formula"
				maxlength="200"
				required
				placeholder="(c - b) / a"
				defaultValue={maths?.formula ?? ''}
			/>
		</div>
		<div class="field">
			<label for="{key}-dec">{m.qb_decimals()}</label>
			<select id="{key}-dec" name="decimals">
				{#each [0, 1, 2] as d (d)}
					<option value={d} selected={(maths?.decimals ?? 0) === d}>{d}</option>
				{/each}
			</select>
		</div>
	</div>
{/if}

<div class="row2">
	<div class="field">
		<label for="{key}-subject">{m.qb_subject()}</label>
		<input
			id="{key}-subject"
			name="subject"
			required
			maxlength="60"
			list="{key}-subjects"
			defaultValue={q?.subject ?? defaults.subject ?? ''}
		/>
		<datalist id="{key}-subjects">
			{#each tags.subjects as s (s)}<option value={s}></option>{/each}
		</datalist>
	</div>
	<div class="field">
		<label for="{key}-form">{m.qb_form()}</label>
		<input
			id="{key}-form"
			name="form"
			maxlength="40"
			list="{key}-forms"
			placeholder={m.qb_form_ph()}
			defaultValue={q?.form ?? defaults.form ?? ''}
		/>
		<datalist id="{key}-forms">
			{#each tags.forms as s (s)}<option value={s}></option>{/each}
		</datalist>
	</div>
</div>
<div class="row2">
	<div class="field">
		<label for="{key}-chapter">{m.qb_chapter()}</label>
		<input
			id="{key}-chapter"
			name="chapter"
			required
			maxlength="80"
			list="{key}-chapters"
			defaultValue={q?.chapter ?? defaults.chapter ?? ''}
		/>
		<datalist id="{key}-chapters">
			{#each chapterNames as s (s)}<option value={s}></option>{/each}
		</datalist>
	</div>
	<div class="field">
		<label for="{key}-term">{m.qb_term()}</label>
		<select id="{key}-term" name="term">
			<option value="">{m.qb_any()}</option>
			{#each ['Term 1', 'Term 2', 'Term 3'] as tm (tm)}
				<option value={tm} selected={q?.term === tm}>{tm}</option>
			{/each}
		</select>
	</div>
</div>
<div class="row2">
	<div class="field">
		<label for="{key}-diff">{m.qb_difficulty()}</label>
		<select id="{key}-diff" name="difficulty">
			<option value="">{m.qb_any()}</option>
			<option value="easy" selected={q?.difficulty === 'easy'}>{m.qb_diff_easy()}</option>
			<option value="medium" selected={q?.difficulty === 'medium'}>{m.qb_diff_medium()}</option>
			<option value="hard" selected={q?.difficulty === 'hard'}>{m.qb_diff_hard()}</option>
		</select>
	</div>
	<div class="field">
		<label for="{key}-marks">{m.qb_marks()}</label>
		<input
			id="{key}-marks"
			name="marks"
			type="number"
			min="1"
			max="20"
			defaultValue={String(q?.marks ?? 1)}
		/>
	</div>
</div>
<div class="field">
	<label for="{key}-exp">{type === 'written' ? m.qb_model_answer() : m.st5_q_explanation()}</label>
	<textarea
		id="{key}-exp"
		name="explanation"
		maxlength="1000"
		rows="2"
		defaultValue={q?.explanation ?? ''}></textarea>
</div>
{#if q?.status !== 'draft'}
	<label class="check">
		<input type="checkbox" name="shared" checked={q?.shared ?? false} />
		<span>{m.qb_share()}<span class="hint block">{m.qb_share_hint()}</span></span>
	</label>
{/if}

<style>
	.choices,
	.vars {
		border: 0;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.choices legend,
	.vars legend {
		padding: 0;
	}
	.choice,
	.var {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.var input {
		flex: 1;
		min-width: 0;
	}
	.var input:first-child {
		flex: 0 0 4.5rem;
	}
	.choice input[type='radio'] {
		width: 22px;
		height: 22px;
		accent-color: var(--navy);
		flex-shrink: 0;
	}
	.choice input:not([type='radio']) {
		flex: 1;
		min-width: 0;
	}
	.row2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.check {
		display: flex;
		gap: 10px;
		align-items: flex-start;
	}
	.check input {
		width: 22px;
		height: 22px;
		margin-top: 2px;
		accent-color: var(--navy);
	}
	.block {
		display: block;
	}
</style>
