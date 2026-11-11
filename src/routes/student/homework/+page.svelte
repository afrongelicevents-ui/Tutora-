<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDate, fmtDay } from '#lib/tz.ts';
	import { shrink } from '#lib/shrink.ts';
	let { data, form } = $props();
</script>

<svelte:head><title>{m.homework_h()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<h1>{m.homework_h()}</h1>
	{#if form?.done}<p class="notice" role="status">{m.handed_in()}</p>{/if}
	{#each data.items as h (h.id)}
		<div class="card">
			<div class="row">
				<b class="grow">{h.title}</b>{#if h.answers.length}<span class="pill p-ok"
						>{m.handed_in_pill()}</span
					>{:else if h.dueOn}<span class="pill p-wait"
						>{m.due({ date: fmtDate(new Date(h.dueOn + 'T12:00:00Z')) })}</span
					>{/if}
			</div>
			{#if h.note}<p class="small">{h.note}</p>{/if}
			{#if h.fileUrl}<a
					class="btn btn-secondary btn-sm"
					href={h.fileUrl}
					target="_blank"
					rel="noopener">{m.open_file({ name: h.fileName ?? '' })}</a
				>{/if}
			{#each h.answers as a (a.id)}
				<div class="panel small" style="margin-top:8px">
					<b>{m.your_answer({ date: fmtDay(a.createdAt) })}</b>
					{#if a.note}<p>{a.note}</p>{/if}
					{#if a.fileUrl}<a href={a.fileUrl} target="_blank" rel="noopener">{a.fileName}</a>{/if}
					{#if a.feedback}<p><b>{m.tutor_feedback()}:</b> {a.feedback}</p>{/if}
				</div>
			{/each}
			<details style="margin-top:8px" open={!h.answers.length}>
				<summary>{h.answers.length ? m.hand_in_again() : m.hand_in()}</summary>
				<form
					method="POST"
					action="?/handIn"
					enctype="multipart/form-data"
					class="stack"
					style="margin-top:8px"
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
						><input
							id="hf-{h.id}"
							name="file"
							type="file"
							accept="image/jpeg,image/png,image/webp,application/pdf"
							use:shrink
						/>
					</div>
					<div class="field">
						<label for="hn-{h.id}">{m.answer_note()}</label><textarea
							id="hn-{h.id}"
							name="note"
							rows="2"
							maxlength="2000"></textarea>
					</div>
					<button class="btn btn-block btn-sm" type="submit">{m.hand_in()}</button>
				</form>
			</details>
		</div>
	{:else}
		<p class="empty">{m.no_homework()}</p>
	{/each}
</section>
