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
	const last = $derived(data.total + 1);
</script>

<svelte:head><title>{m.setup_wizard_title()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<div class="steps" aria-label={m.step_of({ n: data.step + 1, total: last + 1 })}>
		{#each Array.from({ length: last + 1 }, (_x, k) => k) as i (i)}<i class:on={i <= data.step}
			></i>{/each}
	</div>
	<p class="small muted">{m.step_of({ n: data.step + 1, total: last + 1 })}</p>

	{#if data.step === 0}
		<h1>{m.wiz_welcome_title()}</h1>
		<p>{m.wiz_welcome_lead()}</p>
		<p class="small muted">{m.wiz_welcome_hidden()}</p>
		<a class="btn btn-block" href="/tutor/setup/1">{m.wiz_start()}</a>
	{:else if data.section}
		<h1>{titles[data.section as Section]()}</h1>
		<SettingsForm
			section={data.section as Section}
			data={data as never}
			form={form as never}
			submitLabel={m.wiz_save_next()}
		/>
		<div class="row" style="margin-top:16px">
			{#if data.step > 1}<a class="btn btn-secondary" href="/tutor/setup/{data.step - 1}"
					>{m.back()}</a
				>{/if}
			<span class="grow"></span>
			<a class="btn btn-secondary" href="/tutor/setup/{data.step + 1}">{m.wiz_skip()}</a>
		</div>
	{:else}
		<h1>{m.wiz_done_title()}</h1>
		<p class="panel">{m.wiz_done_lead()}</p>
		<form method="POST" action="?/finish">
			<button class="btn btn-block" type="submit">{m.wiz_go_today()}</button>
		</form>
		<a class="btn btn-secondary btn-block" style="margin-top:8px" href="/">{m.wiz_see_site()}</a>
	{/if}

	{#if data.step <= data.total}
		<form method="POST" action="?/later" style="margin-top:16px">
			<button class="btn-link" type="submit">{m.wiz_later()}</button>
		</form>
	{/if}
</section>
