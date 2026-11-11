<script lang="ts">
	import Field from '#lib/components/Field.svelte';
	import BotTrap from '#lib/components/BotTrap.svelte';
	import { m, t } from '#lib/i18n.ts';
	let { data, form } = $props();
	const e = $derived(
		((form && 'errors' in form ? form.errors : {}) ?? {}) as Record<string, string>
	);
	const v = $derived(
		((form && 'values' in form ? form.values : {}) ?? {}) as Record<string, string>
	);
</script>

<svelte:head><title>{m.footer_contact()} · Tutora</title></svelte:head>

<section class="wrap narrow stack">
	<h1>{m.contact_title()}</h1>
	{#if form && 'sent' in form}
		<p class="notice" role="status">{m.contact_sent()}</p>
	{:else}
		<p class="muted">{m.contact_lead()}</p>
		{#if e.form}<p class="alert" role="alert">{t(e.form, { minutes: 60 })}</p>{/if}
		<form method="POST" class="stack" novalidate>
			<BotTrap />
			<Field name="name" label={m.set_name()} value={v.name ?? data.name} error={e.name} required />
			<Field
				name="email"
				type="email"
				label={m.field_email()}
				value={v.email ?? data.email}
				error={e.email}
				required
			/>
			<label for="topic">{m.contact_topic()}</label>
			<select id="topic" name="topic">
				<option value="help">{m.contact_t_help()}</option>
				<option value="report">{m.contact_t_report()}</option>
				<option value="tutor">{m.contact_t_tutor()}</option>
				<option value="other">{m.contact_t_other()}</option>
			</select>
			<label for="message">{m.contact_message()}</label>
			<textarea id="message" name="message" rows="5" maxlength="2000" required
				>{v.message ?? ''}</textarea
			>
			{#if e.message}<p class="error">{t(e.message)}</p>{/if}
			<button class="btn btn-block" type="submit">{m.contact_send()}</button>
		</form>
	{/if}
</section>
