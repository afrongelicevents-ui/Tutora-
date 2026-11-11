<script lang="ts">
	import Field from '#lib/components/Field.svelte';
	import { m } from '#lib/i18n.ts';
	let { data, form } = $props();
	const e = $derived(
		((form && 'errors' in form ? form.errors : {}) ?? {}) as Record<string, string>
	);
</script>

<svelte:head><title>{m.owner_my_account()} · Tutora</title></svelte:head>

<section class="wrap narrow stack">
	<h1>{m.owner_my_account()}</h1>
	<div class="card stack">
		<p class="small">{m.set_login_email()}: <b>{data.email}</b></p>
		{#if form && 'emailSent' in form}
			<p class="notice" role="status">{m.set_email_sent({ email: String(form.emailSent) })}</p>
		{/if}
		{#if form && 'emailChanged' in form}
			<p class="notice" role="status">{m.set_email_changed()}</p>
		{/if}
		<form method="POST" action="?/changeEmail" class="stack" novalidate>
			<Field
				name="newEmail"
				type="email"
				label={m.set_new_email()}
				error={e.newEmail}
				autocomplete="email"
			/>
			{#if !data.emailOn}
				<Field
					name="password"
					type="password"
					label={m.set_current_password()}
					error={e.password}
					autocomplete="current-password"
				/>
			{/if}
			<button class="btn btn-secondary btn-block" type="submit">{m.set_change_email()}</button>
		</form>
	</div>
	<div class="card stack">
		<h2 class="h3">{m.set_change_password()}</h2>
		{#if form && 'passwordChanged' in form}
			<p class="notice" role="status">{m.set_password_changed()}</p>
		{/if}
		<form method="POST" action="?/changePassword" class="stack" novalidate>
			<Field
				name="currentPassword"
				type="password"
				label={m.set_current_password()}
				error={e.currentPassword}
				autocomplete="current-password"
			/>
			<Field
				name="newPassword"
				type="password"
				label={m.set_new_password()}
				hint={m.field_password_hint()}
				error={e.newPassword}
				autocomplete="new-password"
			/>
			<button class="btn btn-secondary btn-block" type="submit">{m.set_change_password()}</button>
		</form>
		<a class="btn btn-secondary" href="/account/2fa">{m.account_2fa_manage()}</a>
	</div>
	<a href="/owner">{m.nav_owner()}</a>
</section>
