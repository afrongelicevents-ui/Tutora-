<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { waLink } from '#lib/whatsapp.ts';
	let { data } = $props();
</script>

<svelte:head>
	<title>Tutora — {m.home_title()}</title>
	<meta name="description" content={m.home_intro()} />
</svelte:head>

<section class="wrap narrow stack">
	<h1>{m.home_title()}</h1>
	<p class="muted">{m.home_intro()}</p>
	<a class="btn btn-block" href={data.user ? '/student' : '/signup'}>{m.home_book()}</a>
	<a
		class="btn btn-secondary btn-block"
		href={waLink(data.whatsapp, m.whatsapp_prefill())}
		target="_blank"
		rel="noopener noreferrer">{m.home_intro_chat()}</a
	>
	<p class="notice small">{m.home_coming_soon()}</p>
</section>
