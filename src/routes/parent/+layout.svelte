<script lang="ts">
	import AppShell from '#lib/components/AppShell.svelte';
	import { parentArea } from '#lib/nav.ts';
	import { page } from '$app/state';
	let { children, data } = $props();
</script>

<AppShell
	{...parentArea()}
	unread={(page.data as { unreadNow?: number }).unreadNow ?? data.unread}
	bellHref="/parent/notifications"
	accountHref="/parent/settings"
	initial={data.initial}
>
	{@render children()}
</AppShell>
