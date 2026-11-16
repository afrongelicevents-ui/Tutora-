<script lang="ts">
	import People from '#lib/components/owner/People.svelte';
	import { m } from '#lib/i18n.ts';
	let { data, form } = $props();
</script>

<svelte:head><title>{m.ow_parents()} · {m.ow_label()} · Tutora</title></svelte:head>

<People
	{data}
	{form}
	title={m.ow_parents()}
	lead={m.ow_parents_lead()}
	icon="family"
	tone="amber"
	extra={(n) => m.ow_n_children({ n })}
	reset={true}
/>
