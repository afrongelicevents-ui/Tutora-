<script lang="ts">
	import Field from '#lib/components/Field.svelte';
	import { m, t } from '#lib/i18n.ts';
	let { data, form } = $props();
	const e = $derived((form?.errors ?? {}) as Record<string, string>);
</script>

<svelte:head><title>{m.reset_title()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<h1>{m.reset_title()}</h1>
	{#if !data.token}
		<p class="alert" role="alert">{m.reset_invalid()}</p>
		<a class="btn" href="/forgot-password">{m.forgot_submit()}</a>
	{:else}
		{#if e.form}<p class="alert" role="alert">{t(e.form)}</p>{/if}
		<form method="POST" class="stack" novalidate>
			<input type="hidden" name="token" value={data.token} />
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
