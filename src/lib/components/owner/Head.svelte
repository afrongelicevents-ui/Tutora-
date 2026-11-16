<script lang="ts">
	/** Page title in Tutora admin: coloured icon, serif title with a gold underline, lead. */
	import type { Snippet } from 'svelte';
	import LineIcon, { type IconName } from '#lib/components/LineIcon.svelte';
	let {
		title,
		lead = '',
		icon,
		tone = 'blue',
		children
	}: {
		title: string;
		lead?: string;
		icon: IconName;
		tone?: 'navy' | 'blue' | 'green' | 'amber';
		/** buttons on the right */
		children?: Snippet;
	} = $props();
</script>

<header class="oa-head">
	<span class="ui-ico {tone}" aria-hidden="true"><LineIcon name={icon} size={24} /></span>
	<div class="grow">
		<h1>{title}</h1>
		{#if lead}<p class="lead">{lead}</p>{/if}
	</div>
	{#if children}<div class="acts">{@render children()}</div>{/if}
</header>
