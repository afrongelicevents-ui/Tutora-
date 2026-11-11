<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import SubjectList from '#lib/components/SubjectList.svelte';
	let { data } = $props();
</script>

<svelte:head><title>{m.subjects_h()} · Tutora</title></svelte:head>
<section class="wrap narrow">
	<h1>{m.subjects_h()}</h1>
	<SubjectList site={data.site} />
	<p class="small muted">{data.site.showPrices ? m.prices_note() : m.ask_price_note()}</p>
</section>
