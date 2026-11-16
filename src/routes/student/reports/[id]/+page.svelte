<script lang="ts">
	// A report from my tutor (the same figures my family sees; a parent-only note is not here).
	import { m } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	import ReportFigures from '#lib/components/ReportFigures.svelte';
	let { data } = $props();
	const r = $derived(data.report);
	const day = (d: string) => fmtDay(new Date(d + 'T12:00:00Z'));
</script>

<svelte:head><title>{m.rp_student_h()} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/student/report#pr-tutor-reports">← {m.pr_title()}</a>
	<h1>{m.rp_student_one({ tutor: r.tutor })}</h1>
	<p class="lead">{day(r.periodStart)} – {day(r.periodEnd)}</p>

	<section class="softcard stack">
		<ReportFigures figures={r.figures} />
		{#if r.note}
			<div class="note-box">
				<strong>{m.rp_student_note()}</strong>
				<p data-student-note>{r.note}</p>
			</div>
		{/if}
		<a class="btn btn-secondary" href="/student/reports/{r.id}/pdf">{m.rp_pdf()}</a>
	</section>
</div>

<style>
	.back {
		align-self: flex-start;
		color: var(--ocean);
		font-weight: 600;
		text-decoration: none;
	}
	.note-box p {
		margin: 0.25rem 0 0;
		white-space: pre-line;
	}
</style>
