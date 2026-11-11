<script lang="ts">
	import { page } from '$app/state';
	import Field from '#lib/components/Field.svelte';
	import { m, t } from '#lib/i18n.ts';
	let { form } = $props();
	const v = $derived((form?.values ?? {}) as Record<string, string>);
	const e = $derived((form?.errors ?? {}) as Record<string, string>);
</script>

<svelte:head><title>{m.login_title()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<h1>{m.login_title()}</h1>
	{#if page.url.searchParams.has('reset')}<p class="notice" role="status">{m.reset_done()}</p>{/if}
	{#if page.url.searchParams.has('claimed')}<p class="notice" role="status">
			{m.login_claimed()}
		</p>{/if}
	{#if e.form}<p class="alert" role="alert">
			{t(e.form, { minutes: form?.retryMinutes ?? 1 })}
		</p>{/if}
	<form method="POST" class="stack" novalidate>
		<Field
			name="email"
			type="email"
			label={m.field_email()}
			autocomplete="email"
			required
			value={v.email ?? ''}
			error={e.email}
		/>
		<Field
			name="password"
			type="password"
			label={m.field_password()}
			autocomplete="current-password"
			required
			error={e.password}
		/>
		<button class="btn btn-block" type="submit">{m.login_submit()}</button>
	</form>
	<p><a href="/forgot-password">{m.login_forgot()}</a></p>
	<p class="small">{m.login_no_account()} <a href="/signup">{m.nav_signup()}</a></p>
</section>
