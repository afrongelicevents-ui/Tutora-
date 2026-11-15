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
