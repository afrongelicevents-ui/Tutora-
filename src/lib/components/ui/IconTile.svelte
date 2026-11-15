<script lang="ts">
	/**
	 * A tappable tile with a coloured icon over a short label (quick actions, features).
	 * tone: 'navy' | 'blue' | 'green' | 'amber'. Optional badge number (only real counts).
	 * Example: <IconTile href="/parent/progress" icon="progress" tone="green" label="Progress" />
	 */
	import LineIcon, { type IconName } from '#lib/components/LineIcon.svelte';
	let {
		href,
		icon,
		label,
		tone = 'blue',
		badge = 0
	}: {
		href: string;
		icon: IconName;
		label: string;
		tone?: 'navy' | 'blue' | 'green' | 'amber';
		badge?: number;
	} = $props();
</script>

<a class="itile" {href}
	><span class="ui-ico {tone}"
		><LineIcon name={icon} size={22} />{#if badge}<span class="badge"
				>{badge > 9 ? '9+' : badge}</span
			>{/if}</span
	>{label}</a
>

<style>
	.itile {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 14px 6px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 18px;
		box-shadow: var(--shadow-soft);
		text-align: center;
		text-decoration: none;
		color: var(--navy);
		font-size: 0.875rem;
		font-weight: 600;
		overflow-wrap: anywhere;
		hyphens: auto;
	}
	@media (max-width: 420px) {
		.itile {
			font-size: 0.75rem;
			padding: 12px 4px;
		}
	}
	.ui-ico {
		position: relative;
	}
	.badge {
		position: absolute;
		top: -6px;
		right: -8px;
		min-width: 20px;
		height: 20px;
		padding: 0 5px;
		border-radius: 999px;
		background: #c53030;
		color: #fff;
		font-size: 0.75rem;
		display: grid;
		place-items: center;
	}
</style>
