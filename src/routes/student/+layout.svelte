<script lang="ts">
	import { initialOf } from '#lib/names.ts';
	import AppShell from '#lib/components/AppShell.svelte';
	import { studentArea } from '#lib/nav.ts';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import { m } from '#lib/i18n.ts';
	import { familyFeatureFor } from '#lib/family-features.ts';
	let { children, data } = $props();
	// free level: label every link to a Tutora Family page before it is tapped
	let area: HTMLElement | undefined = $state();
	function labelPaid() {
		if (!area || (data as { familyActive?: boolean }).familyActive !== false) return;
		for (const a of area.querySelectorAll<HTMLAnchorElement>('a[href]')) {
			const path = new URL(a.href, location.href).pathname;
			if (familyFeatureFor(path)) a.dataset.fam = m.fb_family_pill();
		}
	}
	afterNavigate(() => labelPaid());
	$effect(() => {
		void page.url.pathname;
		labelPaid();
	});
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
	<div class="st-area" bind:this={area}>{@render children()}</div>
</AppShell>

<style>
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
