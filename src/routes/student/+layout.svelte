<script lang="ts">
	import { initialOf } from '#lib/names.ts';
	import AppShell from '#lib/components/AppShell.svelte';
	import { studentArea } from '#lib/nav.ts';
	import { page } from '$app/state';
	let { children, data } = $props();
	// the round profile initial in the header, as on the family side
	const initial = $derived(
		((data as { user?: { name?: string } | null }).user?.name ?? '').trim()
			? initialOf((data as { user?: { name?: string } | null }).user?.name ?? '')
			: undefined
	);
</script>

<AppShell
	{...studentArea()}
	unread={(page.data as { unreadNow?: number }).unreadNow ?? data.unread}
	{initial}
>
	<!-- .st-area: the shared reference style for every student page (app.css "student area") -->
	<div class="st-area">{@render children()}</div>
</AppShell>

<style>
	/* free level: links to Tutora Family pages carry a small label (hooks.server.ts) */
	.st-area :global(a[data-fam]::after) {
		content: attr(data-fam);
		display: inline-block;
		margin-inline-start: 0.4em;
		padding: 0.05em 0.5em;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 600;
		line-height: 1.5;
		vertical-align: middle;
		background: #f6e7c1;
		color: #6b4e00;
	}
</style>
