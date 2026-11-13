<script lang="ts">
	import { page } from '$app/state';
	import { m } from '#lib/i18n.ts';
	const email = $derived(page.url.searchParams.get('email'));
	// only two places to come back to: Family Connection, or booking the tutor they signed up from
	const next = $derived.by(() => {
		const n = page.url.searchParams.get('next') ?? '';
		if (n === '/code/connect') return n;
		return /^\/student\/book\?tutor=[a-z0-9-]{1,80}(&intro=1)?$/.test(n) ? n : null;
	});
</script>

<svelte:head><title>{m.verify_title()} · Tutora</title></svelte:head>

<section class="screen auth">
	<h1>{m.verify_title()}</h1>
	<p>{email ? m.verify_lead({ email }) : m.verify_lead_generic()}</p>
	<p class="muted small">{m.verify_spam()}</p>
	<a class="btn btn-secondary" href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
		>{m.nav_login()}</a
	>
</section>
