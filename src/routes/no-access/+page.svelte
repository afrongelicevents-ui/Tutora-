<script lang="ts">
	import { m } from '#lib/i18n.ts';
	let { data } = $props();
	const forWho = $derived(
		data.area === 'tutor'
			? m.noaccess_tutors()
			: data.area === 'owner'
				? m.noaccess_owner()
				: data.area === 'student'
					? m.noaccess_students()
					: m.noaccess_lead()
	);
</script>

<svelte:head><title>{m.noaccess_title()} · Tutora</title></svelte:head>

<section class="wrap narrow stack">
	{#if data.loggedIn}
		<h1>{m.noaccess_title()}</h1>
		<p>{forWho}</p>
		<a class="btn btn-block" href={data.home}>{m.noaccess_my_area()}</a>
		<a class="btn btn-secondary btn-block" href="/">{m.err_back_home()}</a>
	{:else}
		<h1>{m.noaccess_login_title()}</h1>
		<p>{m.noaccess_login_lead()}</p>
		<a class="btn btn-block" href="/login">{m.nav_login()}</a>
		<a class="btn btn-secondary btn-block" href="/">{m.err_back_home()}</a>
	{/if}
</section>
