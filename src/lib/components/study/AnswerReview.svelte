<script lang="ts">
	import { m } from '#lib/i18n.ts';
	interface Item {
		id: number;
		prompt: string;
		choices: string[];
		answer: number;
		chosen: number | null;
		correct: boolean;
		explanation: string | null;
	}
	let { items }: { items: Item[] } = $props();
</script>

<ol class="answers">
	{#each items as q, i (q.id)}
		<li>
			<p class="prompt"><span class="n">{i + 1}.</span> {q.prompt}</p>
			<p class={q.correct ? 'ok-t' : 'warn-t'}>
				{q.correct ? m.st5_right() : q.chosen === null ? m.st5_no_answer() : m.st5_not_quite()}
			</p>
			{#if !q.correct && q.chosen !== null}
				<p class="small">{m.st5_your_answer({ answer: q.choices[q.chosen] })}</p>
			{/if}
			<p class="small">{m.st5_correct_answer({ answer: q.choices[q.answer] })}</p>
			{#if q.explanation}<p class="small muted">{q.explanation}</p>{/if}
		</li>
	{/each}
</ol>

<style>
	.answers {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.answers > li {
		padding: 14px 0;
		border-bottom: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.answers p {
		margin: 0;
	}
	.prompt {
		font-weight: 600;
	}
	.n {
		color: var(--plum-2);
	}
</style>
