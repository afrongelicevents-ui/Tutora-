<script lang="ts">
	/**
	 * A person card (child, student, tutor, teacher): avatar, serif name, an optional pill
	 * (level, role), an optional action link on the right, and any extra content below.
	 * Example: <PersonCard name="Tatenda" pill="Form 3" href="/parent/child/x" action="View" />
	 */
	import type { Snippet } from 'svelte';
	import Avatar from './Avatar.svelte';
	let {
		name,
		photo = null,
		pill = null,
		href = null,
		action = null,
		size = 64,
		children
	}: {
		name: string;
		photo?: string | null;
		pill?: string | null;
		href?: string | null;
		action?: string | null;
		size?: number;
		children?: Snippet;
	} = $props();
</script>

<article class="ui-card person">
	<div class="top">
		<Avatar {name} {photo} {size} />
		<div class="id">
			<h3 class="ui-serif">{name}</h3>
			{#if pill}<span class="ui-pill">{pill}</span>{/if}
		</div>
		{#if href && action}<a class="ui-btn-soft" {href}>{action} ›</a>{/if}
	</div>
	{@render children?.()}
</article>

<style>
	.person {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.top {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.id {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
		align-items: flex-start;
	}
	h3 {
		margin: 0;
		font-size: 1.375rem;
	}
</style>
