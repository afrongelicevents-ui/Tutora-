<script lang="ts">
	import People from '#lib/components/owner/People.svelte';
	import { m } from '#lib/i18n.ts';
	let { data, form } = $props();
</script>

<svelte:head><title>{m.ow_teachers()} · {m.ow_label()} · Tutora</title></svelte:head>

<People
	{data}
	{form}
	title={m.ow_teachers()}
	lead={m.ow_teachers_lead()}
	icon="school"
	tone="navy"
	extra={(n) => m.ow_n_partnerships({ n })}
	reset={false}
/>
