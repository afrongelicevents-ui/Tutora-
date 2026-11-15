<script lang="ts">
	/**
	 * One figure with an icon and a caption (overview rows, dashboards). Show it only when
	 * the figure is real; leave the tile out otherwise.
	 * Example: <StatTile icon="clock" tone="blue" value="12.5 hrs" caption="Tutoring time" />
	 */
	import LineIcon, { type IconName } from '#lib/components/LineIcon.svelte';
	let {
		icon,
		value,
		caption,
		tone = 'blue'
	}: {
		icon: IconName;
		value: string;
		caption: string;
		tone?: 'navy' | 'blue' | 'green' | 'amber';
	} = $props();
</script>

<div class="stat">
	<span class="ui-ico {tone}"><LineIcon name={icon} size={20} /></span>
	<strong>{value}</strong>
	<span class="small muted">{caption}</span>
</div>

<style>
	.stat {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.ui-ico {
		width: 34px;
		height: 34px;
		border-radius: 50%;
	}
	strong {
		font-size: 1.375rem;
		color: var(--navy);
	}
</style>
