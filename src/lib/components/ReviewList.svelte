<script lang="ts">
	import { m } from '#lib/i18n.ts';
	let { reviews }: { reviews: { displayName: string; rating: number; text: string }[] } = $props();
</script>

{#each reviews as r, i (i)}
	<figure class="review">
		<div class="stars" aria-label={m.stars_label({ n: r.rating })}>
			{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
		</div>
		<blockquote>“{r.text}”</blockquote>
		<figcaption class="small muted">— {r.displayName} · {m.verified_student()}</figcaption>
	</figure>
{/each}
