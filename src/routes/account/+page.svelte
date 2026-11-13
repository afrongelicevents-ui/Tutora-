<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import Field from '#lib/components/Field.svelte';
	import { t } from '#lib/i18n.ts';
	let { data, form } = $props();
	const e = $derived(
		((form && 'errors' in form ? form.errors : {}) ?? {}) as Record<string, string>
	);
	const roleLabel = $derived(
		data.account.role === 'tutor'
			? m.role_tutor()
			: data.account.role === 'parent'
				? m.role_parent()
				: m.role_student()
	);
</script>

<svelte:head><title>{m.account_title()} · Tutora</title></svelte:head>

<section class="wrap narrow stack">
	<h1>{m.account_title()}</h1>
	<div class="card">
		<p><strong>{data.account.name}</strong><br /><span class="muted">{data.account.email}</span></p>
		<p class="small">{m.account_role()}: <strong>{roleLabel}</strong></p>
		<p class="small">
			{m.account_2fa()}:
			<strong>{data.account.twoFactorEnabled ? m.account_2fa_on() : m.account_2fa_off()}</strong>
		</p>
		<div class="btn-row">
			<a class="btn btn-secondary" href="/account/password">{m.nav_password()}</a>
			<a class="btn btn-secondary" href="/account/2fa"
				>{data.account.twoFactorEnabled ? m.account_2fa_manage_on() : m.account_2fa_setup()}</a
			>
		</div>
	</div>

	{#if form && 'saved' in form}<p class="notice" role="status">{m.saved()}</p>{/if}
	{#if data.changed}<p class="notice" role="status">
			{m.acc_email_changed({ email: data.account.email })}
		</p>{/if}
	<form method="POST" action="?/details" class="card stack" novalidate>
		<h2 class="h3">{m.acc_details()}</h2>
		<Field name="name" label={m.set_name()} value={data.account.name} error={e.name} required />
		{#if data.account.role === 'student' || data.account.role === 'parent'}
			<Field
				name="phone"
				type="tel"
				label={m.field_phone()}
				hint={m.field_phone_hint()}
				value={data.account.phone ?? ''}
				error={e.phone}
			/>
		{/if}
		<button class="btn btn-block" type="submit">{m.save()}</button>
	</form>

	<!-- login email: every role can change it (a confirmation link goes to the new address) -->
	{#if data.account.canChangeEmail}
		<form method="POST" action="?/email" class="card stack" novalidate>
			<h2 class="h3">{m.acc_email_h()}</h2>
			<p class="small muted">{m.acc_email_now({ email: data.account.email })}</p>
			{#if form && 'emailSent' in form}<p class="notice" role="status">
					{m.acc_email_sent({ email: String(form.emailSent) })}
				</p>{/if}
			{#if form && 'emailChanged' in form}<p class="notice" role="status">
					{m.acc_email_changed({ email: String(form.emailChanged) })}
				</p>{/if}
			<Field
				name="newEmail"
				type="email"
				label={m.acc_email_new()}
				error={e.newEmail}
				required
				autocomplete="email"
			/>
			{#if !data.emailOn}
				<Field
					name="password"
					type="password"
					label={m.set_current_password()}
					hint={m.acc_email_pw_hint()}
					error={e.password}
					required
					autocomplete="current-password"
				/>
			{/if}
			<button class="btn btn-block" type="submit">{m.acc_email_btn()}</button>
		</form>
	{/if}

	<form method="POST" action="?/prefs" class="card stack">
		<h2 class="h3">{m.acc_notifications()}</h2>
		<p class="small muted">{m.acc_notifications_lead()}</p>
		<label class="check"
			><input type="checkbox" name="email" defaultChecked={!data.prefs.emailOff} />
			<span>{m.acc_pref_email()}</span></label
		>
		<label class="check"
			><input type="checkbox" name="reminders" defaultChecked={!data.prefs.remindersOff} />
			<span>{m.acc_pref_reminders()}</span></label
		>
		<label class="check"
			><input type="checkbox" name="homework" defaultChecked={!data.prefs.homeworkOff} />
			<span>{m.acc_pref_homework()}</span></label
		>
		<button class="btn btn-block" type="submit">{m.save()}</button>
	</form>

	<div class="card stack">
		<h2 class="h3">{m.acc_data()}</h2>
		<a class="btn btn-secondary btn-block" href="/account/export" download>{m.acc_download()}</a>
		{#if data.account.role !== 'owner'}
			<details>
				<summary>{m.acc_delete()}</summary>
				<form method="POST" action="?/delete" class="stack" novalidate>
					<p class="small">{m.acc_delete_lead()}</p>
					{#if form && 'deleteError' in form}<p class="alert" role="alert">
							{t(String(form.deleteError))}
						</p>{/if}
					<Field name="password" type="password" label={m.set_current_password()} required />
					<Field name="confirm" label={m.acc_delete_type()} required />
					<button class="btn btn-warn btn-block" type="submit">{m.acc_delete_btn()}</button>
				</form>
			</details>
		{/if}
	</div>
	<form method="POST" action="/logout">
		<button class="btn btn-secondary btn-block" type="submit">{m.nav_logout()}</button>
	</form>
</section>
