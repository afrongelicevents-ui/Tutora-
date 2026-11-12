<script lang="ts">
	// A person's round photo, or their initials on a calm blue circle.
	import { avatarColour, initialsOf } from '#lib/components/profile/ProfileCard.svelte';
	let {
		name,
		src = null,
		size = 48
	}: { name: string; src?: string | null; size?: number } = $props();
</script>

{#if src}
	<img class="face" {src} alt="" width={size} height={size} loading="lazy" style="--s:{size}px" />
{:else}
	<span
		class="face ini"
		aria-hidden="true"
		style="--s:{size}px;background:{avatarColour(name)};font-size:{Math.round(size * 0.36)}px"
		>{initialsOf(name)}</span
	>
{/if}

<style>
	.face {
		width: var(--s);
		height: var(--s);
		border-radius: 50%;
		object-fit: cover;
		flex: none;
		display: block;
	}
	.ini {
		display: grid;
		place-items: center;
		color: #fff;
		font-family: var(--font-display);
		font-weight: 600;
	}
</style>
