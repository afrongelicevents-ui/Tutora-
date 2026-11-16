<script lang="ts">
	import Head from '#lib/components/owner/Head.svelte';
	import Filters from '#lib/components/owner/Filters.svelte';
	import Pager from '#lib/components/owner/Pager.svelte';
	import Empty from '#lib/components/owner/Empty.svelte';
	import Pill from '#lib/components/owner/Pill.svelte';
	import { m } from '#lib/i18n.ts';
	import { fmtDayTime } from '#lib/tz.ts';
	let { data } = $props();
	const label = (s: string) =>
		({
			'': m.ow_all(),
			requested: m.status_pending(),
			proposed: m.status_proposed(),
			accepted: m.status_confirmed(),
			declined: m.status_declined(),
			cancelled: m.status_cancelled()
		})[s] ?? s;
	const tone = (s: string) =>
		s === 'accepted' ? 'ok' : s === 'requested' || s === 'proposed' ? 'wait' : 'no';
	const chips = $derived(
		['', 'requested', 'proposed', 'accepted', 'declined', 'cancelled'].map((v) => ({
			value: v,
			label: label(v),
			count: data.counts[v] ?? 0
		}))
	);
	const whenChips = [
		{ value: '', label: m.ow_any_date() },
		{ value: 'upcoming', label: m.ow_upcoming() },
		{ value: 'past', label: m.ow_past() }
	];
</script>

<svelte:head><title>{m.ow_bookings()} · {m.ow_label()} · Tutora</title></svelte:head>

<div class="oa">
	<Head title={m.ow_bookings()} lead={m.ow_bookings_lead()} icon="calendar" tone="blue" />
	<Filters {chips} search placeholder={m.ow_search_booking()} label={m.ow_bookings()} />
	<Filters chips={whenChips} name="when" label={m.ow_when()} />

	{#if data.bookings.length}
		<table class="oa-table">
			<thead>
				<tr>
					<th>{m.ow_col_student()}</th>
					<th>{m.ow_col_tutor()}</th>
					<th>{m.ow_col_kind()}</th>
					<th>{m.ow_col_when()}</th>
					<th>{m.ow_col_status()}</th>
				</tr>
			</thead>
			<tbody>
				{#each data.bookings as b (b.id)}
					<tr>
						<td class="lead strong">{b.studentName}</td>
						<td data-l={m.ow_col_tutor()}
							>{#if b.tutorSlug}<a href="/t/{b.tutorSlug}">{b.tutorName ?? '—'}</a
								>{:else}{b.tutorName ?? '—'}{/if}</td
						>
						<td data-l={m.ow_col_kind()}
							>{b.kind === 'intro' ? m.tag_intro() : m.email_lesson_word()}</td
						>
						<td data-l={m.ow_col_when()}>{fmtDayTime(b.startsAt)}</td>
						<td data-l={m.ow_col_status()}><Pill tone={tone(b.status)} text={label(b.status)} /></td
						>
					</tr>
				{/each}
			</tbody>
		</table>
		<Pager page={data.page} total={data.total} />
	{:else}
		<Empty icon="calendar" text={data.q ? m.ow_search_none({ q: data.q }) : m.ow_bookings_none()} />
	{/if}
</div>
