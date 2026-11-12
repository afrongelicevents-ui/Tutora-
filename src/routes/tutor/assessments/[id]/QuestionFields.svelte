<script lang="ts">
	import { m } from '#lib/i18n.ts';
	interface Q {
		id: number;
		prompt: string;
		choices: string[];
		answer: number;
		explanation: string | null;
	}
	let { q = null, key }: { q?: Q | null; key: string } = $props();
	const slots = [0, 1, 2, 3, 4];
</script>

<div class="field">
	<label for="{key}-prompt">{m.st5_q_prompt()}</label>
	<textarea
		id="{key}-prompt"
		name="prompt"
		required
		maxlength="1000"
		rows="2"
		defaultValue={q?.prompt ?? ''}></textarea>
</div>
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
				checked={q ? q.answer === i : i === 0}
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
<div class="field">
	<label for="{key}-exp">{m.st5_q_explanation()}</label>
	<textarea
		id="{key}-exp"
		name="explanation"
		maxlength="1000"
		rows="2"
		defaultValue={q?.explanation ?? ''}></textarea>
</div>

<style>
	.choices {
		border: 0;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.choices legend {
		padding: 0;
	}
	.choice {
		display: flex;
		align-items: center;
		gap: 10px;
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
</style>
