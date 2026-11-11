<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import ReviewList from '#lib/components/ReviewList.svelte';
	let { data } = $props();
</script>

<svelte:head><title>{m.reviews_h()} · Tutora</title></svelte:head>
<section class="wrap narrow">
	<h1>{m.reviews_h()}</h1>
	<ReviewList reviews={data.site.reviews} />
	<p class="small muted">{m.reviews_note()}</p>
</section>
