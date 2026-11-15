<script lang="ts">
	import '#lib/styles/app.css';
	import favicon from '#lib/assets/favicon.svg';
	import Header from '#lib/components/Header.svelte';
	import Footer from '#lib/components/Footer.svelte';
	import WhatsAppButton from '#lib/components/WhatsAppButton.svelte';
	import { m } from '#lib/i18n.ts';
	import type { LayoutProps } from './$types';

	import { page } from '$app/state';
	import AppShell from '#lib/components/AppShell.svelte';
	import { areaFor } from '#lib/nav.ts';
	import { initialOf } from '#lib/names.ts';

	let { children, data }: LayoutProps = $props();

	// The floating button is for public pages; on forms and private areas it would cover fields.
	const PRIVATE = [
		'/room',
		'/setup',
		'/login',
		'/signup',
		'/account',
		'/tutor',
		'/student',
		'/forgot-password',
		'/reset-password',
		'/verify-email'
	];
	const showWhatsApp = $derived(!PRIVATE.some((p) => page.url.pathname.startsWith(p)));
	// App areas bring their own navigation (AppShell); welcome and sign-in screens are full-screen.
	const APP = ['/student', '/parent', '/tutor'];
	const BARE = [
		'/get-started',
		'/login',
		'/signup',
		'/code',
		'/forgot-password',
		'/reset-password',
		'/verify-email',
		'/setup',
		'/room'
	];
	const under = (list: string[]) =>
		list.some((p) => page.url.pathname === p || page.url.pathname.startsWith(p + '/'));
	// the shared pages keep the signed-in person's own area shell (tabs / side navigation)
	const area = $derived(under(['/notifications', '/account']) ? areaFor(data.user?.role) : null);
	const chrome = $derived(
		!(page.url.pathname === '/' && !data.user) && !under(APP) && !under(BARE) && !area
	);
	// WhatsApp is the tutor's own number, only on that tutor's page (none on Tutora's pages)
	const whatsapp = $derived((page.data.tutorWhatsapp as string | null | undefined) ?? null);
</script>

<svelte:head>
	<link rel="icon" href={favicon} type="image/svg+xml" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<link rel="apple-touch-icon" href="/icon-192.png" />
	<meta name="theme-color" content="#0B2545" />
</svelte:head>

<a class="sr-only skip" href="#main">{m.skip_to_content()}</a>
{#if data.testSite}<div class="testbar" role="note">{m.test_site_bar()}</div>{/if}
{#if chrome}<Header user={data.user} unread={data.unread} />{/if}
<main id="main" class:bare={!chrome}>
	{#if area}
		<AppShell
			{...area}
			unread={(page.data as { unreadNow?: number }).unreadNow ?? data.unread}
			bellHref={data.user?.role === 'parent' ? '/parent/notifications' : '/notifications'}
			accountHref={data.user?.role === 'parent' ? '/parent/settings' : '/account'}
			initial={data.user?.role === 'tutor' ? '' : initialOf(data.user?.name ?? '')}
		>
			{#if data.user?.role === 'student'}<div class="st-area">{@render children()}</div>
			{:else if data.user?.role === 'tutor'}<div class="tskin">{@render children()}</div>
			{:else}{@render children()}{/if}
		</AppShell>
	{:else}
		{@render children()}
	{/if}
</main>
{#if chrome}<Footer {whatsapp} />{/if}
{#if showWhatsApp && whatsapp}<div class="fab-space" aria-hidden="true"></div>
	<WhatsAppButton phone={whatsapp} />{/if}

<style>
	.fab-space {
		height: 72px;
	}
	.testbar {
		position: relative;
		z-index: 50;
		background: #b45309;
		color: #fff;
		font-weight: 700;
		text-align: center;
		padding: 6px 12px;
		font-size: 14px;
	}
	.skip:focus {
		position: static;
		width: auto;
		height: auto;
		clip: auto;
		display: block;
		padding: 12px;
	}
</style>
