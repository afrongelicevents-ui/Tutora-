<script lang="ts">
	import AppShell from '#lib/components/AppShell.svelte';
	import { ownerArea } from '#lib/nav.ts';
	import { navigating, page } from '$app/state';
	import { m } from '#lib/i18n.ts';
	import { initialOf } from '#lib/names.ts';
	let { children, data } = $props();
</script>

<!-- a thin bar at the top while the next page loads -->
{#if navigating.to}<div
		class="oa-progress"
		role="progressbar"
		aria-label={m.ow_loading()}
	></div>{/if}
<AppShell
	{...ownerArea()}
	unread={(page.data as { unreadNow?: number }).unreadNow ?? data.unread}
	accountHref="/owner/settings"
	initial={initialOf(data.user?.name ?? '')}
>
	<div class="oskin">{@render children()}</div>
</AppShell>
