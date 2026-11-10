<script lang="ts">
	import { page } from '$app/state';
	import { m } from '#lib/i18n.ts';
</script>

<section class="wrap narrow stack">
	<h1>{page.status === 404 ? m.err_not_found() : m.err_title()}</h1>
	{#if page.status !== 404 && page.error?.message}<p>{page.error.message}</p>{/if}
	<a class="btn" href="/">{m.err_back_home()}</a>
</section>
