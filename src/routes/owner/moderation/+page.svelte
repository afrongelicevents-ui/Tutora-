<script lang="ts">
	import Head from '#lib/components/owner/Head.svelte';
	import Empty from '#lib/components/owner/Empty.svelte';
	import Sure from '#lib/components/owner/Sure.svelte';
	import Avatar from '#lib/components/ui/Avatar.svelte';
	import { m, t } from '#lib/i18n.ts';
	import { fmtDayTime } from '#lib/tz.ts';
	let { data, form } = $props();
	const whatLabel = (w: string) =>
		w === 'photo'
			? m.bv_report_photo()
			: w === 'bio'
				? m.bv_report_bio()
				: w === 'behaviour'
					? m.bv_report_behaviour()
					: m.bv_report_other();
</script>

<svelte:head><title>{m.ow_checks()} · {m.ow_label()} · Tutora</title></svelte:head>

<div class="oa">
	<Head title={m.ow_checks()} lead={m.ow_checks_lead()} icon="check" tone="navy" />
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if form?.done}<p class="notice" role="status">{m.om_done()}</p>{/if}

	<section class="oa-sec" aria-labelledby="chk-h">
		<div class="oa-sec-h"><h2 id="chk-h">{m.om_items()}</h2></div>
		{#if data.cards.length}
			<ul class="oa-cards two">
				{#each data.cards as c (c.userId)}
					<li class="ui-card oa-card">
						<div class="who">
							<Avatar name={c.name} size={44} />
							<div class="grow">
								<span class="name">{c.displayName ?? c.name}</span>
								<p class="meta">{c.name}</p>
							</div>
						</div>
						{#if c.photoStatus === 'pending'}
							<div class="item">
								<img
									src="/profile-photo/{c.userId}?v={c.photoVersion}"
									alt={m.ow_photo_of({ name: c.displayName ?? c.name })}
									width="96"
									height="96"
									class="ph"
								/>
								<div class="oa-acts">
									<form method="POST" action="?/check">
										<input type="hidden" name="student" value={c.userId} />
										<input type="hidden" name="what" value="photo" />
										<input type="hidden" name="approve" value="1" />
										<button class="ui-btn sm" type="submit"
											>{m.om_approve()} · {m.om_photo()}</button
										>
									</form>
									<Sure
										label="{m.om_reject()} · {m.om_photo()}"
										action="?/check"
										fields={{ student: c.userId, what: 'photo', approve: '0' }}
										lead={m.ow_reject_photo_lead()}
										sure={m.ow_reject_sure()}
									/>
								</div>
							</div>
						{/if}
						{#if c.bioStatus === 'pending' && c.bio}
							<div class="item">
								<blockquote>{c.bio}</blockquote>
								<div class="oa-acts">
									<form method="POST" action="?/check">
										<input type="hidden" name="student" value={c.userId} />
										<input type="hidden" name="what" value="bio" />
										<input type="hidden" name="approve" value="1" />
										<button class="ui-btn sm" type="submit">{m.om_approve()} · {m.om_bio()}</button>
									</form>
									<Sure
										label="{m.om_reject()} · {m.om_bio()}"
										action="?/check"
										fields={{ student: c.userId, what: 'bio', approve: '0' }}
										lead={m.ow_reject_bio_lead()}
										sure={m.ow_reject_sure()}
									/>
								</div>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<Empty text={m.om_none()} />
		{/if}
	</section>

	<section id="buddy-reports" class="oa-sec" aria-labelledby="br-h">
		<div class="oa-sec-h"><h2 id="br-h">{m.om_reports()}</h2></div>
		{#if data.reports.length}
			<ul class="oa-cards two">
				{#each data.reports as r (r.id)}
					<li class="ui-card oa-card">
						<span class="name ui-serif"
							>{m.om_reported({ reporter: r.reporter, reported: r.reported })}</span
						>
						<span class="meta">{whatLabel(r.what)} · {fmtDayTime(r.createdAt)}</span>
						{#if r.note}<p class="prewrap">{r.note}</p>{/if}
						<form method="POST" action="?/resolve">
							<input type="hidden" name="report" value={r.id} />
							<button class="ui-btn-soft sm" type="submit">{m.om_resolve()}</button>
						</form>
					</li>
				{/each}
			</ul>
		{:else}
			<Empty text={m.om_reports_none()} />
		{/if}
	</section>

	<section id="shared-questions" class="oa-sec" aria-labelledby="sq-h">
		<div class="oa-sec-h"><h2 id="sq-h">{m.qb_owner_shared()}</h2></div>
		<p class="small muted">{m.qb_owner_shared_lead()}</p>
		{#if data.shared.length}
			<ul class="oa-cards two">
				{#each data.shared as q (q.id)}
					<li class="ui-card oa-card">
						<span class="meta"
							>{q.by} · {q.subject} · {q.chapter}{q.hiddenAt ? ` · ${m.qb_hidden()}` : ''}</span
						>
						<p class="prewrap">{q.prompt}</p>
						<form method="POST" action="?/question">
							<input type="hidden" name="id" value={q.id} />
							<input type="hidden" name="hide" value={q.hiddenAt ? '0' : '1'} />
							<button class="ui-btn-soft sm" type="submit"
								>{q.hiddenAt ? m.qb_show_again() : m.qb_hide()}</button
							>
						</form>
					</li>
				{/each}
			</ul>
		{:else}
			<Empty text={m.qb_owner_shared_none()} />
		{/if}
	</section>
</div>

<style>
	.item {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
	}
	.ph {
		border-radius: 50%;
		object-fit: cover;
	}
	blockquote {
		margin: 0;
		padding: 10px 14px;
		border-left: 3px solid #d9a441;
		background: #fdf6e9;
		border-radius: 0 12px 12px 0;
		flex-basis: 100%;
	}
	.name {
		font-size: 1.0625rem;
		font-weight: 600;
	}
</style>
