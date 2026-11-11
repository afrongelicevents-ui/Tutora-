<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	let { data } = $props();
</script>

<svelte:head><title>{m.on_reports()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<h1>{m.on_reports()}</h1>
	<h2>{m.or_reviews()}</h2>
	{#each data.reviews as r (r.id)}
		<div class="card stack">
			<p class="small muted">{r.tutorName} · {'★'.repeat(r.rating)} · {r.displayName}</p>
			<p>“{r.text}”</p>
			{#if r.reportReason}<p class="small"><b>{m.or_reason()}:</b> {r.reportReason}</p>{/if}
			<div class="row">
				<form method="POST" action="?/hide">
					<input type="hidden" name="id" value={r.id} /><input
						type="hidden"
						name="hidden"
						value={r.hidden ? 'false' : 'true'}
					/><button class="btn btn-sm {r.hidden ? 'btn-secondary' : 'btn-warn'}" type="submit"
						>{r.hidden ? m.show() : m.hide()}</button
					>
				</form>
				{#if r.reportReason}<form method="POST" action="?/dismiss">
						<input type="hidden" name="id" value={r.id} /><button
							class="btn btn-secondary btn-sm"
							type="submit">{m.or_keep()}</button
						>
					</form>{/if}
			</div>
		</div>
	{:else}
		<p class="empty">{m.none_yet()}</p>
	{/each}

	<h2>{m.or_support()}</h2>
	{#each data.support as s (s.id)}
		<div class="card stack">
			<div class="row">
				<b class="grow">{s.name}</b><span class="pill {s.status === 'open' ? 'p-wait' : 'p-ok'}"
					>{s.status === 'open' ? m.or_open() : m.or_done()}</span
				>
			</div>
			<p class="small muted">
				<a href="mailto:{s.email}">{s.email}</a> · {s.topic} · {fmtDay(s.createdAt)}
			</p>
			<p class="small">{s.message}</p>
			{#if s.status === 'open'}<form method="POST" action="?/close">
					<input type="hidden" name="id" value={s.id} /><button
						class="btn btn-secondary btn-sm"
						type="submit">{m.or_mark_done()}</button
					>
				</form>{/if}
		</div>
	{:else}
		<p class="empty">{m.none_yet()}</p>
	{/each}
</section>
