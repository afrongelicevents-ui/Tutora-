<script lang="ts">
	import { m } from '#lib/i18n.ts';
	let { data } = $props();
</script>

<svelte:head><title>{m.tstatus_title()} · Tutora</title></svelte:head>

<section class="wrap narrow stack">
	{#if data.status === 'suspended'}
		<h1>{m.tstatus_suspended_title()}</h1>
		<p>{m.tstatus_suspended()}</p>
	{:else}
		<h1>{m.tstatus_title()}</h1>
		<p>{m.tstatus_pending()}</p>
		<ol class="small">
			<li>{m.tstatus_next1()}</li>
			<li>{m.tstatus_next2()}</li>
			<li>{m.tstatus_next3()}</li>
		</ol>
		{#if !data.twoFactor}
			<p class="small">{m.tstatus_2fa()}</p>
			<a class="btn btn-secondary btn-block" href="/account/2fa">{m.account_2fa_manage()}</a>
		{/if}
		<a class="btn btn-block" href="/tutor-status">{m.tstatus_check()}</a>
	{/if}
	<form method="POST" action="/logout">
		<button class="btn-link" type="submit">{m.nav_logout()}</button>
	</form>
</section>
