<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import type { Role } from '#lib/roles.ts';

	let { user, unread = 0 }: { user: { name: string; role: Role } | null; unread?: number } =
		$props();
</script>

<header>
	<div class="wrap bar">
		<a href="/" class="wordmark">Tutora</a>
		{#if user}<a
				class="bell"
				href="/notifications"
				aria-label={unread ? m.notif_unread({ n: unread }) : m.notif_title()}
				><svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"
					><path
						d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2Zm4 4h4"
						stroke="currentColor"
						stroke-width="2"
						stroke-linejoin="round"
					/></svg
				>{#if unread}<span class="dot">{unread > 9 ? '9+' : unread}</span>{/if}</a
			>{/if}
		<details class="menu">
			<summary aria-label={m.nav_menu()}>
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<path
						d="M4 7h16M4 12h16M4 17h16"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
					/>
				</svg>
			</summary>
			<nav>
				<a href="/">{m.nav_home()}</a>
				{#if user}
					{#if user.role === 'owner'}
						<a href="/owner">{m.nav_owner()}</a>
					{:else if user.role === 'tutor'}
						<a href="/tutor">{m.nav_tutor()}</a>
						<a href="/tutor/calendar">{m.tnav_calendar()}</a>
						<a href="/tutor/settings">{m.settings_title()}</a>
					{:else}
						<a href={user.role === 'parent' ? '/parent' : '/student'}>{m.nav_dashboard()}</a>
					{/if}
					<a href="/notifications">{m.notif_title()}</a>
					<a href="/account">{m.nav_account()}</a>
					<form method="POST" action="/logout">
						<button class="btn-link" type="submit">{m.nav_logout()}</button>
					</form>
				{:else}
					<a href="/tutors">{m.find_a_tutor()}</a>
					<a href="/login">{m.nav_login()}</a>
					<a href="/get-started">{m.v3_get_started()}</a>
				{/if}
			</nav>
		</details>
	</div>
</header>

<style>
	header {
		background: var(--paper-50);
	}
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 60px;
	}
	.menu {
		position: relative;
	}
	.bell {
		position: relative;
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		margin-left: auto;
		color: var(--ink-900);
	}
	.dot {
		position: absolute;
		top: 6px;
		right: 4px;
		min-width: 18px;
		height: 18px;
		padding: 0 4px;
		border-radius: 9px;
		background: var(--clay-600);
		color: #fff;
		font-size: 11px;
		font-weight: 700;
		line-height: 18px;
		text-align: center;
	}
	summary {
		list-style: none;
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		cursor: pointer;
		color: var(--ink-900);
		border-radius: 10px;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	nav {
		position: absolute;
		right: 0;
		top: 52px;
		z-index: 20;
		display: grid;
		min-width: 220px;
		padding: 8px;
		background: var(--white);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.12);
	}
	nav a,
	nav :global(.btn-link) {
		display: flex;
		align-items: center;
		min-height: 48px;
		padding: 0 12px;
		color: var(--ink-900);
		text-decoration: none;
		font-weight: 600;
		width: 100%;
		text-align: left;
	}
	nav a:hover {
		background: var(--mint-50);
		border-radius: 8px;
	}
</style>
