<script lang="ts">
	import Head from '#lib/components/owner/Head.svelte';
	import Flash from '#lib/components/owner/Flash.svelte';
	import Empty from '#lib/components/owner/Empty.svelte';
	import Pill from '#lib/components/owner/Pill.svelte';
	import { m } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	let { data, form } = $props();
	const openCount = $derived(data.support.filter((s) => s.status === 'open').length);
</script>

<svelte:head><title>{m.ow_reports()} · {m.ow_label()} · Tutora</title></svelte:head>

<div class="oa">
	<Head title={m.ow_reports()} lead={m.ow_reports_lead()} icon="chat" tone="blue" />
	<Flash error={form?.error} done={data.done} />

	<section class="oa-sec" aria-labelledby="rv-h">
		<div class="oa-sec-h"><h2 id="rv-h">{m.or_reviews()}</h2></div>
		<p class="small muted">{m.or_reviews_lead()}</p>
		{#if data.reviews.length}
			<ul class="oa-cards two">
				{#each data.reviews as r (r.id)}
					<li class="ui-card oa-card">
						<div class="who">
							<div class="grow">
								<span class="name">{r.tutorName}</span>
								<p class="meta">
									<span class="stars" aria-label={m.ow_stars({ n: r.rating })}
										>{'★'.repeat(r.rating)}</span
									>
									· {r.displayName}
								</p>
							</div>
							<Pill
								tone={r.hidden ? 'no' : 'ok'}
								text={r.hidden ? m.or_hidden() : m.or_visible()}
							/>
						</div>
						<p>“{r.text}”</p>
						{#if r.reportReason}<p class="small">
								<b>{m.or_reason()}:</b>
								{r.reportReason}{#if r.reportedAt}
									· {fmtDay(r.reportedAt)}{/if}
							</p>{/if}
						<div class="oa-acts">
							<form method="POST" action="?/hide">
								<input type="hidden" name="id" value={r.id} /><input
									type="hidden"
									name="hidden"
									value={r.hidden ? 'false' : 'true'}
								/><button class="ui-btn sm" class:warn={!r.hidden} type="submit"
									>{r.hidden ? m.show() : m.hide()}</button
								>
							</form>
							{#if r.reportReason && !r.hidden}<form method="POST" action="?/dismiss">
									<input type="hidden" name="id" value={r.id} /><button
										class="ui-btn-soft sm"
										type="submit">{m.or_keep()}</button
									>
								</form>{/if}
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<Empty text={m.or_reviews_none()} />
		{/if}
	</section>

	<section class="oa-sec" aria-labelledby="sup-h">
		<div class="oa-sec-h">
			<h2 id="sup-h">{m.or_support()}</h2>
			{#if openCount}<Pill tone="wait" text={m.ow_n_open({ n: openCount })} />{/if}
		</div>
		{#if data.support.length}
			<ul class="oa-cards two">
				{#each data.support as s (s.id)}
					<li class="ui-card oa-card">
						<div class="who">
							<div class="grow">
								<span class="name">{s.name}</span>
								<p class="meta">
									<a href="mailto:{s.email}">{s.email}</a> · {s.topic} · {fmtDay(s.createdAt)}
								</p>
							</div>
							<Pill
								tone={s.status === 'open' ? 'wait' : 'ok'}
								text={s.status === 'open' ? m.or_open() : m.or_done()}
							/>
						</div>
						<p class="small prewrap">{s.message}</p>
						<div class="oa-acts">
							{#if s.status === 'open'}<form method="POST" action="?/close">
									<input type="hidden" name="id" value={s.id} /><button
										class="ui-btn sm"
										type="submit">{m.or_mark_done()}</button
									>
								</form>{:else}<form method="POST" action="?/reopen">
									<input type="hidden" name="id" value={s.id} /><button
										class="ui-btn-soft sm"
										type="submit">{m.or_reopen()}</button
									>
								</form>{/if}
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<Empty text={m.or_support_none()} />
		{/if}
	</section>
</div>

<style>
	.stars {
		color: #d9a441;
	}
</style>
