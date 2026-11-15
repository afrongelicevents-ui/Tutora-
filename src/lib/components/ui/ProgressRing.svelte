<script lang="ts">
	/**
	 * Progress ring (any area): pct 0–100 in the middle, green/amber/red by level.
	 * Example: <ProgressRing pct={78} size={72} label="Overall progress 78%" />
	 */
	let { pct, size = 72, label = '' }: { pct: number; size?: number; label?: string } = $props();
	const r = 15.5;
	const c = 2 * Math.PI * r;
	const p = $derived(Math.max(0, Math.min(100, pct)));
	const tone = $derived(p >= 70 ? 'var(--ok)' : p >= 50 ? '#c58a1b' : '#b4433a');
</script>

<svg
	class="ring"
	width={size}
	height={size}
	viewBox="0 0 36 36"
	role="img"
	aria-label={label || `${p}%`}
>
	<circle cx="18" cy="18" {r} fill="none" stroke="var(--border)" stroke-width="3.2" />
	<circle
		cx="18"
		cy="18"
		{r}
		fill="none"
		stroke={tone}
		stroke-width="3.2"
		stroke-linecap="round"
		stroke-dasharray="{(c * p) / 100} {c}"
		transform="rotate(-90 18 18)"
	/>
	<text x="18" y="21.2" text-anchor="middle">{p}%</text>
</svg>

<style>
	.ring {
		flex-shrink: 0;
	}
	text {
		font-size: 9px;
		font-weight: 700;
		fill: var(--navy);
		font-family: var(--font);
	}
</style>
