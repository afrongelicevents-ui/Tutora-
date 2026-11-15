<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	let { data, form } = $props();
</script>

<svelte:head><title>{m.on_reports()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<h1>{m.on_reports()}</h1>
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if data.done}<p class="notice" role="status">{t(data.done)}</p>{/if}
	<h2>{m.or_reviews()}</h2>
	<p class="small muted">{m.or_reviews_lead()}</p>
	{#each data.reviews as r (r.id)}
		<div class="card stack">
			<div class="row">
				<p class="small muted grow">
					{r.tutorName} · {'★'.repeat(r.rating)} · {r.displayName}
				</p>
				<span class="pill {r.hidden ? 'p-no' : 'p-ok'}"
					>{r.hidden ? m.or_hidden() : m.or_visible()}</span
				>
			</div>
			<p>“{r.text}”</p>
			{#if r.reportReason}<p class="small">
					<b>{m.or_reason()}:</b>
					{r.reportReason}{#if r.reportedAt}
						· {fmtDay(r.reportedAt)}{/if}
				</p>{/if}
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
				{#if r.reportReason && !r.hidden}<form method="POST" action="?/dismiss">
						<input type="hidden" name="id" value={r.id} /><button
							class="btn btn-secondary btn-sm"
							type="submit">{m.or_keep()}</button
						>
					</form>{/if}
			</div>
		</div>
	{:else}
		<p class="empty">{m.or_reviews_none()}</p>
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
				</form>{:else}<form method="POST" action="?/reopen">
					<input type="hidden" name="id" value={s.id} /><button class="btn-link small" type="submit"
						>{m.or_reopen()}</button
					>
				</form>{/if}
		</div>
	{:else}
		<p class="empty">{m.or_support_none()}</p>
	{/each}
</section>
