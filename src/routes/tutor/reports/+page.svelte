<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDate, fromLocal } from '#lib/tz.ts';
	import ReportFigures from '#lib/components/ReportFigures.svelte';
	let { data, form } = $props();
	const day = (iso: string) => fmtDate(fromLocal(iso, 720));
</script>

<svelte:head><title>{m.rp_nav()} · Tutora</title></svelte:head>

<section class="screen">
	<a class="back" href="/tutor/more" aria-label={m.v3_nav_more()}>‹</a>
	<h1>{m.rp_nav()}</h1>
	<p class="lead">{m.rp_lead_tutor()}</p>
	{#if form && 'error' in form && form.error}<p class="alert" role="alert">
			{t(form.error as string)}
		</p>{/if}
	{#if form && 'created' in form}<p class="notice" role="status">{m.rp_created()}</p>{/if}
	{#if form && 'saved' in form}<p class="notice" role="status">{m.saved()}</p>{/if}
	{#if form && 'sent' in form}<p class="notice" role="status">{m.rp_sent_ok()}</p>{/if}
	{#if form && 'removed' in form}<p class="notice" role="status">{m.rp_removed()}</p>{/if}

	<section class="softcard new">
		<h2>{m.rp_new()}</h2>
		{#if data.students.length}
			<form method="POST" action="?/create" class="stack">
				<label class="field"
					><span class="label">{m.rp_student()}</span>
					<select name="studentId" required value={data.student}>
						<option value="" disabled>{m.rp_pick_student()}</option>
						{#each data.students as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
					</select></label
				>
				<div class="row">
					<label class="field grow"
						><span class="label">{m.rp_from()}</span><input
							type="date"
							name="from"
							value={data.period.from}
							required
						/></label
					>
					<label class="field grow"
						><span class="label">{m.rp_to()}</span><input
							type="date"
							name="to"
							value={data.period.to}
							required
						/></label
					>
				</div>
				<label class="field"
					><span class="label">{m.rp_note()}</span><span class="hint">{m.rp_note_hint()}</span
					><textarea name="note" rows="3" maxlength="1500"></textarea></label
				>
				<fieldset class="vis">
					<legend class="label">{m.rp_vis_h()}</legend>
					<label class="radio"
						><input type="radio" name="noteVisible" value="parent" checked />
						{m.rp_vis_parent()}</label
					>
					<label class="radio"
						><input type="radio" name="noteVisible" value="student" />
						{m.rp_vis_student()}</label
					>
				</fieldset>
				<button class="btn btn-block" type="submit">{m.rp_make()}</button>
			</form>
		{:else}
			<p class="note">{m.hw_no_students()}</p>
		{/if}
	</section>

	<div class="section-h"><h2>{m.rp_list_h({ n: data.reports.length })}</h2></div>
	{#each data.reports as r (r.id)}
		<article class="card rep" id="r{r.id}">
			<div class="line">
				<strong>{r.studentName}</strong>
				<span class="pill {r.status === 'sent' ? 'p-ok' : 'p-info'}"
					>{r.status === 'sent' ? m.rp_status_sent() : m.rp_status_draft()}</span
				>
			</div>
			<span class="small muted">{day(r.periodStart)} – {day(r.periodEnd)}</span>
			<ReportFigures figures={r.figures} />
			<form method="POST" class="stack">
				<input type="hidden" name="id" value={r.id} />
				<label class="field"
					><span class="label">{m.rp_note()}</span><textarea
						name="note"
						rows="3"
						maxlength="1500"
						value={r.note ?? ''}></textarea></label
				>
				<fieldset class="vis">
					<legend class="label">{m.rp_vis_h()}</legend>
					<label class="radio"
						><input type="radio" name="noteVisible" value="parent" checked={!r.noteVisible} />
						{m.rp_vis_parent()}</label
					>
					<label class="radio"
						><input type="radio" name="noteVisible" value="student" checked={r.noteVisible} />
						{m.rp_vis_student()}</label
					>
				</fieldset>
				<div class="btn-row">
					<button class="btn btn-ghost btn-sm" formaction="?/save" type="submit"
						>{m.rp_save()}</button
					>
					{#if r.status === 'draft'}
						<button class="btn btn-sm" formaction="?/send" type="submit">{m.rp_send()}</button>
					{:else}
						<button class="btn btn-ghost btn-sm" formaction="?/send" type="submit"
							>{m.rp_send_again()}</button
						>
					{/if}
					<a class="btn btn-ghost btn-sm" href="/tutor/reports/{r.id}/pdf">{m.rp_pdf()}</a>
				</div>
			</form>
			{#if r.status === 'draft'}
				<form method="POST" action="?/remove">
					<input type="hidden" name="id" value={r.id} />
					<button class="linkbtn danger" type="submit">{m.rp_delete()}</button>
				</form>
			{/if}
		</article>
	{:else}
		<p class="note">{m.rp_none_tutor()}</p>
	{/each}
</section>

<style>
	.vis {
		border: 0;
		padding: 0;
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1rem;
	}
	.vis legend {
		width: 100%;
		margin-bottom: 0.25rem;
	}
	.radio {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}
	.back {
		align-self: flex-start;
	}
	.new h2 {
		margin: 0 0 8px;
		font-size: 1.125rem;
	}
	.rep {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.line {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}
	.linkbtn {
		background: none;
		border: none;
		padding: 8px 0;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		min-height: 44px;
	}
	.danger {
		color: var(--danger-700);
	}
</style>
