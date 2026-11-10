<script lang="ts">
	import { page } from '$app/state';
	import { m } from '#lib/i18n.ts';
	const email = $derived(page.url.searchParams.get('email'));
</script>

<svelte:head><title>{m.verify_title()} · Tutora</title></svelte:head>

<section class="wrap narrow stack">
	<h1>{m.verify_title()}</h1>
	<p>{email ? m.verify_lead({ email }) : m.verify_lead_generic()}</p>
	<p class="muted small">{m.verify_spam()}</p>
	<a class="btn btn-secondary" href="/login">{m.nav_login()}</a>
</section>
