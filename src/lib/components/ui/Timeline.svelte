<script lang="ts">
	/**
	 * A vertical list of steps (any area): done ✓ in green, the current one highlighted,
	 * the rest muted. Each step: { label, when?: string, state: 'done' | 'current' | 'todo' }.
	 * Example: <Timeline steps={[{ label: 'Requested', when: '3 Nov', state: 'done' }]} />
	 */
	let {
		steps
	}: { steps: { label: string; when?: string | null; state: 'done' | 'current' | 'todo' }[] } =
		$props();
</script>

<ol class="tl">
	{#each steps as s, i (i)}
		<li class={s.state} aria-current={s.state === 'current' ? 'step' : undefined}>
			<span class="dot" aria-hidden="true">{s.state === 'done' ? '✓' : i + 1}</span>
			<span class="txt"
				><strong>{s.label}</strong>{#if s.when}<span class="small muted">{s.when}</span>{/if}</span
			>
		</li>
	{/each}
</ol>

<style>
	.tl {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}
	li {
		position: relative;
		display: flex;
		gap: 12px;
		padding: 0 0 16px;
	}
	li:not(:last-child)::before {
		content: '';
		position: absolute;
		left: 15px;
		top: 30px;
		bottom: 2px;
		width: 2px;
		background: var(--border);
	}
	li.done:not(:last-child)::before {
		background: var(--ok);
	}
	.dot {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		flex-shrink: 0;
		font-weight: 700;
		font-size: 0.875rem;
		background: var(--ice);
		color: var(--muted);
	}
	.done .dot {
		background: var(--ok);
		color: #fff;
	}
	.current .dot {
		background: var(--navy);
		color: #fff;
		box-shadow: 0 0 0 4px #dbe7f6;
	}
	.txt {
		display: flex;
		flex-direction: column;
		padding-top: 5px;
	}
	.todo strong {
		color: var(--muted);
		font-weight: 500;
	}
</style>
