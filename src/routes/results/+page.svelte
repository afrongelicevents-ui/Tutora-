<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import Results from '#lib/components/Results.svelte';
	let { data } = $props();
</script>

<svelte:head><title>{m.results_h()} · Tutora</title></svelte:head>
<section class="wrap narrow">
	<h1>{m.results_h()}</h1>
	<Results results={data.site.results} />
	<p class="small muted">{m.results_privacy()}</p>
</section>
