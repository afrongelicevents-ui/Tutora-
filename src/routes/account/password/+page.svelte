<script lang="ts">
	import Field from '#lib/components/Field.svelte';
	import { m } from '#lib/i18n.ts';
	let { form } = $props();
	const e = $derived(
		((form && 'errors' in form ? form.errors : {}) ?? {}) as Record<string, string>
	);
</script>

<svelte:head><title>{m.set_change_password()} · Tutora</title></svelte:head>

<section class="wrap narrow stack">
	<h1>{m.set_change_password()}</h1>
	<p class="muted">{m.pw_lead()}</p>
	<form method="POST" class="stack" novalidate>
		<Field
			name="currentPassword"
			type="password"
			label={m.set_current_password()}
			error={e.currentPassword}
			autocomplete="current-password"
			required
		/>
		<Field
			name="newPassword"
			type="password"
			label={m.set_new_password()}
			hint={m.field_password_hint()}
			error={e.newPassword}
			autocomplete="new-password"
			required
		/>
		<button class="btn btn-block" type="submit">{m.set_change_password()}</button>
	</form>
	<form method="POST" action="/logout">
		<button class="btn-link" type="submit">{m.nav_logout()}</button>
	</form>
</section>
