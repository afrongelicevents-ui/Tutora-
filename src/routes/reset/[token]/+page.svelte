<script lang="ts">
	import Field from '#lib/components/Field.svelte';
	import { m, t } from '#lib/i18n.ts';
	let { data, form } = $props();
	const e = $derived((form && 'errors' in form ? form.errors : {}) as Record<string, string>);
	const gone = $derived(!data.ok || !!(form && 'gone' in form && form.gone));
</script>

<svelte:head>
	<title>{m.reset_title()} · Tutora</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="wrap narrow look look-auth">
	<h1>{m.reset_title()}</h1>
	{#if gone}
		<p class="notice" role="status">{m.rl_gone()}</p>
		<a class="btn" href="/login">{m.nav_login()}</a>
	{:else}
		<p class="muted">{m.rl_page_lead({ name: data.ok ? data.name : '' })}</p>
		{#if e.form}<p class="alert" role="alert">{t(e.form, { minutes: 60 })}</p>{/if}
		<form method="POST" class="stack" novalidate>
			<Field
				name="password"
				type="password"
				label={m.field_password_new()}
				hint={m.field_password_hint()}
				autocomplete="new-password"
				required
				error={e.password}
			/>
			<Field
				name="confirm"
				type="password"
				label={m.field_password_confirm()}
				autocomplete="new-password"
				required
				error={e.confirm}
			/>
			<button class="btn btn-block" type="submit">{m.reset_submit()}</button>
		</form>
	{/if}
</section>
