<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { m } from '#lib/i18n.ts';
	import LineIcon, { type IconName } from '#lib/components/LineIcon.svelte';

	export interface NavItem {
		href: string;
		label: string;
		/** extra paths that belong to this tab */
		also?: string[];
		/** small line icon above the label in the phone tab bar (optional) */
		icon?: IconName;
	}

	let {
		tabs,
		more = [],
		tag,
		label,
		unread = 0,
		children
	}: {
		/** the bottom tab bar on phones (and the first part of the side navigation) */
		tabs: NavItem[];
		/** only in the side navigation on wide screens (on phones they are linked from screens) */
		more?: NavItem[];
		/** small label next to the wordmark: Student, Family, Tutor */
		tag: string;
		label: string;
		unread?: number;
		children: Snippet;
	} = $props();

	const path = $derived(page.url.pathname);
	const matches = (h: string) => path === h || path.startsWith(h + '/');
	/** How specifically an item matches this page (longest matching path), or -1. */
	const score = (item: NavItem) =>
		Math.max(-1, ...[item.href, ...(item.also ?? [])].filter(matches).map((h) => h.length));
	// only the most specific item is current ("/tutor/reviews" is More, not Today)
	function isOn(item: NavItem, all: NavItem[]) {
		const mine = score(item);
		return mine >= 0 && all.every((o) => o === item || score(o) <= mine);
	}
	const all = $derived([...tabs, ...more]);
</script>

<div class="shell">
	<aside class="side" aria-label={label}>
		<a class="wordmark" href={tabs[0].href}>Tutora</a>
		<span class="tag">{tag}</span>
		<nav>
			{#each all as item (item.href)}
				<a href={item.href} aria-current={isOn(item, all) ? 'page' : undefined}>{item.label}</a>
			{/each}
		</nav>
		<div class="side-foot">
			<a href="/notifications" aria-current={path === '/notifications' ? 'page' : undefined}
				>{m.notif_title()}{#if unread}<span class="count">{unread > 9 ? '9+' : unread}</span
					>{/if}</a
			>
			<a href="/account" aria-current={path.startsWith('/account') ? 'page' : undefined}
				>{m.nav_settings()}</a
			>
			<form method="POST" action="/logout">
				<button type="submit">{m.nav_logout()}</button>
			</form>
		</div>
	</aside>

	<div class="main-col">
		<div class="topbar">
			<a class="wordmark" href={tabs[0].href}>Tutora</a>
			<div class="top-right">
				<a
					class="bell"
					href="/notifications"
					aria-label={unread ? m.notif_unread({ n: unread }) : m.notif_title()}
					><svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"
						><path
							d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2Zm4 4h4"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linejoin="round"
						/></svg
					>{#if unread}<span class="count">{unread > 9 ? '9+' : unread}</span>{/if}</a
				>
				<a class="acct" href="/account">{m.nav_settings()}</a>
			</div>
		</div>
		{@render children()}
	</div>

	<nav
		class="tabbar"
		aria-label={label}
		style="grid-template-columns: repeat({tabs.length}, minmax(0, 1fr))"
	>
		{#each tabs as item (item.href)}
			<a
				href={item.href}
				class:has-icon={!!item.icon}
				aria-current={isOn(item, all) ? 'page' : undefined}
				>{#if item.icon}<LineIcon name={item.icon} />{/if}<span>{item.label}</span></a
			>
		{/each}
	</nav>
</div>

<style>
	.shell {
		min-height: 100dvh;
		padding-bottom: calc(60px + env(safe-area-inset-bottom));
	}
	.side {
		display: none;
	}
	.topbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 22px 0;
		max-width: 720px;
		margin: 0 auto;
	}
	.top-right {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.bell,
	.acct {
		position: relative;
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		min-width: 44px;
		justify-content: center;
		color: var(--navy);
		text-decoration: none;
		font-size: 0.875rem;
		font-weight: 600;
	}
	.count {
		display: inline-block;
		min-width: 18px;
		padding: 1px 5px;
		border-radius: 99px;
		background: var(--navy);
		color: var(--snow);
		font-size: 0.6875rem;
		font-weight: 700;
		text-align: center;
	}
	.bell .count {
		position: absolute;
		top: 4px;
		right: 0;
	}
	.tabbar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 40;
		display: grid;
		background: #fff;
		border-top: 1px solid var(--border);
		padding: 0 2px env(safe-area-inset-bottom);
	}
	.tabbar a {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 58px;
		border-top: 2px solid transparent;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--muted);
		text-decoration: none;
		text-align: center;
		line-height: 1.15;
	}
	.tabbar a[aria-current='page'] {
		border-top-color: var(--navy);
		color: var(--navy);
		font-weight: 700;
	}
	/* tabs with an icon: icon over label, a short navy bar under the active one */
	.tabbar a.has-icon {
		flex-direction: column;
		gap: 3px;
		min-height: 62px;
		border-top: 0;
		position: relative;
		color: var(--muted); /* muted blue-grey: 6.2:1 on white */
	}
	.tabbar a.has-icon[aria-current='page'] {
		color: var(--navy);
	}
	.tabbar a.has-icon[aria-current='page']::after {
		content: '';
		position: absolute;
		bottom: 4px;
		left: 50%;
		width: 28px;
		height: 3px;
		margin-left: -14px;
		border-radius: 99px;
		background: var(--ocean);
	}
	@media (min-width: 900px) {
		.shell {
			display: grid;
			grid-template-columns: 240px minmax(0, 1fr);
			padding-bottom: 0;
		}
		.tabbar,
		.topbar {
			display: none;
		}
		.side {
			position: sticky;
			top: 0;
			height: 100dvh;
			display: flex;
			flex-direction: column;
			gap: 6px;
			padding: 26px 18px;
			border-right: 1px solid var(--border);
			background: #fff;
		}
		.side .tag {
			align-self: flex-start;
			margin: 2px 0 18px;
		}
		.side nav,
		.side-foot {
			display: flex;
			flex-direction: column;
		}
		.side a,
		.side button {
			display: flex;
			justify-content: space-between;
			align-items: center;
			min-height: 42px;
			padding: 0 12px;
			border-radius: 10px;
			color: var(--text);
			text-decoration: none;
			font: inherit;
			font-size: 0.9375rem;
			background: none;
			border: none;
			cursor: pointer;
			text-align: left;
		}
		.side a:hover,
		.side button:hover {
			background: var(--snow);
		}
		.side a[aria-current='page'] {
			background: var(--ice);
			color: var(--navy);
			font-weight: 700;
		}
		.side .wordmark {
			font-size: 1.75rem;
			padding: 0 12px;
			min-height: 0;
		}
		.side-foot {
			margin-top: auto;
			border-top: 1px solid var(--border);
			padding-top: 10px;
		}
	}
</style>
