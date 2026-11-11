<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay, localDate } from '#lib/tz.ts';
	let { data, form } = $props();
</script>

<svelte:head><title>{m.homework_h()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<h1>{m.homework_h()}</h1>
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if form && 'sent' in form}<p class="notice" role="status">
			{m.hw_sent({ n: Number(form.sent) })}
		</p>{/if}
	{#if form && 'checked' in form}<p class="notice" role="status">{m.saved()}</p>{/if}

	<h2>{m.hw_to_check({ n: data.answers.length })}</h2>
	{#each data.answers as a (a.id)}
		<div class="card stack">
			<b>{a.title}</b>
			<p class="small muted">{a.studentName} · {fmtDay(a.createdAt)}</p>
			{#if a.note}<p class="small">{a.note}</p>{/if}
			{#if a.fileUrl}<a
					class="btn btn-secondary btn-sm"
					href={a.fileUrl}
					target="_blank"
					rel="noopener">{m.open_file({ name: a.fileName ?? '' })}</a
				>{/if}
			<form method="POST" action="?/check" class="stack">
				<input type="hidden" name="id" value={a.id} />
				<label class="small" for="c-{a.id}">{m.hw_comment()}</label>
				<textarea id="c-{a.id}" name="comment" rows="2" maxlength="1000"></textarea>
				<button class="btn btn-sm" type="submit">{m.hw_mark_checked()}</button>
			</form>
		</div>
	{:else}
		<p class="empty">{m.hw_none_to_check()}</p>
	{/each}

	<h2>{m.hw_send_h()}</h2>
	{#if data.students.length}
		<form method="POST" action="?/send" enctype="multipart/form-data" class="card stack" novalidate>
			<fieldset>
				<legend>{m.hw_to_who()}</legend>
				{#each data.students as s (s.id)}
					<label class="check"
						><input type="checkbox" name="to" value={s.id} />
						<span>{s.name}{s.childName ? ` (${s.childName})` : ''}</span></label
					>
				{/each}
			</fieldset>
			<label for="hw-title">{m.hw_title()}</label>
			<input id="hw-title" name="title" required maxlength="120" />
			<label for="hw-note">{m.hw_note()}</label>
			<textarea id="hw-note" name="note" rows="3" maxlength="2000"></textarea>
			<label for="hw-due">{m.hw_due()}</label>
			<input id="hw-due" name="dueOn" type="date" min={localDate(new Date())} />
			<label for="hw-file">{m.file_optional()}</label>
			<input
				id="hw-file"
				name="file"
				type="file"
				accept="image/jpeg,image/png,image/webp,application/pdf"
			/>
			<button class="btn btn-block" type="submit">{m.hw_send()}</button>
		</form>
	{:else}
		<p class="empty">{m.hw_no_students()}</p>
	{/if}
</section>
