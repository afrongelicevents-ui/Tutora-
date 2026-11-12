<script lang="ts">
	import SettingsForm from '#lib/components/SettingsForm.svelte';
	import { m } from '#lib/i18n.ts';
	import type { Section } from '#lib/server/sections.ts';
	let { data, form } = $props();
	const titles: Record<Section, () => string> = {
		profile: m.sec_profile,
		subjects: m.sec_subjects,
		teaching: m.sec_teaching,
		prices: m.sec_prices,
		times: m.sec_times,
		contact: m.sec_contact,
		payments: m.sec_payments,
		results: m.sec_results,
		account: m.sec_account
	};
</script>

<svelte:head><title>{titles[data.section as Section]()} · Tutora</title></svelte:head>

<section class="screen">
	<a class="btn btn-secondary btn-sm" href="/tutor/settings">← {m.settings_title()}</a>
	<h1 style="margin-top:12px">{titles[data.section as Section]()}</h1>
	{#if data.changed}<p class="notice" role="status">{m.set_email_changed()}</p>{/if}
	<SettingsForm
		section={data.section as Section}
		data={data as never}
		form={form as never}
		submitLabel={m.save()}
	/>
</section>
