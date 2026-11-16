<script lang="ts">
	import People from '#lib/components/owner/People.svelte';
	import { m } from '#lib/i18n.ts';
	let { data, form } = $props();
</script>

<svelte:head><title>{m.ow_students()} · {m.ow_label()} · Tutora</title></svelte:head>

<People
	{data}
	{form}
	title={m.ow_students()}
	lead={m.ow_students_lead()}
	icon="user"
	tone="green"
	extra={(n) => m.ow_n_tutors_of({ n })}
	reset={true}
/>
