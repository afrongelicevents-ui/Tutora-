<script lang="ts">
	import Field from '#lib/components/Field.svelte';
	import { m, t } from '#lib/i18n.ts';
	let { form } = $props();
	const e = $derived((form && 'errors' in form ? form.errors : {}) as Record<string, string>);
	const v = $derived((form && 'values' in form ? form.values : {}) as Record<string, string>);
</script>

<svelte:head><title>{m.forgot_title()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<h1>{m.forgot_title()}</h1>
	{#if form && 'sent' in form}
		<p class="notice" role="status">{m.forgot_sent()}</p>
	{:else}
		<p class="muted">{m.forgot_lead()}</p>
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
				value={v.email ?? ''}
				error={e.email}
			/>
			<button class="btn btn-block" type="submit">{m.forgot_submit()}</button>
		</form>
	{/if}
</section>
