<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	let { data } = $props();
</script>

<svelte:head><title>{m.reviews_title()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<h1>{m.reviews_title()}</h1>
	<p class="small muted">{m.reviews_tutor_lead()}</p>
	{#each data.reviews as r (r.id)}
		<div class="card">
			<div class="row">
				<span class="stars grow" aria-label={m.stars_label({ n: r.rating })}
					>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span
				>
				<span class="pill {r.hidden ? 'p-no' : 'p-ok'}">{r.hidden ? m.hidden() : m.shown()}</span>
			</div>
			<p>“{r.text}”</p>
			<div class="row">
				<span class="small muted grow">{r.displayName} · {fmtDay(r.createdAt)}</span>
				<form method="POST" action="?/toggle">
					<input type="hidden" name="id" value={r.id} />
					<input type="hidden" name="hidden" value={r.hidden ? 'false' : 'true'} />
					<button class="btn btn-secondary btn-sm" type="submit"
						>{r.hidden ? m.show() : m.hide()}</button
					>
				</form>
			</div>
		</div>
	{:else}
		<p class="empty">{m.reviews_none()}</p>
	{/each}
</section>
