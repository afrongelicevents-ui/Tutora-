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
</script>

<svelte:head>
	<link rel="icon" href={favicon} type="image/svg+xml" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<link rel="apple-touch-icon" href="/icon-192.png" />
	<meta name="theme-color" content="#0E6B52" />
</svelte:head>

<a class="sr-only skip" href="#main">{m.skip_to_content()}</a>
<Header user={data.user} />
<main id="main">
	{@render children()}
</main>
<Footer whatsapp={data.whatsapp} />
{#if showWhatsApp}{#if data.whatsapp}<WhatsAppButton phone={data.whatsapp} />{/if}{/if}

<style>
	.skip:focus {
		position: static;
		width: auto;
		height: auto;
		clip: auto;
		display: block;
		padding: 12px;
	}
</style>
