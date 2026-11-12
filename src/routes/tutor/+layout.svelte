<script lang="ts">
	import AppShell from '#lib/components/AppShell.svelte';
	import { m } from '#lib/i18n.ts';
	import { t } from '#lib/i18n.ts';
	import { page } from '$app/state';
	let { children, data } = $props();
	const inWizard = $derived(page.url.pathname.startsWith('/tutor/setup'));
</script>

<AppShell
	tag={m.v3_tag_tutor()}
	label={m.nav_tutor()}
	unread={data.unread}
	tabs={[
		{ href: '/tutor', label: m.v3_nav_today() },
		{ href: '/tutor/calendar', label: m.v3_nav_schedule() },
		{ href: '/tutor/students', label: m.v3_nav_students() },
		{ href: '/tutor/payments', label: m.v3_nav_earnings() },
		{
			href: '/tutor/more',
			label: m.v3_nav_more(),
			also: ['/tutor/settings', '/tutor/reviews', '/tutor/photo', '/tutor/setup']
		}
	]}
	more={[
		{ href: '/tutor/messages', label: m.msg_tutor_link() },
		{ href: '/tutor/homework', label: m.v3_nav_marking() },
		{ href: '/tutor/assessments', label: m.v3_nav_assessments() },
		{ href: '/tutor/resources', label: m.res3_nav() },
		{ href: '/tutor/school-plus', label: m.sp3_title() },
		{ href: '/tutor/tools', label: m.v3_nav_tools() },
		{ href: '/tutor/settings', label: m.v3_nav_profile() }
	]}
>
	{#if data.status !== 'active' && !inWizard}
		<div class="screen">
			<div class="card stack status">
				{#if data.status === 'pending'}
					<b>{m.ts_pending_t()}</b>
					<p class="small">{m.ts_pending()}</p>
				{:else}
					<b>{data.status === 'rejected' ? m.ts_rejected_t() : m.ts_draft_t()}</b>
					{#if data.status === 'rejected' && data.rejectReason}<p class="small">
							{m.ts_rejected({ reason: data.rejectReason })}
						</p>{/if}
					<div
						class="bar"
						role="progressbar"
						aria-valuenow={data.profile.percent}
						aria-valuemin={0}
						aria-valuemax={100}
					>
						<span style="width:{data.profile.percent}%"></span>
					</div>
					<p class="small">{m.ts_percent({ n: data.profile.percent })}</p>
					<ul class="small plain">
						{#each data.profile.items.filter((i) => !i.done) as i (i.key)}
							<li>
								<a href="/tutor/settings/{i.section}">{t(i.key)}</a>{i.required
									? ` · ${m.ts_needed()}`
									: ''}
							</li>
						{/each}
					</ul>
					<form method="POST" action="/tutor?/submit">
						<button class="btn btn-block" type="submit" disabled={!data.profile.canSubmit}
							>{m.ts_submit()}</button
						>
					</form>
				{/if}
			</div>
		</div>
	{/if}
	{@render children()}
</AppShell>

<style>
	.status {
		margin-top: 12px;
		border-color: var(--ochre-400);
	}
	.bar {
		height: 10px;
		border-radius: 99px;
		background: var(--mint-50);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--brand-700);
	}
	.plain {
		margin: 0;
		padding-left: 18px;
	}
</style>
