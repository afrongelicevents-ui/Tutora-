<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { page } from '$app/state';
	let { children } = $props();
	const links = [
		['/owner', m.on_tutors()],
		['/owner/students', m.on_students()],
		['/owner/bookings', m.on_bookings()],
		['/owner/payments', m.on_payments()],
		['/owner/content', m.on_content()],
		['/owner/reports', m.on_reports()],
		['/owner/audit', m.on_audit()],
		['/owner/account', m.on_account()]
	];
</script>

<nav class="wrap ownernav" aria-label={m.nav_owner()}>
	{#each links as [href, label] (href)}<a
			{href}
			aria-current={page.url.pathname === href ? 'page' : undefined}>{label}</a
		>{/each}
</nav>
{@render children()}

<style>
	.ownernav {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding-top: 8px;
	}
	.ownernav a {
		padding: 8px 12px;
		min-height: 40px;
		border-radius: 999px;
		background: var(--blush-50);
		text-decoration: none;
		font-weight: 600;
		font-size: 0.9rem;
	}
	.ownernav a[aria-current='page'] {
		background: var(--brand-700);
		color: var(--paper-50);
	}
</style>
