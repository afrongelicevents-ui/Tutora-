<script lang="ts">
	/** Nothing to show (yet): a calm line with an icon instead of an empty list. */
	import type { Snippet } from 'svelte';
	import LineIcon, { type IconName } from '#lib/components/LineIcon.svelte';
	let {
		text,
		icon = 'check',
		children
	}: { text: string; icon?: IconName; children?: Snippet } = $props();
</script>

<div class="oa-empty">
	<span class="ui-ico green" aria-hidden="true"><LineIcon name={icon} size={20} /></span>
	<p class="grow">{text}</p>
	{#if children}{@render children()}{/if}
</div>
