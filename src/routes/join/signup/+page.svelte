<script lang="ts">
	import Field from '#lib/components/Field.svelte';
	import BotTrap from '#lib/components/BotTrap.svelte';
	import { m, t } from '#lib/i18n.ts';
	let { form } = $props();
	const e = $derived((form && 'errors' in form ? form.errors : {}) as Record<string, string>);
	const v = $derived((form && 'values' in form ? form.values : {}) as Record<string, string>);
</script>

<svelte:head><title>{m.join_create()} · Tutora</title></svelte:head>

<section class="wrap narrow stack">
	<h1>{m.join_create()}</h1>
	<p class="muted">{m.join_form_lead()}</p>
	{#if e.form}<p class="alert" role="alert">
			{t(e.form, { minutes: (form as { retryMinutes?: number })?.retryMinutes ?? 60 })}
		</p>{/if}
	<form method="POST" class="stack" novalidate>
		<BotTrap />
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
			name="phone"
			type="tel"
			label={m.field_phone()}
			hint={m.field_phone_hint()}
			autocomplete="tel"
			value={v.phone ?? ''}
			error={e.phone}
			required
		/>
		<Field
			name="town"
			label={m.join_town()}
			hint={m.join_town_hint()}
			autocomplete="address-level2"
			value={v.town ?? ''}
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
		<label class="check"
			><input type="checkbox" name="terms" />
			<span
				>{m.join_terms_a()} <a href="/terms" target="_blank">{m.footer_terms()}</a>
				{m.join_terms_b()} <a href="/privacy" target="_blank">{m.footer_privacy()}</a></span
			></label
		>
		{#if e.terms}<p class="error" role="alert">{t(e.terms)}</p>{/if}
		<button class="btn btn-block" type="submit">{m.join_create()}</button>
	</form>
</section>
