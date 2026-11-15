<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	import LineIcon from '#lib/components/LineIcon.svelte';
	import Hero from '#lib/components/ui/Hero.svelte';
	import Timeline from '#lib/components/ui/Timeline.svelte';
	import PersonCard from '#lib/components/ui/PersonCard.svelte';
	import ChildSwitcher from '#lib/components/parent/ChildSwitcher.svelte';
	let { data, form } = $props();
	const v = $derived(
		((form as { values?: Record<string, string> } | null)?.values ?? {}) as Record<string, string>
	);
	const err = $derived((form as { error?: string } | null)?.error ?? null);
	const sp = $derived(data.sp);
	const cur = $derived(sp?.current ?? null);
	const steps = $derived(
		(cur?.steps ?? []).map((s) => ({
			label: t(`sp3_step_${s.key}`),
			when: s.at ? fmtDay(new Date(s.at)) : null,
			state: s.state
		}))
	);
	const OFFERS = [
		{ icon: 'chat', h: 'spp_offer_comm_h', b: 'spp_offer_comm_b' },
		{ icon: 'clipboard', h: 'spp_offer_plan_h', b: 'spp_offer_plan_b' },
		{ icon: 'progress', h: 'spp_offer_reports_h', b: 'spp_offer_reports_b' },
		{ icon: 'check', h: 'spp_offer_control_h', b: 'spp_offer_control_b' }
	] as const;
</script>

<svelte:head><title>{m.v3_nav_schoolplus()} · Tutora</title></svelte:head>

<div class="screen ui-page">
	<Hero
		title={m.spp_title()}
		lead={m.spp_lead()}
		photo="/photos/parent-computer.webp"
		photoAlt={m.spp_photo_alt()}
		photoWidth={640}
		photoHeight={640}
	>
		{#snippet badge()}<span class="ui-pill gold">★ School+ <em>{m.sp3_premium()}</em></span
			>{/snippet}
	</Hero>

	<ChildSwitcher kids={data.kids} current={data.current} base="/parent/school-plus" />

	{#if !data.child || !sp}
		<div class="ui-card">
			<p class="muted">{m.par_no_children()}</p>
			<a class="ui-btn" href="/parent/settings#add">{m.par_add_child_code_h()}</a>
		</div>
	{:else}
		<PersonCard
			name={data.child.name}
			photo={data.child.photo}
			pill={data.child.level}
			href="/parent/child/{data.child.id}"
			action={m.spp_view_child()}
		/>

		{#if cur && cur.p.status === 'active'}
			<a class="ui-card banner ok" href="/parent/school-plus/{cur.p.id}">
				<span class="ui-ico green big"><LineIcon name="check" size={26} /></span>
				<span class="grow"
					><strong class="ui-serif">{m.spp_active_h()}</strong><br /><span class="small"
						>{m.spp_active_b()}</span
					></span
				>
				{#if cur.since}<span class="since small"
						><LineIcon name="calendar" size={16} />
						{m.spp_since({ date: fmtDay(new Date(cur.since)) })}</span
					>{/if}
			</a>
			<a class="ui-btn block" href="/parent/school-plus/{cur.p.id}">{m.spp_open()} →</a>
		{:else if cur}
			<section class="ui-card" aria-labelledby="st-h">
				<div class="ui-sec-h">
					<h2 id="st-h">{m.spp_status_h()}</h2>
					<span class="ui-pill warn">{t(`sp3_status_${cur.p.status}`)}</span>
				</div>
				<p class="small muted">
					{cur.p.subject} · {cur.p.schoolName} · {cur.teacher}{cur.tutor ? ` · ${cur.tutor}` : ''}
				</p>
				<Timeline {steps} />
				<a class="ui-btn" href="/parent/school-plus/{cur.p.id}"
					>{cur.p.status === 'teacher_accepted' ? m.spp_give_consent() : m.spp_open()} →</a
				>
			</section>
		{:else}
			<section class="ui-card cream status" aria-labelledby="ns-h">
				<div class="ui-sec-h">
					<h2 id="ns-h"><LineIcon name="family" size={24} /> {m.spp_status_h()}</h2>
				</div>
				<div class="ns">
					<span class="ui-ico navy big"><LineIcon name="tutors" size={26} /></span>
					<span class="grow"
						><strong class="ui-serif">{m.spp_not_active()}</strong><br /><span class="small"
							>{m.spp_not_active_b()}</span
						></span
					>
					{#if sp.canRequest}<a class="ui-btn" href="#request">{m.spp_request()} →</a>{/if}
				</div>
			</section>

			<section aria-labelledby="off-h" class="offers-wrap">
				<div class="ui-sec-h"><h2 id="off-h">{m.spp_offers_h()}</h2></div>
				<div class="offers">
					{#each OFFERS as o (o.h)}
						<div class="ui-card offer">
							<span class="ui-ico blue"><LineIcon name={o.icon} size={22} /></span>
							<span><strong>{t(o.h)}</strong><br /><span class="small muted">{t(o.b)}</span></span>
						</div>
					{/each}
				</div>
			</section>

			<section class="ui-card sky how" aria-labelledby="how-h">
				<span class="ui-ico navy"><LineIcon name="sun" size={22} /></span>
				<span
					><strong id="how-h" class="ui-serif">{m.spp_how_h()}</strong><br /><span class="small"
						>{m.spp_how_b()}</span
					></span
				>
			</section>

			<section class="ui-card" id="request" aria-labelledby="rq-h">
				<div class="ui-sec-h"><h2 id="rq-h">{m.sp3_request()}</h2></div>
				{#if err}<p class="alert" role="alert">{t(err)}</p>{/if}
				{#if sp.reason === 'no_tutor'}
					<p>{m.sp3_no_tutor()}</p>
					<a
						class="ui-btn"
						href="/parent/book?child={encodeURIComponent(data.child.id)}"
						data-testid="sp-find-tutor">{m.sp3_find_first()} →</a
					>
				{:else if sp.reason === 'adult'}
					<p class="muted">{m.sp3_err_adult()}</p>
				{:else if sp.reason === 'not_guardian'}
					<p class="muted">{m.sp3_err_guardian()}</p>
				{:else}
					<form method="POST" action="?/request" class="stack" data-testid="sp-request">
						<input type="hidden" name="child" value={data.child.id} />
						<label class="field"
							><span class="label">{m.sp3_tutor()}</span>
							<select name="tutor"
								>{#each sp.tutors as tu (tu.id)}<option value={tu.id} selected={v.tutor === tu.id}
										>{tu.name}</option
									>{/each}</select
							>
						</label>
						<label class="field"
							><span class="label">{m.sw3_subject()}</span><input
								name="subject"
								required
								maxlength="60"
								value={v.subject ?? ''}
							/></label
						>
						<label class="field"
							><span class="label">{m.sw3_school()}</span><input
								name="school"
								required
								maxlength="120"
								value={v.school ?? ''}
							/></label
						>
						<label class="field"
							><span class="label">{m.sp3_teacher()}</span><input
								name="teacher"
								required
								maxlength="80"
								value={v.teacher ?? ''}
							/></label
						>
						<label class="field"
							><span class="label">{m.sp3_teacher_email()}</span><input
								name="teacherEmail"
								type="email"
								maxlength="254"
								value={v.teacherEmail ?? ''}
							/></label
						>
						<p class="note">{m.sp3_consent_later()}</p>
						<button class="ui-btn" type="submit">{m.sp3_request_btn()} →</button>
					</form>
				{/if}
				<span class="small muted">{m.sp3_price()}</span>
			</section>
		{/if}

		{#if sp.past.length}
			<section class="ui-card" aria-labelledby="past-h">
				<div class="ui-sec-h"><h2 id="past-h">{m.spp_past()}</h2></div>
				<ul class="past">
					{#each sp.past as p (p.id)}
						<li>
							<a href="/parent/school-plus/{p.id}"
								><span>{p.subject} · {p.school}</span><span class="ui-pill"
									>{t(`sp3_status_${p.status}`)}</span
								></a
							>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/if}
</div>

<style>
	.block {
		width: 100%;
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
	.banner {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		text-decoration: none;
		color: var(--navy);
	}
	.banner.ok {
		background: var(--ok-bg);
		border-color: #b9e0c9;
	}
	.since {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border-radius: 12px;
		background: rgb(255 255 255 / 0.6);
	}
	.ui-card {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.ui-card.banner,
	.ui-card.how {
		flex-direction: row;
	}
	.ui-sec-h h2 {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 1.3rem !important;
	}
	.ns {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		padding: 12px;
		border-radius: 16px;
		background: rgb(255 255 255 / 0.55);
	}
	.offers-wrap {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.offers {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 12px;
	}
	.offer {
		align-items: flex-start;
		gap: 10px;
		overflow-wrap: anywhere;
	}
	@media (min-width: 700px) {
		.ui-card.offer {
			flex-direction: row;
		}
	}
	.how {
		align-items: center;
		gap: 12px;
	}
	.ui-btn {
		align-self: flex-start;
	}
	select {
		min-height: 48px;
	}
	.past {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.past a {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		padding: 10px 0;
		border-bottom: 1px solid var(--border);
		color: var(--navy);
		text-decoration: none;
	}
	em {
		font-style: normal;
		color: #f3c969;
	}
</style>
