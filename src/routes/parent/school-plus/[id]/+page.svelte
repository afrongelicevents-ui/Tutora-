<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay, fmtDayTime, monthWords } from '#lib/tz.ts';
	import LineIcon from '#lib/components/LineIcon.svelte';
	import Hero from '#lib/components/ui/Hero.svelte';
	import Timeline from '#lib/components/ui/Timeline.svelte';
	import PersonCard from '#lib/components/ui/PersonCard.svelte';
	import ProgressRing from '#lib/components/ui/ProgressRing.svelte';
	import IconTile from '#lib/components/ui/IconTile.svelte';
	let { data, form } = $props();
	const p = $derived(data.p);
	const live = $derived(
		['requested', 'tutor_accepted', 'teacher_invited', 'teacher_accepted', 'active'].includes(
			p.status
		)
	);
	const active = $derived(p.status === 'active');
	const f = $derived(form as { error?: string; stopped?: boolean; consented?: boolean } | null);
	const steps = $derived(
		data.steps.map((s) => ({
			label: t(`sp3_step_${s.key}`),
			when: s.at ? fmtDay(new Date(s.at)) : null,
			state: s.state
		}))
	);
	const messages = $derived(data.log.filter((l) => l.kind === 'message'));
</script>

<svelte:head><title>{m.spp_title()} · Tutora</title></svelte:head>

<div class="screen ui-page" data-testid="sp-parent" data-status={p.status}>
	<Hero
		dark
		title="School+"
		lead={m.spp_detail_lead()}
		photo="/photos/parent-computer.webp"
		photoAlt={m.spp_photo_alt()}
		photoWidth={640}
		photoHeight={640}
	>
		{#snippet badge()}<a class="backlink" href="/parent/school-plus?child={data.childId}"
				>← {m.v3_back()}</a
			>{/snippet}
		<p class="sub ui-serif">{m.sp3_title()}</p>
	</Hero>

	{#if f?.error}<p class="alert" role="alert">{t(f.error)}</p>{/if}
	{#if f?.stopped}<p class="notice" role="status">{m.sp3_stopped_done()}</p>{/if}
	{#if f?.consented}<p class="notice" role="status">{m.sp3_consent_done()}</p>{/if}

	{#if active}
		<div class="ui-card banner ok">
			<span class="ui-ico green big"><LineIcon name="check" size={26} /></span>
			<span class="grow"
				><strong class="ui-serif">{m.spp_active_h()}</strong><br /><span class="small"
					>{m.spp_active_b()}</span
				></span
			>
			{#if data.since}<span class="since small"
					><LineIcon name="calendar" size={16} />
					{m.spp_since({ date: fmtDay(new Date(data.since)) })}</span
				>{/if}
		</div>
	{:else if data.stopped}
		<div class="ui-card banner off">
			<span class="ui-ico amber big"><LineIcon name="clock" size={24} /></span>
			<span class="grow"
				><strong class="ui-serif">{t(`sp3_status_${p.status}`)}</strong><br /><span class="small"
					>{data.stopped.at ? fmtDay(new Date(data.stopped.at)) : ''}</span
				></span
			>
		</div>
	{:else}
		<section class="ui-card" aria-labelledby="st-h">
			<div class="ui-sec-h">
				<h2 id="st-h">{m.spp_status_h()}</h2>
				<span class="ui-pill warn">{t(`sp3_status_${p.status}`)}</span>
			</div>
			<Timeline {steps} />
		</section>
	{/if}

	{#if p.status === 'teacher_accepted'}
		<form method="POST" action="?/consent" class="ui-card cream stack" data-testid="sp-consent">
			<strong class="ui-serif">{m.sp3_consent_h()}</strong>
			<span class="small"
				>{m.sp3_consent_now({
					teacher: data.teacher,
					school: p.schoolName,
					tutor: data.tutor
				})}</span
			>
			<label class="check"
				><input type="checkbox" name="consent" required />
				<span>{m.sp3_consent_check()}</span></label
			>
			<label class="field"
				><span class="label">{m.sp3_sign()}</span><input
					name="consentName"
					required
					maxlength="80"
					autocomplete="name"
				/></label
			>
			<button class="ui-btn" type="submit">{m.sp3_consent_give()}</button>
		</form>
	{/if}

	<PersonCard
		name={data.child}
		photo={data.childPhoto}
		pill={data.childLevel}
		href="/parent/child/{data.childId}"
		action={m.spp_view_child()}
	/>

	<div class="team">
		<div class="ui-card who">
			<span class="ui-ico blue"><LineIcon name="user" size={22} /></span>
			<span><strong>{m.spp_tutor()}</strong><br /><span class="small">{data.tutor}</span></span>
		</div>
		<div class="link" class:on={active}>
			<span class="ui-ico {active ? 'green' : ''}"><LineIcon name="refresh" size={22} /></span>
			<span class="ui-pill {active ? 'ok' : ''}"
				>{active ? m.spp_connected() : data.stopped ? m.spp_not_connected() : m.spp_waiting()}</span
			>
		</div>
		<div class="ui-card who">
			<span class="ui-ico navy"><LineIcon name="school" size={22} /></span>
			<span
				><strong>{m.spp_teacher()}</strong><br /><span class="small">{data.teacher}</span><br
				/><span class="small muted">{p.schoolName}</span></span
			>
		</div>
	</div>

	{#if active}
		<section aria-labelledby="feat-h" class="feat-wrap">
			<div class="ui-sec-h"><h2 id="feat-h">{m.spp_features()}</h2></div>
			<nav class="ui-grid4">
				<IconTile href="#messages" icon="chat" tone="navy" label={m.spp_f_messages()} />
				<IconTile href="#plan" icon="clipboard" tone="blue" label={m.spp_f_plan()} />
				<IconTile href="#reports" icon="progress" tone="green" label={m.spp_f_reports()} />
				<IconTile href="#manage" icon="cog" tone="amber" label={m.spp_f_manage()} />
			</nav>
		</section>

		<section class="ui-card" aria-labelledby="pr-h">
			<div class="ui-sec-h">
				<h2 id="pr-h"><LineIcon name="progress" size={22} /> {m.spp_progress_h()}</h2>
				{#if data.progressShared}<a href="/parent/progress?child={data.childId}"
						>{m.pf_details()} ›</a
					>{/if}
			</div>
			{#if !data.progressShared}
				<p class="muted">{m.pf_not_shared({ name: data.child })}</p>
			{:else if data.progress}
				<div class="prog">
					<ProgressRing pct={data.progress.pct} size={92} />
					<div>
						<strong>{m.par3_overall()}</strong>
						{#if data.progress.change !== null}<span
								class="chg"
								class:down={data.progress.change < 0}
								>{data.progress.change >= 0 ? '↑ +' : '↓ '}{data.progress.change}%</span
							>{/if}
						<span class="small muted">{m.pf_last30()}</span>
					</div>
				</div>
			{:else}
				<p class="muted">{m.par3_no_scores()}</p>
			{/if}
		</section>

		{#if data.plan?.examFocus || data.plan?.topics}
			<section class="ui-card cream next" aria-labelledby="nx-h">
				<span class="ui-ico amber"><LineIcon name="sun" size={22} /></span>
				<span class="grow"
					><strong id="nx-h" class="ui-serif">{m.spp_next_h()}</strong><br /><span class="small"
						>{data.plan.examFocus || data.plan.topics}</span
					></span
				>
				<a class="ui-btn" href="#plan">{m.spp_view_plan()} →</a>
			</section>
		{/if}
	{/if}

	<section class="ui-card" id="plan" aria-labelledby="plan-h">
		<div class="ui-sec-h"><h2 id="plan-h">{m.spw_plan_h()}</h2></div>
		{#if data.plan}
			{#if data.plan.goals}<p><strong>{m.spw_goals()}:</strong> {data.plan.goals}</p>{/if}
			{#if data.plan.topics}<p><strong>{m.spw_topics()}:</strong> {data.plan.topics}</p>{/if}
			{#if data.plan.examFocus}<p><strong>{m.spw_exam()}:</strong> {data.plan.examFocus}</p>{/if}
		{:else}
			<p class="muted">{m.spp_plan_none()}</p>
		{/if}
	</section>

	<section class="ui-card" id="reports" aria-labelledby="rep-h">
		<div class="ui-sec-h"><h2 id="rep-h">{m.spp_f_reports()}</h2></div>
		{#each data.reports as r (r.id)}
			<p><strong>{monthWords(r.month)} · {r.fromName}</strong><br />{r.body}</p>
		{:else}
			<p class="muted">{m.spp_reports_none()}</p>
		{/each}
	</section>

	<section class="ui-card" id="messages" aria-labelledby="msg-h">
		<div class="ui-sec-h"><h2 id="msg-h">{m.sp3_log()}</h2></div>
		<p class="small muted">{m.spp_log_note({ n: messages.length })}</p>
		<ul class="log">
			{#each data.log as l (l.id)}
				<li>
					<span class="small muted"
						>{fmtDayTime(l.createdAt)} · {l.fromName} ({t(`sp3_role_${l.fromRole}`)})</span
					>
					<span class:event={l.kind === 'event'} class="prewrap">{l.body}</span>
				</li>
			{/each}
		</ul>
	</section>

	<section class="ui-card" id="manage" aria-labelledby="man-h">
		<div class="ui-sec-h"><h2 id="man-h">{m.spp_f_manage()}</h2></div>
		{#if p.consentText && p.consentAt}
			<details>
				<summary
					><strong
						>{m.sp3_consent_signed({
							name: p.consentName ?? '',
							when: fmtDayTime(p.consentAt)
						})}</strong
					></summary
				>
				<p class="small">{p.consentText}</p>
			</details>
		{/if}
		{#if live}
			<form method="POST" action="?/stop" data-testid="sp-stop" class="stack">
				<label class="check"
					><input type="checkbox" name="sure" /> <span>{m.spp_stop_sure()}</span></label
				>
				<button class="ui-btn-soft danger" type="submit">{m.sp3_stop()}</button>
			</form>
			<p class="note">{m.sp3_stop_note()}</p>
		{:else}
			<p class="muted small">{m.spp_finished()}</p>
		{/if}
	</section>
</div>

<style>
	.backlink {
		color: #fff;
		text-decoration: none;
		font-weight: 600;
	}
	.sub {
		margin: 0;
		font-style: italic;
		font-size: 1.4rem;
		color: #fff !important;
	}
	.ui-card {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.ui-card.banner,
	.ui-card.who,
	.ui-card.next {
		flex-direction: row;
		align-items: center;
	}
	.banner {
		flex-wrap: wrap;
		gap: 12px;
	}
	.banner.ok {
		background: var(--ok-bg);
		border-color: #b9e0c9;
	}
	.banner.off {
		background: var(--warn-bg);
		border-color: #ecd9b4;
	}
	.big {
		width: 52px !important;
		height: 52px !important;
		border-radius: 50% !important;
	}
	.grow {
		flex: 1 1 180px;
		min-width: 0;
	}
	.banner.ok .ui-ico {
		background: var(--ok);
		color: #fff;
	}
	.since {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border-radius: 12px;
		background: rgb(255 255 255 / 0.6);
	}
	.team {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		gap: 8px;
		align-items: center;
	}
	.who {
		gap: 10px;
		padding: 12px;
	}
	.link {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}
	.feat-wrap {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.ui-sec-h h2 {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 1.3rem !important;
	}
	.prog {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.prog div {
		display: flex;
		flex-direction: column;
	}
	.chg {
		color: var(--ok);
		font-weight: 600;
	}
	.chg.down {
		color: var(--danger-700);
	}
	.next {
		flex-wrap: wrap;
		gap: 12px;
	}
	p {
		margin: 0;
	}
	.log {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.log li {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px 0;
		border-bottom: 1px solid var(--border);
	}
	.event {
		color: var(--muted);
		font-style: italic;
	}
	.danger {
		color: var(--danger-700);
		border-color: #e9b8b8;
	}
	summary {
		cursor: pointer;
	}
	.ui-btn {
		align-self: flex-start;
	}
	@media (max-width: 480px) {
		.team {
			grid-template-columns: 1fr;
		}
		.link {
			flex-direction: row;
			justify-content: center;
		}
	}
</style>
