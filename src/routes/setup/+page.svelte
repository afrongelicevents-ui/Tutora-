<script lang="ts">
	import Field from '#lib/components/Field.svelte';
	import { m, t } from '#lib/i18n.ts';
	let { data, form } = $props();
	const e = $derived((form && 'errors' in form ? form.errors : {}) as Record<string, string>);
</script>

<svelte:head><title>{m.setup_title()} · Tutora</title></svelte:head>

<section class="wrap narrow stack">
	<h1>{m.setup_title()}</h1>
	{#if data.done}
		<p class="notice">{m.setup_done()}</p>
		<a class="btn" href="/login">{m.nav_login()}</a>
	{:else if form && 'sent' in form}
		<p class="notice" role="status">{m.setup_sent()}</p>
	{:else}
		<p class="muted">{m.setup_lead()}</p>
		{#if e.form}<p class="alert" role="alert">
				{t(e.form, { minutes: (form as { retryMinutes?: number })?.retryMinutes ?? 60 })}
			</p>{/if}
		<form method="POST" class="stack" novalidate>
			<Field
				name="email"
				type="email"
				label={m.field_email()}
				autocomplete="email"
				required
				error={e.email}
			/>
			<button class="btn btn-block" type="submit">{m.setup_submit()}</button>
		</form>
	{/if}
</section>
