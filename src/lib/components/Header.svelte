<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import wordmark from '#lib/assets/wordmark.svg';
	import type { Role } from '#lib/roles.ts';

	let { user }: { user: { name: string; role: Role } | null } = $props();
</script>

<header>
	<div class="wrap bar">
		<a href="/" class="logo">
			<img src={wordmark} alt={m.site_name()} width="96" height="22" />
		</a>
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
					{#if user.role === 'tutor'}
						<a href="/tutor">{m.nav_tutor()}</a>
					{:else}
						<a href="/student">{m.nav_dashboard()}</a>
					{/if}
					<a href="/account">{m.nav_account()}</a>
					<form method="POST" action="/logout">
						<button class="btn-link" type="submit">{m.nav_logout()}</button>
					</form>
				{:else}
					<a href="/login">{m.nav_login()}</a>
					<a href="/signup">{m.nav_signup()}</a>
				{/if}
			</nav>
		</details>
	</div>
</header>

<style>
	header {
		background: var(--white);
		border-bottom: 1px solid var(--line);
	}
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 60px;
	}
	.logo {
		display: flex;
		align-items: center;
		min-height: 44px;
	}
	.logo img {
		width: 96px;
		height: auto;
	}
	.menu {
		position: relative;
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
