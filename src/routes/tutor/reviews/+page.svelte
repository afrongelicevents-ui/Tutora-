<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	import { t } from '#lib/i18n.ts';
	let { data, form } = $props();
</script>

<svelte:head><title>{m.reviews_title()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<h1>{m.reviews_title()}</h1>
	<p class="small muted">{m.reviews_tutor_lead2()}</p>
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if form?.reported}<p class="notice" role="status">{m.review_reported()}</p>{/if}
	{#each data.reviews as r (r.id)}
		<div class="card">
			<div class="row">
				<span class="stars grow" aria-label={m.stars_label({ n: r.rating })}
					>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span
				>
				{#if r.hidden}<span class="pill p-no">{m.review_hidden_by_tutora()}</span>{/if}
			</div>
			<p>“{r.text}”</p>
			<p class="small muted">{r.displayName} · {fmtDay(r.createdAt)}</p>
			<form method="POST" action="?/reply" class="stack">
				<input type="hidden" name="id" value={r.id} />
				<label class="small" for="reply-{r.id}">{m.review_reply_label()}</label>
				<textarea
					id="reply-{r.id}"
					name="reply"
					rows="2"
					maxlength="600"
					defaultValue={r.reply ?? ''}></textarea>
				<button class="btn btn-secondary btn-sm" type="submit">{m.review_reply_save()}</button>
			</form>
			{#if r.reportedAt}<p class="small muted">{m.review_report_sent()}</p>{:else}
				<details class="small">
					<summary>{m.review_report()}</summary>
					<form method="POST" action="?/report" class="stack">
						<input type="hidden" name="id" value={r.id} />
						<label for="reason-{r.id}">{m.review_report_why()}</label>
						<input id="reason-{r.id}" name="reason" maxlength="300" required />
						<button class="btn btn-warn btn-sm" type="submit">{m.review_report_send()}</button>
					</form>
				</details>
			{/if}
		</div>
	{:else}
		<p class="empty">{m.reviews_none()}</p>
	{/each}
</section>
