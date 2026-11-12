<script lang="ts">
	import '#lib/styles/app.css';
	import favicon from '#lib/assets/favicon.svg';
	import Header from '#lib/components/Header.svelte';
	import Footer from '#lib/components/Footer.svelte';
	import WhatsAppButton from '#lib/components/WhatsAppButton.svelte';
	import { m } from '#lib/i18n.ts';
	import type { LayoutProps } from './$types';

	import { page } from '$app/state';

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
	const chrome = $derived(
		!(page.url.pathname === '/' && !data.user) && !under(APP) && !under(BARE)
	);
	// WhatsApp is the tutor's own number, only on that tutor's page (none on Tutora's pages)
	const whatsapp = $derived((page.data.tutorWhatsapp as string | null | undefined) ?? null);
</script>

<svelte:head>
	<link rel="icon" href={favicon} type="image/svg+xml" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<link rel="apple-touch-icon" href="/icon-192.png" />
	<meta name="theme-color" content="#3B1340" />
</svelte:head>

<a class="sr-only skip" href="#main">{m.skip_to_content()}</a>
{#if data.testSite}<div class="testbar" role="note">{m.test_site_bar()}</div>{/if}
{#if chrome}<Header user={data.user} unread={data.unread} />{/if}
<main id="main" class:bare={!chrome}>
	{@render children()}
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
