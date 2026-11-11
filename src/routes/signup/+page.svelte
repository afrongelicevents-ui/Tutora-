<script lang="ts">
	import Field from '#lib/components/Field.svelte';
	import { m, t } from '#lib/i18n.ts';

	let { form } = $props();
	const v = $derived((form?.values ?? {}) as Record<string, string>);
	const e = $derived((form?.errors ?? {}) as Record<string, string>);

	const accountType = $derived(v.accountType ?? 'student');
</script>

<svelte:head><title>{m.signup_title()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<h1>{m.signup_title()}</h1>
	<p class="muted">{m.signup_lead()}</p>

	{#if e.form}
		<p class="alert" role="alert">{t(e.form, { minutes: form?.retryMinutes ?? 60 })}</p>
	{/if}

	<form method="POST" class="stack" novalidate>
		<fieldset>
			<legend>{m.signup_i_am()}</legend>
			<div class="choice">
				<label
					><input
						type="radio"
						name="accountType"
						value="student"
						checked={accountType === 'student'}
					/>
					{m.signup_student()}</label
				>
				<label
					><input
						type="radio"
						name="accountType"
						value="parent"
						checked={accountType === 'parent'}
					/>
					{m.signup_parent()}</label
				>
			</div>
			{#if e.accountType}<span class="error">{t(e.accountType)}</span>{/if}
		</fieldset>

		<Field
			name="name"
			label={m.field_name()}
			autocomplete="name"
			required
			value={v.name ?? ''}
			error={e.name}
		/>
		<Field
			name="email"
			type="email"
			label={m.field_email()}
			autocomplete="email"
			required
			value={v.email ?? ''}
			error={e.email}
		/>
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
		<Field
			name="phone"
			type="tel"
			label={m.field_phone()}
			hint={m.field_phone_hint()}
			autocomplete="tel"
			value={v.phone ?? ''}
			error={e.phone}
		/>

		<div class="child">
			<Field
				name="childName"
				label={m.field_child_name()}
				hint={m.field_child_name_hint()}
				value={v.childName ?? ''}
				error={e.childName}
			/>
		</div>

		<!-- Shown and hidden with CSS only, so it works without JavaScript. -->
		<label class="check under18">
			<input type="checkbox" name="isUnder18" checked={v.isUnder18 === 'on'} />
			<span>{m.field_under18()}</span>
		</label>

		<fieldset class="panel stack parent">
			<legend>{m.parent_section_title()}</legend>
			<p class="small muted">{m.parent_section_lead()}</p>
			<Field
				name="parentName"
				label={m.field_parent_name()}
				value={v.parentName ?? ''}
				error={e.parentName}
			/>
			<Field
				name="parentPhone"
				type="tel"
				label={m.field_parent_phone()}
				value={v.parentPhone ?? ''}
				error={e.parentPhone}
			/>
			<Field
				name="parentEmail"
				type="email"
				label={m.field_parent_email()}
				value={v.parentEmail ?? ''}
				error={e.parentEmail}
			/>
		</fieldset>

		<label class="check">
			<input
				type="checkbox"
				name="consent"
				required
				checked={v.consent === 'on'}
				aria-invalid={e.consent ? 'true' : undefined}
			/>
			<span
				>{m.field_consent()} <a href="/terms">{m.footer_terms()}</a> ·
				<a href="/privacy">{m.footer_privacy()}</a></span
			>
		</label>
		{#if e.consent}<span class="error">{t(e.consent)}</span>{/if}

		<button class="btn btn-block" type="submit">{m.signup_submit()}</button>
		<p class="small">{m.signup_have_account()} <a href="/login">{m.nav_login()}</a></p>
	</form>
</section>

<style>
	.parent {
		display: none;
	}
	form:has(input[value='student']:checked):has(input[name='isUnder18']:checked) .parent {
		display: block;
	}
	form:has(input[value='parent']:checked) .under18 {
		display: none;
	}
	.child {
		display: none;
	}
	form:has(input[value='parent']:checked) .child {
		display: block;
	}
	/* Older phones without :has() always see the parent section. */
	@supports not selector(:has(*)) {
		.parent,
		.child {
			display: block;
		}
	}
</style>
