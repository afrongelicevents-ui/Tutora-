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
		['/owner/moderation', m.om_link()],
		['/owner/audit', m.on_audit()],
		['/owner/limits', m.on_limits()],
		['/owner/account', m.on_account()]
	];
</script>

<nav class="wrap narrow ownernav" aria-label={m.nav_owner()}>
	{#each links as [href, label] (href)}<a
			{href}
			aria-current={page.url.pathname === href ? 'page' : undefined}>{label}</a
		>{/each}
</nav>
{@render children()}

<style>
	/* one scrollable row of pills on phones, wrapping on wide screens */
	.ownernav {
		display: flex;
		gap: 8px;
		padding-top: 14px;
		padding-bottom: 6px;
		margin-bottom: 10px;
		overflow-x: auto;
		scrollbar-width: none;
		-webkit-mask-image: linear-gradient(90deg, #000 88%, transparent);
		mask-image: linear-gradient(90deg, #000 88%, transparent);
	}
	.ownernav::-webkit-scrollbar {
		display: none;
	}
	.ownernav a {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		padding: 0 14px;
		min-height: 40px;
		border-radius: 999px;
		background: #fff;
		border: 1px solid var(--border);
		box-shadow: 0 1px 2px rgb(11 37 69 / 0.05);
		color: var(--navy);
		text-decoration: none;
		font-weight: 600;
		font-size: 0.9rem;
		white-space: nowrap;
	}
	.ownernav a[aria-current='page'] {
		background: var(--navy);
		border-color: var(--navy);
		color: #fff;
	}
	@media (min-width: 900px) {
		.ownernav {
			flex-wrap: wrap;
			-webkit-mask-image: none;
			mask-image: none;
		}
	}
</style>
