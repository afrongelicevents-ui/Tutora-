<script lang="ts">
	import { m } from '#lib/i18n.ts';
	let {
		reviews
	}: { reviews: { displayName: string; rating: number; text: string; reply?: string | null }[] } =
		$props();
</script>

{#each reviews as r, i (i)}
	<figure class="review">
		<div class="stars" aria-label={m.stars_label({ n: r.rating })}>
			{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
		</div>
		<blockquote>“{r.text}”</blockquote>
		<figcaption class="small muted">
			— {r.displayName} · {m.verified_student()}
			{#if r.reply}<span class="reply block"><b>{m.tutor_reply()}:</b> {r.reply}</span>{/if}
		</figcaption>
	</figure>
{/each}

<style>
	.reply {
		margin: 6px 0 0;
		padding-left: 10px;
		border-left: 3px solid var(--mint-50);
	}
</style>
