<script lang="ts">
	import Field from '#lib/components/Field.svelte';
	import BotTrap from '#lib/components/BotTrap.svelte';
	import { m, t } from '#lib/i18n.ts';
	let { data, form } = $props();
	const inv = $derived(data.invite);
	const v = $derived(((form as { values?: Record<string, string> } | null)?.values ?? {}) as Record<string, string>);
	const e = $derived(((form as { errors?: Record<string, string> } | null)?.errors ?? {}) as Record<string, string>);
	let clicked = $state(false);
	const creating = $derived(clicked || data.create);
	const roleName = (r: string) =>
		r === 'tutor' ? m.v3_role_tutor() : r === 'owner' ? m.v3_role_owner() : m.v3_role_student();
</script>

<svelte:head><title>{m.v3_code_title()} · Tutora</title></svelte:head>

<section class="screen auth">
	<a class="back" href="/code" aria-label={m.v3_back()}>←</a>
	<h1>{data.me?.role === 'parent' ? m.v3_code_connect_title({ name: inv.firstName }) : m.v3_code_title()}</h1>
	<div class="softcard">
		{inv.level
			? m.v3_code_from_level({ name: inv.firstName, level: inv.level })
			: m.v3_code_from({ name: inv.firstName })}
	</div>
	<p class="note">{m.v3_code_what()}</p>
	{#if (form as { error?: string } | null)?.error}<p class="alert" role="alert">
			{t((form as { error: string }).error)}
		</p>{/if}

	{#if data.me && data.me.role !== 'parent'}
		<p class="alert" role="alert">{m.v3_code_not_parent({ role: roleName(data.me.role) })}</p>
		<form method="POST" action="/logout"><button class="btn btn-ghost btn-block">{m.nav_logout()}</button></form>
	{:else if data.me}
		<form method="POST" action="?/connect" class="stack">
			{#if inv.isUnder18}
				<label class="check"
					><input type="checkbox" name="guardian" />
					<span>{m.v3_code_guardian({ name: inv.firstName })}<br /><span class="note"
							>{m.v3_code_guardian_hint({ name: inv.firstName })}</span
						></span></label
				>
			{/if}
			<button class="btn btn-block" type="submit">{m.v3_code_connect()}</button>
		</form>
	{:else if creating || e.form || Object.keys(e).length}
		<h2 class="h3">{m.v3_parent_signup_title()}</h2>
		{#if e.form}<p class="alert" role="alert">
				{t(e.form, { minutes: (form as { retryMinutes?: number } | null)?.retryMinutes ?? 60 })}
			</p>{/if}
		<form method="POST" action="?/signup" class="stack" novalidate>
			<BotTrap />
			<Field name="name" label={m.field_name()} autocomplete="name" required value={v.name ?? ''} error={e.name} />
			<Field name="email" type="email" label={m.field_email()} autocomplete="email" required value={v.email ?? ''} error={e.email} />
			<Field
				name="password"
				type="password"
				label={m.field_password()}
				hint={m.field_password_hint()}
				autocomplete="new-password"
				minlength={10}
				required
				error={e.password}
			/>
			<Field name="phone" type="tel" label={m.field_phone()} hint={m.field_phone_hint()} autocomplete="tel" required value={v.phone ?? ''} error={e.phone} />
			{#if inv.isUnder18}
				<label class="check"
					><input type="checkbox" name="guardian" checked={v.guardian === 'on'} />
					<span>{m.v3_code_guardian({ name: inv.firstName })}<br /><span class="note"
							>{m.v3_code_guardian_hint({ name: inv.firstName })}</span
						></span></label
				>
			{/if}
			<label class="check">
				<input type="checkbox" name="consent" required checked={v.consent === 'on'} aria-invalid={e.consent ? 'true' : undefined} />
				<span>{m.field_consent()} <a href="/terms">{m.footer_terms()}</a> · <a href="/privacy">{m.footer_privacy()}</a></span>
			</label>
			{#if e.consent}<span class="error">{t(e.consent)}</span>{/if}
			<button class="btn btn-block" type="submit">{m.v3_parent_signup_submit()}</button>
		</form>
	{:else}
		<div class="actions">
			<button class="btn btn-block" type="button" onclick={() => (clicked = true)}>{m.v3_code_create()}</button>
			<a class="btn-link center" href="/login?next=/code/connect">{m.v3_code_have_account()}</a>
		</div>
		<noscript><a class="btn btn-block" href="?create=1">{m.v3_code_create()}</a></noscript>
	{/if}
</section>

<style>
	.actions {
		margin-top: 12px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.center {
		text-align: center;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		text-decoration: none;
	}
</style>
