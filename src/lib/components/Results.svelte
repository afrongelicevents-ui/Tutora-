<script lang="ts">
	import { m } from '#lib/i18n.ts';
	let { results }: { results: { value: string; label: string }[] } = $props();
</script>

<div class="band">
	<div class="band-label">{m.results_h()}</div>
	<div class="stats">
		{#each results as r, i (i)}<div><b>{r.value}</b><span>{r.label}</span></div>{/each}
	</div>
</div>
