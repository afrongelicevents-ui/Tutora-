<script lang="ts">
	import AppNav from '#lib/components/AppNav.svelte';
	import { m } from '#lib/i18n.ts';
	import { t } from '#lib/i18n.ts';
	import { page } from '$app/state';
	let { children, data } = $props();
	const inWizard = $derived(page.url.pathname.startsWith('/tutor/setup'));
</script>

{#if data.status !== 'active' && !inWizard}
	<div class="wrap narrow">
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
<AppNav
	label={m.nav_tutor()}
	items={[
		{ href: '/tutor', label: m.tnav_today(), icon: 'today' },
		{ href: '/tutor/calendar', label: m.tnav_calendar(), icon: 'cal' },
		{ href: '/tutor/students', label: m.tnav_students(), icon: 'users' },
		{ href: '/tutor/payments', label: m.tnav_money(), icon: 'money' },
		{ href: '/tutor/more', label: m.tnav_more(), icon: 'gear' }
	]}
/>

<style>
	.status {
		margin-top: 12px;
		border-color: var(--rose-400);
	}
	.bar {
		height: 10px;
		border-radius: 99px;
		background: var(--blush-50);
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
