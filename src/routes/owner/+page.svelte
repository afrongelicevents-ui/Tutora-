<script lang="ts">
	import Head from '#lib/components/owner/Head.svelte';
	import Flash from '#lib/components/owner/Flash.svelte';
	import StatTile from '#lib/components/ui/StatTile.svelte';
	import OwnerFamilyStats from '#lib/components/family/OwnerFamilyStats.svelte';
	import LineIcon, { type IconName } from '#lib/components/LineIcon.svelte';
	import { m, t } from '#lib/i18n.ts';
	import { fmtDayTime } from '#lib/tz.ts';
	let { data } = $props();
	const c = $derived(data.counts);
	type Tone = 'navy' | 'blue' | 'green' | 'amber';
	// everything that waits for the owner, in the order it matters
	const attention = $derived(
		(
			[
				{
					n: c.tutorsPending,
					icon: 'tutors',
					tone: 'amber',
					what: c.tutorsPending === 1 ? m.ow_attn_tutors1() : m.ow_attn_tutors(),
					href: '/owner/tutors?status=pending',
					btn: m.ow_attn_tutors_btn()
				},
				{
					n: c.reviewsReported + c.supportOpen,
					icon: 'chat',
					tone: 'blue',
					what: m.ow_attn_reports(),
					href: '/owner/reports',
					btn: m.ow_attn_open()
				},
				{
					n: c.checksWaiting,
					icon: 'eye',
					tone: 'navy',
					what: c.checksWaiting === 1 ? m.ow_attn_checks1() : m.ow_attn_checks(),
					href: '/owner/moderation',
					btn: m.ow_attn_check_btn()
				},
				{
					n: c.buddyReports,
					icon: 'flame',
					tone: 'amber',
					what: m.ow_attn_buddy(),
					href: '/owner/moderation#buddy-reports',
					btn: m.ow_attn_open()
				},
				{
					n: data.family.proofsWaiting,
					icon: 'wallet',
					tone: 'green',
					what: data.family.proofsWaiting === 1 ? m.ow_attn_proofs1() : m.ow_attn_proofs(),
					href: '/owner/payments?view=family&fstatus=proof_sent',
					btn: m.ow_attn_check_btn()
				},
				{
					n: data.pro.proofsWaiting,
					icon: 'wallet',
					tone: 'green',
					what: data.pro.proofsWaiting === 1 ? m.pro_attn_proofs1() : m.pro_attn_proofs(),
					href: '/owner/payments?view=pro&pstatus=proof_sent',
					btn: m.ow_attn_check_btn()
				},
				{
					n: data.family.manyChildren.length,
					icon: 'family',
					tone: 'amber',
					what: data.family.manyChildren.length === 1 ? m.ow_attn_many1() : m.ow_attn_many(),
					href: '/owner#family-stats',
					btn: m.ow_attn_look()
				},
				{
					n: c.paymentsStale,
					icon: 'wallet',
					tone: 'amber',
					what: c.paymentsStale === 1 ? m.ow_attn_payments1() : m.ow_attn_payments(),
					href: '/owner/payments?status=stale',
					btn: m.ow_attn_look()
				},
				{
					n: c.schoolPlusWaiting,
					icon: 'school',
					tone: 'green',
					what: m.ow_attn_sp(),
					href: '/owner/school-plus?status=waiting',
					btn: m.ow_attn_look()
				}
			] as { n: number; icon: IconName; tone: Tone; what: string; href: string; btn: string }[]
		).filter((x) => x.n > 0)
	);
	const worst = $derived(
		data.usage
			? [...data.usage.meters]
					.sort((a, b) => b.share - a.share)
					.filter((x) => x.key !== 'limitErrors')
			: []
	);
	const errors = $derived(data.usage?.meters.find((x) => x.key === 'limitErrors'));
	const pct = (s: number) => `${Math.round(s * 100)}%`;
	import InstallCard from '#lib/components/pwa/InstallCard.svelte';
</script>

<svelte:head><title>{m.ow_nav_overview()} · {m.ow_label()} · Tutora</title></svelte:head>

<div class="oa">
	<InstallCard />
	<Head title={m.ow_nav_overview()} lead={m.ow_overview_lead()} icon="home" tone="navy" />
	<Flash done={data.done} />

	<section class="oa-sec" aria-labelledby="attn-h">
		<div class="oa-sec-h"><h2 id="attn-h">{m.ow_attn_h()}</h2></div>
		{#if attention.length}
			<div class="oa-attn">
				{#each attention as a (a.href)}
					<div class="ui-card">
						<span class="ui-ico {a.tone}" aria-hidden="true"
							><LineIcon name={a.icon} size={20} /></span
						>
						<span class="body"
							><span class="num">{a.n}</span><span class="what">{a.what}</span></span
						>
						<a class="ui-btn" href={a.href}>{a.btn}</a>
					</div>
				{/each}
			</div>
		{:else}
			<div class="oa-empty">
				<span class="ui-ico green" aria-hidden="true"><LineIcon name="check" size={20} /></span>
				<p>{m.ow_attn_none()}</p>
			</div>
		{/if}
	</section>

	<section class="oa-sec" aria-labelledby="num-h">
		<div class="oa-sec-h"><h2 id="num-h">{m.ow_numbers_h()}</h2></div>
		<div class="ui-card cream oa-stats">
			<StatTile
				icon="tutors"
				tone="blue"
				value={String(c.tutorsActive)}
				caption={m.ow_n_tutors()}
			/>
			<StatTile icon="user" tone="green" value={String(c.students)} caption={m.ow_n_students()} />
			<StatTile icon="family" tone="amber" value={String(c.parents)} caption={m.ow_n_parents()} />
			<StatTile icon="school" tone="navy" value={String(c.teachers)} caption={m.ow_n_teachers()} />
			<StatTile
				icon="calendar"
				tone="blue"
				value={String(c.lessonsWeek)}
				caption={m.ow_n_lessons_week()}
			/>
			<StatTile
				icon="wallet"
				tone="green"
				value={String(c.paymentsMonth)}
				caption={m.ow_n_payments_month()}
			/>
		</div>
	</section>

	<div id="family-stats">
		<OwnerFamilyStats stats={data.family} pro={data.pro} />
		<p class="fam-links">
			<a href="/owner/payments?view=family">{m.fb_o_invoices()} ›</a>
			<a href="/owner/settings#family-pay">{m.fb_o_settings()} ›</a>
		</p>
	</div>

	<div class="ui-cols">
		<div>
			<section class="ui-card oa-sec" aria-labelledby="fl-h">
				<div class="oa-sec-h">
					<h2 id="fl-h">{m.fl_title()}</h2>
					<a href="/owner/limits">{m.ow_details()} ›</a>
				</div>
				{#if !data.usage}
					<p class="muted">{m.fl_none_yet()}</p>
				{:else}
					<p class="small muted">
						{data.testSite ? m.fl_site_test() : m.fl_site_live()} · {m.fl_checked({
							when: fmtDayTime(new Date(data.usage.at))
						})}
					</p>
					{#each worst.slice(0, 3) as mt (mt.key)}
						<div class="oa-meter {mt.level}">
							<span>{t(`fl_name_${mt.key}`)}</span>
							<span class="val">{pct(mt.share)}</span>
							<span class="bar" aria-hidden="true"
								><span style="width: {Math.min(100, mt.share * 100)}%"></span></span
							>
						</div>
					{/each}
					{#if errors}
						<p class="small {errors.used ? 'warn-t' : 'muted'}">
							{m.fl_name_limitErrors()}: {errors.used === 0
								? m.fl_no_errors()
								: m.fl_errors({ n: errors.used })}
						</p>
					{/if}
				{/if}
			</section>
		</div>
		<div>
			<section class="ui-card oa-sec" aria-labelledby="sp-h">
				<div class="oa-sec-h">
					<h2 id="sp-h">{m.ow_more_h()}</h2>
				</div>
				<div class="oa-hub one">
					<a href="/owner/bookings?status=requested"
						><span class="ui-ico blue" aria-hidden="true"
							><LineIcon name="calendar" size={18} /></span
						><span class="grow"
							>{m.ow_bookings()}<span class="sub">{m.ow_n_waiting({ n: c.bookingsWaiting })}</span
							></span
						></a
					>
					<a href="/owner/school-plus"
						><span class="ui-ico green" aria-hidden="true"
							><LineIcon name="school" size={18} /></span
						><span class="grow"
							>{m.ow_partnerships()}<span class="sub"
								>{m.ow_n_active({ n: c.schoolPlusActive })}</span
							></span
						></a
					>
					<a href="/owner/safety"
						><span class="ui-ico amber" aria-hidden="true"><LineIcon name="eye" size={18} /></span
						><span class="grow"
							>{m.ow_safety()}<span class="sub"
								>{m.ow_n_suspended({ n: c.suspended })} · {m.ow_n_blocks({ n: c.blocks })}</span
							></span
						></a
					>
				</div>
			</section>
		</div>
	</div>
</div>

<style>
	.fam-links {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 18px;
		margin: 10px 4px 0;
	}
	.fam-links a {
		font-weight: 600;
		color: var(--ocean);
		text-decoration: none;
	}
	.oa-hub.one {
		grid-template-columns: 1fr;
	}
	.oa-hub.one a {
		box-shadow: none;
	}
</style>
