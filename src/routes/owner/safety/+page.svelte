<script lang="ts">
	import Head from '#lib/components/owner/Head.svelte';
	import Empty from '#lib/components/owner/Empty.svelte';
	import Pill from '#lib/components/owner/Pill.svelte';
	import LineIcon from '#lib/components/LineIcon.svelte';
	import { m } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	let { data } = $props();
	const c = $derived(data.counts);
	const roleLabel = (r: string | null) =>
		({
			tutor: m.ow_role_tutor(),
			student: m.role_student(),
			parent: m.role_parent(),
			schoolteacher: m.ow_role_teacher()
		})[r ?? ''] ??
		r ??
		'';
	// where each kind of account is restored
	const pageFor = (r: string | null) =>
		({
			tutor: '/owner/tutors?status=suspended',
			student: '/owner/students?state=suspended',
			parent: '/owner/parents?state=suspended',
			schoolteacher: '/owner/teachers?state=suspended'
		})[r ?? ''] ?? '/owner';
</script>

<svelte:head><title>{m.ow_safety()} · {m.ow_label()} · Tutora</title></svelte:head>

<div class="oa">
	<Head title={m.ow_nav_safety()} lead={m.ow_safety_lead()} icon="eye" tone="amber" />

	<div class="oa-hub">
		<a href="/owner/reports"
			><span class="ui-ico blue" aria-hidden="true"><LineIcon name="chat" size={20} /></span><span
				class="grow">{m.ow_reports()}<span class="sub">{m.ow_safety_reports_sub()}</span></span
			>{#if c.reviewsReported + c.supportOpen}<span class="badge"
					>{c.reviewsReported + c.supportOpen}</span
				>{/if}</a
		>
		<a href="/owner/moderation"
			><span class="ui-ico navy" aria-hidden="true"><LineIcon name="eye" size={20} /></span><span
				class="grow">{m.ow_checks()}<span class="sub">{m.ow_safety_checks_sub()}</span></span
			>{#if c.checksWaiting}<span class="badge">{c.checksWaiting}</span>{/if}</a
		>
		<a href="/owner/moderation#buddy-reports"
			><span class="ui-ico amber" aria-hidden="true"><LineIcon name="flame" size={20} /></span><span
				class="grow">{m.om_reports()}<span class="sub">{m.ow_safety_buddy_sub()}</span></span
			>{#if c.buddyReports}<span class="badge">{c.buddyReports}</span>{/if}</a
		>
		<a href="#blocked"
			><span class="ui-ico green" aria-hidden="true"><LineIcon name="user" size={20} /></span><span
				class="grow"
				>{m.ow_blocked_h()}<span class="sub"
					>{m.ow_n_suspended({ n: c.suspended })} · {m.ow_n_blocks({
						n: c.blocks
					})}</span
				></span
			></a
		>
	</div>

	<section id="blocked" class="oa-sec" aria-labelledby="susp-h">
		<div class="oa-sec-h"><h2 id="susp-h">{m.ow_suspended_h()}</h2></div>
		<p class="small muted">{m.ow_suspended_lead()}</p>
		{#if data.suspended.length}
			<table class="oa-table">
				<thead>
					<tr>
						<th>{m.ow_col_name()}</th>
						<th>{m.ow_col_role()}</th>
						<th>{m.ow_col_since()}</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each data.suspended as s (s.id)}
						<tr>
							<td class="lead"
								><span class="strong">{s.name}</span><span class="small muted block">{s.email}</span
								></td
							>
							<td data-l={m.ow_col_role()}><Pill tone="no" text={roleLabel(s.role)} /></td>
							<td data-l={m.ow_col_since()}>{s.at ? fmtDay(s.at) : '—'}</td>
							<td><a href={pageFor(s.role)}>{m.ow_restore_there()} ›</a></td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<Empty text={m.ow_suspended_none()} />
		{/if}
	</section>

	<section class="oa-sec" aria-labelledby="blk-h">
		<div class="oa-sec-h"><h2 id="blk-h">{m.ow_blocks_h()}</h2></div>
		<p class="small muted">{m.ow_blocks_lead()}</p>
		{#if data.blocks.length}
			<table class="oa-table">
				<thead>
					<tr>
						<th>{m.ow_col_blocker()}</th>
						<th>{m.ow_col_blocked()}</th>
						<th>{m.ow_col_date()}</th>
					</tr>
				</thead>
				<tbody>
					{#each data.blocks as b (b.blockerId + b.blockedId)}
						<tr>
							<td class="lead strong">{b.blocker}</td>
							<td data-l={m.ow_col_blocked()}>{b.blocked}</td>
							<td data-l={m.ow_col_date()}>{fmtDay(b.createdAt)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<Empty text={m.ow_blocks_none()} />
		{/if}
	</section>
</div>
