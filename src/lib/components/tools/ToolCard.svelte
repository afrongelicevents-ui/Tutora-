<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '#lib/i18n.ts';
	import ToolLogo, { TOOL_NAME, type Tool } from './ToolLogo.svelte';

	// A Connected Tools card: what the tool is for and a shortcut that opens it. Nothing is
	// connected or synced, so there is no "Connected" status.
	let {
		logo,
		use,
		href,
		status,
		children
	}: {
		logo: Tool;
		/** what it is used for, in Tutora */
		use: string;
		/** the shortcut: opens the app or website */
		href: string;
		/** an optional small label (e.g. "On" for Kahoot! links) */
		status?: string;
		children?: Snippet;
	} = $props();
</script>

<article class="toolcard" id={logo}>
	<div class="head">
		<h2><ToolLogo tool={logo} size={28} />{TOOL_NAME[logo]}</h2>
		{#if status}<span class="pill p-off">{status}</span>{/if}
	</div>
	<p class="use">{use}</p>
	<a class="btn btn-ghost btn-block" {href} target="_blank" rel="noopener noreferrer"
		>{m.tl_open({ tool: TOOL_NAME[logo] })} ↗</a
	>
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
		display: flex;
		align-items: center;
		gap: 8px;
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
	.p-off {
		background: var(--ice);
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
