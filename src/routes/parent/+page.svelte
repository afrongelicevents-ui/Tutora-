<script lang="ts">
	import { photoSrc } from '#lib/photo-slots.ts';
	import { page } from '$app/state';
	import { m } from '#lib/i18n.ts';
	import { fmtDay, fmtTime, localDate } from '#lib/tz.ts';
	import LineIcon from '#lib/components/LineIcon.svelte';
	import Hero from '#lib/components/ui/Hero.svelte';
	import FamilyState from '#lib/components/family/FamilyState.svelte';
	import IconTile from '#lib/components/ui/IconTile.svelte';
	import StatTile from '#lib/components/ui/StatTile.svelte';
	import Avatar from '#lib/components/ui/Avatar.svelte';
	import ProgressRing from '#lib/components/ui/ProgressRing.svelte';
	let { data } = $props();
	const hello = $derived(
		data.greeting === 'morning'
			? m.pf_morning({ name: data.name })
			: data.greeting === 'afternoon'
				? m.pf_afternoon({ name: data.name })
				: m.pf_evening({ name: data.name })
	);
	const when = (d: Date) => {
		const day = localDate(d);
		const today = localDate(new Date());
		const tomorrow = localDate(new Date(Date.now() + 86_400_000));
		const label = day === today ? m.sh_today() : day === tomorrow ? m.pf_tomorrow() : fmtDay(d);
		return `${label} · ${fmtTime(d)}`;
	};
	const first = $derived(data.cards[0]);
	const one = $derived(data.cards.length === 1);
	import InstallCard from '#lib/components/pwa/InstallCard.svelte';
</script>

<svelte:head><title>{m.v3_nav_home()} · Tutora</title></svelte:head>

<div class="screen ui-page">
	<InstallCard />
	<Hero
		title={hello}
		lead={m.pf_lead()}
		photo={photoSrc(page.data.photos, 'parent_home')}
		photoAlt={m.pf_photo_alt()}
		photoWidth={612}
		photoHeight={408}
	>
		<span class="motto"
			><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"
				><path
					d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				/></svg
			>{m.pf_motto()}</span
		>
		<!-- Tutora Family: the plan's state, and Pay now / Upgrade when needed -->
		<span class="fam-strip">
			<FamilyState reason={data.family.reason} until={data.family.until} />
			{#if data.family.payInvoiceId}
				<a class="ui-btn" href="/parent/checkout?invoice={data.family.payInvoiceId}"
					>{m.fb_pay_now()}</a
				>
			{:else if !data.family.active || data.family.reason === 'grace'}
				<a class="ui-btn" href="/parent/plans">{m.fb_upgrade()}</a>
			{:else}
				<a class="fam-link" href="/parent/plans">{m.fb_plans_title()} ›</a>
			{/if}
		</span>
		{#if data.family.overdueSince}
			<span class="ui-pill warn"
				>{m.fb_overdue_since({ date: fmtDay(new Date(data.family.overdueSince)) })}</span
			>
		{/if}
	</Hero>

	{#if data.connected}<p class="notice" role="status">
			{m.par_connected({ name: data.connected })}
		</p>{/if}
	{#if data.pending}<p class="notice" role="status">{m.par_pending({ name: data.pending })}</p>{/if}
	{#if data.waitingCode}
		<div class="ui-card cream row-card">
			<span>{m.par_code_waiting({ name: data.waitingCode.firstName })}</span>
			<a class="ui-btn" href="/code/connect">{m.par_code_finish()}</a>
		</div>
	{/if}

	<section class="kids" aria-labelledby="kids-h">
		<div class="ui-sec-h">
			<h2 id="kids-h">{one ? m.pf_your_child() : m.pf_your_children()}</h2>
			{#if data.cards.length}<a href="/parent/settings#children"
					>{m.pf_manage()} <LineIcon name="chevron" size={16} /></a
				>{/if}
		</div>

		{#each data.cards as c (c.id)}
			<article class="ui-card kid" data-testid="child-card">
				<div class="kid-top">
					<Avatar name={c.name} photo={c.photo} size={72} />
					<div class="kid-id">
						<h3 class="ui-serif">{c.name}</h3>
						{#if c.level}<span class="level"><LineIcon name="school" size={16} /> {c.level}</span
							>{/if}
					</div>
					{#if c.attention.total}
						<a class="attn" href="/parent/child/{c.id}#attention"
							>{m.pf_attention({ n: c.attention.total })} ›</a
						>
					{/if}
				</div>
				<div class="kid-body">
					<div class="kid-prog">
						{#if c.overall}
							<ProgressRing pct={c.overall.pct} label={m.pf_overall_aria({ pct: c.overall.pct })} />
							<div>
								<span class="small">{m.par3_overall()}</span>
								{#if c.overall.change !== null && c.overall.change !== 0}
									<strong class="chg" class:down={c.overall.change < 0}
										>{c.overall.change > 0 ? '↑ +' : '↓ '}{c.overall.change}%</strong
									>
								{/if}
							</div>
						{:else}
							<span class="small muted"
								>{c.access.progress ? m.par3_no_scores() : m.pf_progress_private()}</span
							>
						{/if}
					</div>
					<ul class="kid-facts">
						<li>
							<span class="ui-ico blue"><LineIcon name="calendar" size={20} /></span>
							<span
								><span class="small muted">{m.pf_next_lesson()}</span><br />{#if c.next}{when(
										c.next.startsAt
									)}{:else}{c.access.lessons ? m.pf_none_booked() : m.par3_not_shared()}{/if}</span
							>
						</li>
						<li>
							<span class="ui-ico green"><LineIcon name="tutors" size={20} /></span>
							<span>{c.tutors ? m.pf_tutors({ n: c.tutors }) : m.pf_no_tutor()}</span>
						</li>
					</ul>
				</div>
				{#if !data.family.all && !data.family.covered.includes(c.id)}
					<p class="fam-kid">
						<span class="ui-pill">{m.fb_child_free()}</span>
						<a href="/parent/checkout?child={encodeURIComponent(c.id)}">{m.fb_child_add()} ›</a>
					</p>
				{/if}
				<a class="ui-btn block" href="/parent/child/{c.id}"
					>{m.pf_view_child({ name: c.firstName })} →</a
				>
			</article>
		{:else}
			<div class="ui-card empty">
				<span class="ui-ico navy"><LineIcon name="family" size={22} /></span>
				<h3 class="ui-serif">{m.par_no_children()}</h3>
				<p class="muted">{m.par_no_children_lead()}</p>
				<a class="ui-btn" href="/parent/settings#add">{m.par_add_child_code_h()}</a>
			</div>
		{/each}
		{#each data.waiting as w (w)}
			<p class="small muted">{m.pf_waiting({ name: w })}</p>
		{/each}
	</section>

	{#if data.cards.length}
		<nav class="ui-grid4" aria-label={m.pf_quick()}>
			<IconTile href="/parent/tutors#find" icon="search" tone="navy" label={m.pf_find_tutor()} />
			<IconTile
				href={one ? `/parent/child/${first.id}#lessons` : '/parent/tutors#lessons'}
				icon="lessons"
				tone="blue"
				label={m.pf_lessons()}
			/>
			<IconTile href="/parent/progress" icon="progress" tone="green" label={m.pf_progress()} />
			<IconTile href="/parent/tutors#messages" icon="chat" tone="amber" label={m.pf_messages()} />
		</nav>

		{#if data.month.hours !== null || data.month.growth !== null || data.month.goals !== null}
			<section class="ui-card cream overview" aria-labelledby="ov-h">
				<div class="ui-sec-h">
					<h2 id="ov-h" class="h-ov">
						<LineIcon name="trophy" size={22} />
						{m.pf_overview()}
					</h2>
					<span class="small muted">{m.pf_this_month()}</span>
				</div>
				<div class="ov">
					{#if data.month.hours !== null}
						<StatTile
							icon="clock"
							tone="blue"
							value={m.pf_hours({ n: data.month.hours })}
							caption={m.pf_tutoring_time()}
						/>
					{/if}
					{#if data.month.growth !== null}
						<StatTile
							icon="progress"
							tone="green"
							value="{data.month.growth > 0 ? '+' : ''}{data.month.growth}%"
							caption={m.pf_growth()}
						/>
					{/if}
					{#if data.month.goals !== null}
						<StatTile
							icon="star"
							tone="amber"
							value={String(data.month.goals)}
							caption={m.pf_goals()}
						/>
					{/if}
				</div>
			</section>
		{/if}
	{/if}

	<a class="ui-card sky help" href="/parent/settings">
		<span class="ui-ico navy"><LineIcon name="family" size={22} /></span>
		<span
			><strong class="ui-serif">{m.pf_help_h()}</strong><br /><span class="small"
				>{m.pf_help_b()}</span
			></span
		>
		<span class="ui-btn-soft">{m.pf_go_settings()} ›</span>
	</a>
</div>

<style>
	.motto {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		align-self: flex-start;
		margin-top: 6px;
		padding: 8px 14px;
		border-radius: 999px;
		background: var(--navy);
		color: #fff;
		font-size: 0.875rem;
		font-weight: 600;
	}
	.row-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	.fam-strip {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
		margin-top: 0.6rem;
	}
	.fam-link {
		font-weight: 600;
	}
	.fam-kid {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin: 0 0 0.5rem;
		font-size: 0.9rem;
	}
	.kids {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.kid {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.kid-top {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.kid-id {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1;
		min-width: 0;
	}
	.kid-id h3 {
		margin: 0;
		font-size: 1.5rem;
	}
	.level {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		align-self: flex-start;
		padding: 3px 10px;
		border-radius: 999px;
		background: var(--ice);
		color: var(--navy);
		font-size: 0.875rem;
	}
	.attn {
		align-self: flex-start;
		padding: 6px 12px;
		border-radius: 999px;
		background: var(--danger-50);
		color: var(--danger-700);
		font-size: 0.8125rem;
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
	}
	.kid-body {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
		gap: 12px;
		align-items: center;
	}
	.kid-prog {
		display: flex;
		align-items: center;
		gap: 10px;
		padding-right: 12px;
		border-right: 1px solid var(--border);
	}
	.kid-prog div {
		display: flex;
		flex-direction: column;
	}
	.chg {
		color: var(--ok);
	}
	.chg.down {
		color: var(--danger-700);
	}
	.kid-facts {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
		font-size: 0.9375rem;
	}
	.kid-facts li {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.kid-facts .ui-ico {
		width: 36px;
		height: 36px;
		border-radius: 12px;
	}
	.block {
		width: 100%;
	}
	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
	}
	.empty h3 {
		margin: 0;
	}
	.empty p {
		margin: 0;
	}
	.h-ov {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 1.3rem !important;
	}
	.ov {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
		gap: 10px;
		margin-top: 12px;
	}
	.ov > :global(div + div) {
		border-left: 1px solid #ecdcbc;
		padding-left: 10px;
	}
	.help {
		display: flex;
		align-items: center;
		gap: 12px;
		text-decoration: none;
		color: var(--navy);
	}
	.help {
		flex-wrap: wrap;
	}
	.help > span:nth-child(2) {
		flex: 1;
		min-width: 180px;
	}
	@media (max-width: 520px) {
		.help .ui-btn-soft {
			margin-left: 56px;
		}
	}
	@media (max-width: 380px) {
		.kid-body {
			grid-template-columns: 1fr;
		}
		.kid-prog {
			border-right: none;
			padding-right: 0;
		}
	}
	@media (min-width: 900px) {
		.kids {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
		}
		.kids .ui-sec-h,
		.kids > p {
			grid-column: 1 / -1;
		}
	}
</style>
