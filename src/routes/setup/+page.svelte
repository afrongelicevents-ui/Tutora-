<script lang="ts">
	import Field from '#lib/components/Field.svelte';
	import { m, t } from '#lib/i18n.ts';
	let { data, form } = $props();
	const e = $derived((form && 'errors' in form ? form.errors : {}) as Record<string, string>);
	const v = $derived((form && 'values' in form ? form.values : {}) as Record<string, string>);
</script>

<svelte:head><title>{m.setup_title()} · Tutora</title></svelte:head>

<section class="wrap narrow stack">
	<h1>{m.setup_owner_title()}</h1>
	{#if data.done}
		<p class="notice">{m.setup_done()}</p>
		<a class="btn" href="/login">{m.nav_login()}</a>
	{:else}
		<p class="muted">{m.setup_lead_owner()}</p>
		{#if e.form}<p class="alert" role="alert">
				{t(e.form, { minutes: (form as { retryMinutes?: number })?.retryMinutes ?? 60 })}
			</p>{/if}
		<form method="POST" class="stack" novalidate>
			<Field
				name="code"
				label={m.setup_code()}
				hint={m.setup_code_hint()}
				autocomplete="one-time-code"
				autocapitalize="characters"
				spellcheck="false"
				value={v.code ?? data.code}
				error={e.code}
				required
			/>
			<Field
				name="name"
				label={m.set_name()}
				hint={m.set_name_hint()}
				autocomplete="name"
				value={v.name ?? ''}
				error={e.name}
				required
			/>
			<Field
				name="email"
				type="email"
				label={m.field_email()}
				autocomplete="email"
				value={v.email ?? ''}
				error={e.email}
				required
			/>
			<Field
				name="password"
				type="password"
				label={m.field_password()}
				hint={m.field_password_hint()}
				autocomplete="new-password"
				error={e.password}
				required
			/>
			<Field
				name="confirm"
				type="password"
				label={m.field_password_confirm()}
				autocomplete="new-password"
				error={e.confirm}
				required
			/>
			<button class="btn btn-block" type="submit">{m.setup_create()}</button>
		</form>
	{/if}
</section>
