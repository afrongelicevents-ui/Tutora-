<script lang="ts">
	// Multiple-choice questions as plain radio buttons: works without JavaScript.
	let {
		questions
	}: { questions: { id: number; prompt: string; choices: string[]; topic?: string }[] } = $props();
</script>

<ol class="qs">
	{#each questions as q, i (q.id)}
		<li>
			<fieldset>
				<legend><span class="n">{i + 1}.</span> {q.prompt}</legend>
				{#each q.choices as c, j (j)}
					<label class="choice"
						><input type="radio" name="a{q.id}" value={j} /> <span>{c}</span></label
					>
				{/each}
			</fieldset>
		</li>
	{/each}
</ol>

<style>
	.qs {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}
	.qs > li {
		padding: 16px 0;
		border-bottom: 1px solid var(--border);
	}
	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	legend {
		font-weight: 600;
		line-height: 1.45;
		margin-bottom: 8px;
		padding: 0;
	}
	.n {
		color: var(--ocean);
	}
	.choice {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 48px;
		padding: 8px 14px;
		border: 1px solid var(--border-strong);
		border-radius: 14px;
		background: var(--white);
		cursor: pointer;
	}
	.choice:has(input:checked) {
		border-color: var(--navy);
		background: var(--ice);
	}
	.choice input {
		width: 20px;
		height: 20px;
		accent-color: var(--navy);
		flex-shrink: 0;
	}
</style>
