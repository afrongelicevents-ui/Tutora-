<script lang="ts">
	import SourceTag from '#lib/components/tools/SourceTag.svelte';
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay, fmtWeekday, localDate } from '#lib/tz.ts';
	import { shrink } from '#lib/shrink.ts';
	import DrivePickButton from '#lib/components/tools/DrivePickButton.svelte';
	let { data, form } = $props();
	const dueDate = (iso: string) => new Date(iso + 'T12:00:00Z');
	// Harare's date, not UTC (a due date is a Zimbabwe calendar day)
	const today = localDate(new Date());
	const dueLabel = (iso: string) =>
		iso < today ? m.hw3_overdue() : m.hw3_due({ day: fmtWeekday(dueDate(iso)) });
	const source = (k: string) =>
		k === 'drive'
			? 'Drive'
			: k === 'kahoot'
				? 'Kahoot!'
				: k === 'file'
					? m.ld3_file()
					: m.ld3_link();
	const subjects = $derived([...new Set(data.resources.map((r) => r.subject))]);
</script>

<svelte:head><title>{m.hw3_title()} · Tutora</title></svelte:head>

<div class="screen wide-2">
	<div class="full">
		<a class="back" href="/student" aria-label={m.v3_back()}>←</a>
		<h1>{m.hw3_title()}</h1>
	</div>
	{#if form?.done}<p class="notice full" role="status">{m.handed_in()}</p>{/if}

	<div class="stack-l">
		{#each data.items as h (h.id)}
			{@const marked = h.answers.find((a) => a.checkedAt)}
			{@const sent = h.answers.length > 0}
			<div class="card hw">
				<div class="top">
					<strong>{h.title}</strong>
					{#if marked}<span class="pill p-ok">{m.hw3_marked()}</span>{:else if sent}<span
							class="pill p-info">{m.handed_in_pill()}</span
						>{:else if h.dueOn}<span class="pill p-wait">{dueLabel(h.dueOn)}</span>{/if}
				</div>
				<span class="small muted"
					>{[h.tutorName, h.subject, h.topic]
						.filter(Boolean)
						.join(' · ')}{#if h.links.some((l) => l.kind === 'drive')}
						· {m.hw3_from_drive()}{/if}</span
				>
				{#if h.note}<p class="small prewrap">{h.note}</p>{/if}
				{#if h.fileUrl || h.links.length}
					<div class="rows">
						{#if h.fileUrl}<a href={h.fileUrl} target="_blank" rel="noopener"
								><span>{h.fileName ?? m.ld3_file()}</span><span class="muted small"
									>{m.ld3_file()}</span
								></a
							>{/if}
						{#each h.links as l (l.id)}
							<a href={l.url} target="_blank" rel="noopener noreferrer"
								><span>{l.title}</span><span class="muted small"
									><SourceTag kind={l.kind} label={source(l.kind)} /></span
								></a
							>
						{/each}
					</div>
				{/if}
				{#each h.answers as a (a.id)}
					<div class="answer small">
						{#if a.checkedAt}
							<strong class="ok-t"
								>{a.score !== null && a.maxScore
									? m.hw3_marked_score({ score: a.score, max: a.maxScore })
									: m.hw3_marked()}</strong
							>
						{:else}
							<span class="ok-t">{m.hw3_waiting()}</span>
						{/if}
						<span class="muted">{m.your_answer({ date: fmtDay(a.createdAt) })}</span>
						{#if a.note}<p class="prewrap">{a.note}</p>{/if}
						{#if a.fileUrl}<a href={a.fileUrl} target="_blank" rel="noopener">{a.fileName}</a>{/if}
						{#if a.feedback}<p class="feedback">
								<strong>{m.tutor_feedback()}:</strong>
								{a.feedback}
							</p>{/if}
					</div>
				{/each}
				<details open={!!form?.error && String((form as { id?: string }).id) === String(h.id)}>
					<summary class="btn {sent ? 'btn-ghost' : ''} btn-block"
						>{sent ? m.hand_in_again() : m.hw3_upload()}</summary
					>
					<form
						method="POST"
						action="?/handIn"
						enctype="multipart/form-data"
						class="stack inner"
						novalidate
					>
						{#if form?.error && String((form as { id?: string }).id) === String(h.id)}<p
								class="alert"
							>
								{t(form.error, { minutes: (form as { minutes?: number }).minutes ?? 60 })}
							</p>{/if}
						<input type="hidden" name="id" value={h.id} />
						<div class="field">
							<label for="hf-{h.id}">{m.upload_answer()}</label><span class="hint"
								>{m.file_hint_5mb()}</span
							>
							<input
								id="hf-{h.id}"
								name="file"
								type="file"
								accept="image/jpeg,image/png,image/webp,application/pdf"
								capture="environment"
								use:shrink
							/>
						</div>
						<div class="field">
							<label for="hn-{h.id}">{m.answer_note()}</label>
							<textarea id="hn-{h.id}" name="note" rows="2" maxlength="2000"></textarea>
						</div>
						<button class="btn btn-block" type="submit">{m.hand_in()}</button>
					</form>
					<DrivePickButton
						config={data.picker}
						action="?/attachDrive"
						fields={{ id: String(h.id) }}
					/>
				</details>
			</div>
		{:else}
			<p class="lead">{m.no_homework()}</p>
		{/each}
		<a class="softcard quizlink" href="/student/study#quizzes"
			><strong>{m.hw3_quizzes()}</strong><span class="small">{m.hw3_quizzes_sub()}</span></a
		>
	</div>

	<section class="side" id="resources">
		<div class="section-h"><h2>{m.hw3_revision()}</h2></div>
		{#each subjects as s (s)}
			<p class="small muted subj">{s}</p>
			<div class="rows">
				{#each data.resources.filter((r) => r.subject === s) as r (r.id)}
					{#if r.url}<a href={r.url} target="_blank" rel="noopener noreferrer"
							><span>{r.title}</span><span class="muted small"
								><SourceTag kind={r.kind} label={source(r.kind)} /></span
							></a
						>{:else}<div>
							<span>{r.title}</span><span class="muted small"
								><SourceTag kind={r.kind} label={source(r.kind)} /></span
							>
						</div>{/if}
				{/each}
			</div>
		{:else}
			<p class="note">{m.hw3_no_revision()}</p>
		{/each}
	</section>
</div>

<style>
	h1 {
		margin: 0;
		font-size: 1.875rem;
	}
	.stack-l {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.hw {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.top {
		display: flex;
		justify-content: space-between;
		gap: 10px;
	}
	.answer {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px 0;
		border-top: 1px solid var(--border);
	}
	.answer p {
		margin: 4px 0 0;
	}
	details summary {
		list-style: none;
		margin-top: 6px;
	}
	details summary::-webkit-details-marker {
		display: none;
	}
	.inner {
		margin-top: 10px;
	}
	.rows a {
		text-decoration: none;
	}
	.subj {
		margin: 10px 0 0;
		font-weight: 600;
	}
	.quizlink {
		text-decoration: none;
		color: var(--text);
	}
</style>
