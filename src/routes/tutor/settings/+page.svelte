<script lang="ts">
	import { m } from '#lib/i18n.ts';
	const items = [
		['profile', m.sec_profile(), m.sec_profile_hint()],
		['subjects', m.sec_subjects(), m.sec_subjects_hint()],
		['teaching', m.sec_teaching(), m.sec_teaching_hint()],
		['prices', m.sec_prices(), m.sec_prices_hint()],
		['times', m.sec_times(), m.sec_times_hint()],
		['contact', m.sec_contact(), m.sec_contact_hint()],
		['payments', m.sec_payments(), m.sec_payments_hint()],
		['results', m.sec_results(), m.sec_results_hint()],
		['account', m.sec_account(), m.sec_account_hint()]
	];
</script>

<svelte:head><title>{m.settings_title()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<h1>{m.settings_title()}</h1>
	{#each items as [key, title, hint] (key)}
		<a class="big-opt" href="/tutor/settings/{key}">{title}<small>{hint}</small></a>
	{/each}
	<a class="btn btn-secondary btn-block" href="/tutor/setup/1">{m.settings_rerun_wizard()}</a>
</section>
