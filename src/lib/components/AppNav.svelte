<script lang="ts">
	import { page } from '$app/state';
	import Icon, { type IconName } from './Icon.svelte';

	let {
		items,
		label
	}: { items: { href: string; label: string; icon: IconName }[]; label: string } = $props();

	const current = (href: string) => {
		const p = page.url.pathname;
		const exact = items.some(
			(i) => i.href !== href && p.startsWith(i.href) && i.href.length > href.length
		);
		return p === href || (p.startsWith(href + '/') && !exact);
	};
</script>

<nav class="appnav" aria-label={label} style="grid-template-columns: repeat({items.length}, 1fr)">
	{#each items as item (item.href)}
		<a href={item.href} aria-current={current(item.href) ? 'page' : undefined}>
			<Icon name={item.icon} />
			<span>{item.label}</span>
		</a>
	{/each}
</nav>

<style>
	.appnav {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 40;
		display: grid;
		background: var(--white);
		border-top: 1px solid var(--line);
		padding-bottom: env(safe-area-inset-bottom);
	}
	a {
		min-height: 58px;
		display: grid;
		place-items: center;
		gap: 2px;
		padding: 6px 2px;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--ink-600);
		text-decoration: none;
	}
	a[aria-current='page'] {
		color: var(--brand-700);
	}
</style>
