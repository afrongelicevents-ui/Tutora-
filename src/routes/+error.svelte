<script lang="ts">
	import { page } from '$app/state';
	import { m } from '#lib/i18n.ts';
	const noAccess = $derived(page.status === 403);
</script>

<section class="wrap narrow stack">
	{#if noAccess}
		<h1>{m.noaccess_title()}</h1>
		<p>{m.noaccess_lead()}</p>
	{:else}
		<h1>{page.status === 404 ? m.err_not_found() : m.err_title()}</h1>
		{#if page.status !== 404 && page.error?.message}<p>{page.error.message}</p>{/if}
	{/if}
	<a class="btn" href="/">{m.err_back_home()}</a>
</section>
