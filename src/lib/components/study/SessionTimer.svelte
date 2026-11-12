<script lang="ts">
	// The server sends the start and planned end, so the page is right without JavaScript;
	// this only counts the minutes down while the page is open.
	import { m } from '#lib/i18n.ts';
	import { onMount } from 'svelte';
	let { endsAt, now }: { endsAt: Date; now: Date } = $props();
	let clock = $state<number | null>(null);
	onMount(() => {
		clock = Date.now();
		const t = setInterval(() => (clock = Date.now()), 15_000);
		return () => clearInterval(t);
	});
	const left = $derived(
		Math.max(0, Math.ceil((endsAt.getTime() - (clock ?? now.getTime())) / 60_000))
	);
</script>

<span class="left" aria-live="polite"
	>{left > 0 ? m.st5_min_left({ n: left }) : m.st5_time_up()}</span
>

<style>
	.left {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 2.25rem;
		line-height: 1.1;
		color: var(--ivory);
	}
</style>
