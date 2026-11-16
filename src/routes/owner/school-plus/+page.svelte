<script lang="ts">
	import Head from '#lib/components/owner/Head.svelte';
	import Filters from '#lib/components/owner/Filters.svelte';
	import Pager from '#lib/components/owner/Pager.svelte';
	import Empty from '#lib/components/owner/Empty.svelte';
	import Pill from '#lib/components/owner/Pill.svelte';
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	let { data } = $props();
	const STATUSES = [
		'requested',
		'tutor_accepted',
		'teacher_invited',
		'teacher_accepted',
		'active',
		'declined',
		'withdrawn',
		'ended'
	];
	const short = (s: string) =>
		({
			requested: m.ow_sp_requested(),
			tutor_accepted: m.ow_sp_tutor_accepted(),
			teacher_invited: m.ow_sp_teacher_invited(),
			teacher_accepted: m.ow_sp_teacher_accepted(),
			active: m.sp3_status_active(),
			declined: m.sp3_status_declined(),
			withdrawn: m.sp3_status_withdrawn(),
			ended: m.sp3_status_ended()
		})[s] ?? s;
	const tone = (s: string) =>
		s === 'active' ? 'ok' : ['declined', 'withdrawn', 'ended'].includes(s) ? 'no' : 'wait';
	const chips = $derived([
		{ value: '', label: m.ow_all(), count: data.counts[''] ?? 0 },
		{ value: 'waiting', label: m.ow_sp_waiting(), count: data.counts.waiting ?? 0 },
		...STATUSES.map((s) => ({ value: s, label: short(s), count: data.counts[s] ?? 0 }))
	]);
</script>

<svelte:head><title>{m.ow_partnerships()} · {m.ow_label()} · Tutora</title></svelte:head>

<div class="oa">
	<Head title={m.ow_partnerships()} lead={m.ow_sp_lead()} icon="school" tone="green" />
	<Filters {chips} label={m.ow_partnerships()} />

	{#if data.rows.length}
		<table class="oa-table">
			<thead>
				<tr>
					<th>{m.ow_col_student()}</th>
					<th>{m.ow_col_subject()}</th>
					<th>{m.ow_col_tutor()}</th>
					<th>{m.ow_col_teacher()}</th>
					<th>{m.ow_col_parent()}</th>
					<th>{m.ow_col_status()}</th>
					<th>{m.ow_col_started()}</th>
				</tr>
			</thead>
			<tbody>
				{#each data.rows as p (p.id)}
					<tr>
						<td class="lead strong">{p.studentName}</td>
						<td data-l={m.ow_col_subject()}>{p.subject}</td>
						<td data-l={m.ow_col_tutor()}>{p.tutorName ?? '—'}</td>
						<td data-l={m.ow_col_teacher()}
							><span>{p.teacherName}<span class="small muted block">{p.schoolName}</span></span></td
						>
						<td data-l={m.ow_col_parent()}>{p.parentName}</td>
						<td data-l={m.ow_col_status()}
							><span title={t(`sp3_status_${p.status}`)}
								><Pill tone={tone(p.status)} text={short(p.status)} />{#if p.consentAt}<span
										class="small muted block">{m.ow_sp_consent({ date: fmtDay(p.consentAt) })}</span
									>{/if}</span
							></td
						>
						<td data-l={m.ow_col_started()}>{fmtDay(p.createdAt)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<Pager page={data.page} total={data.total} />
	{:else}
		<Empty icon="school" text={m.ow_sp_none()} />
	{/if}
</div>
