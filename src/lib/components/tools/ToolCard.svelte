<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '#lib/i18n.ts';

	let {
		name,
		on,
		status,
		use,
		access,
		children
	}: {
		name: string;
		/** really connected / switched on (never pretended) */
		on: boolean;
		/** replaces "Connected / Not connected" when the tool needs no account */
		status?: string;
		/** what it is used for */
		use: string;
		/** the access it gets, shown when on */
		access?: string;
		children?: Snippet;
	} = $props();
</script>

<article class="toolcard">
	<div class="head">
		<h2>{name}</h2>
		<span class="pill {on ? 'p-ok' : 'p-off'}"
			>{status ?? (on ? m.tools6_connected() : m.tools6_not_connected())}</span
		>
	</div>
	<p class="use">{use}</p>
	{#if access}<p class="access">{m.tools6_access({ what: access })}</p>{/if}
	{@render children?.()}
</article>

<style>
	.toolcard {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}
	h2 {
		margin: 0;
		font-family: var(--font);
		font-size: 1rem;
		font-weight: 700;
		color: var(--text);
	}
	.use {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.45;
		color: var(--muted);
	}
	.access {
		margin: 0;
		font-size: 0.8125rem;
		line-height: 1.45;
		color: var(--plum-2);
	}
	.p-off {
		background: #f1ecf2;
		color: var(--muted);
		font-weight: 600;
	}
	.toolcard :global(.disconnect) {
		align-self: flex-start;
		background: none;
		border: none;
		color: var(--danger-700);
		font: inherit;
		font-size: 0.875rem;
		font-weight: 600;
		padding: 8px 0;
		min-height: 44px;
		cursor: pointer;
	}
</style>
