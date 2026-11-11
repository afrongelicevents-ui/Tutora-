<script lang="ts">
	import Field from '#lib/components/Field.svelte';
	import { m, t } from '#lib/i18n.ts';
	let { data, form } = $props();
	const e = $derived((form && 'errors' in form ? form.errors : {}) as Record<string, string>);
	const v = $derived((form && 'values' in form ? form.values : {}) as Record<string, string>);
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
		<p class="muted">{data.mode === 'direct' ? m.setup_lead_direct() : m.setup_lead()}</p>
		{#if e.form}<p class="alert" role="alert">
				{t(e.form, { minutes: (form as { retryMinutes?: number })?.retryMinutes ?? 60 })}
			</p>{/if}
		<form method="POST" class="stack" novalidate>
			{#if data.mode === 'direct'}
				<Field
					name="name"
					label={m.set_name()}
					hint={m.set_name_hint()}
					autocomplete="name"
					value={v.name ?? ''}
					error={e.name}
					required
				/>
			{/if}
			<Field
				name="email"
				type="email"
				label={m.field_email()}
				autocomplete="email"
				value={v.email ?? ''}
				error={e.email}
				required
			/>
			{#if data.mode === 'direct'}
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
			{/if}
			<button class="btn btn-block" type="submit"
				>{data.mode === 'direct' ? m.setup_create() : m.setup_submit()}</button
			>
		</form>
	{/if}
</section>
