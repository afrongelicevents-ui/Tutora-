<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay, localDate } from '#lib/tz.ts';
	let { data, form } = $props();
</script>

<svelte:head><title>{m.v3_nav_marking()} · Tutora</title></svelte:head>

<section class="screen">
	<a class="back" href="/tutor/more" aria-label={m.v3_nav_more()}>‹</a>
	<h1>{m.v3_nav_marking()}</h1>
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if form && 'sent' in form}<p class="notice" role="status">
			{m.hw_sent({ n: Number(form.sent) })}
		</p>{/if}
	{#if form && 'checked' in form}<p class="notice" role="status">
			{form.scored ? m.tut3_marked_scored() : m.saved()}
		</p>{/if}

	<div class="section-h"><h2>{m.hw_to_check({ n: data.answers.length })}</h2></div>
	<ul class="rows">
		{#each data.answers as a (a.id)}
			<li class="col">
				<div class="line">
					<strong>{a.title}</strong>
					<span class="note">{fmtDay(new Date(a.createdAt))}</span>
				</div>
				<span class="note"
					>{a.studentName}{a.subject || a.topic
						? ` · ${[a.subject, a.topic].filter(Boolean).join(', ')}`
						: ''}</span
				>
				{#if a.note}<p class="small prewrap">{a.note}</p>{/if}
				{#if a.fileUrl}<a class="small" href={a.fileUrl} target="_blank" rel="noopener"
						>{m.open_file({ name: a.fileName ?? '' })}</a
					>{/if}
				<form method="POST" action="?/check" class="stack">
					<input type="hidden" name="id" value={a.id} />
					<div class="field">
						<label for="c-{a.id}">{m.hw_comment()}</label>
						<textarea id="c-{a.id}" name="comment" rows="2" maxlength="1000"></textarea>
					</div>
					<div class="row score">
						<div class="field">
							<label for="s-{a.id}">{m.tut3_score_optional()}</label>
							<input id="s-{a.id}" name="score" type="number" inputmode="numeric" min="0" />
						</div>
						<div class="field">
							<label for="mx-{a.id}">{m.tut3_out_of()}</label>
							<input
								id="mx-{a.id}"
								name="maxScore"
								type="number"
								inputmode="numeric"
								min="1"
								max="1000"
							/>
						</div>
					</div>
					{#if a.subject && a.topic}<p class="note">
							{m.tut3_score_counts({ topic: a.topic })}
						</p>{:else}<p class="note">{m.tut3_score_no_topic()}</p>{/if}
					<button class="btn btn-sm" type="submit">{m.hw_mark_checked()}</button>
				</form>
			</li>
		{:else}
			<li class="note">{m.hw_none_to_check()}</li>
		{/each}
	</ul>

	<div class="section-h"><h2>{m.hw_send_h()}</h2></div>
	{#if data.students.length}
		<form method="POST" action="?/send" enctype="multipart/form-data" class="stack" novalidate>
			<fieldset class="who">
				<legend class="small">{m.hw_to_who()}</legend>
				<div class="chips">
					{#each data.students as s (s.id)}
						<label class="chip"
							><input type="checkbox" name="to" value={s.id} />
							<span>{s.name}{s.childName ? ` (${s.childName})` : ''}</span></label
						>
					{/each}
				</div>
			</fieldset>
			<div class="field">
				<label for="hw-title">{m.hw_title()}</label>
				<input id="hw-title" name="title" required maxlength="120" />
			</div>
			<div class="row">
				<div class="field grow">
					<label for="hw-subj">{m.tut3_subject_optional()}</label>
					<input id="hw-subj" name="subject" maxlength="60" />
				</div>
				<div class="field grow">
					<label for="hw-topic">{m.tut3_topic_optional()}</label>
					<input id="hw-topic" name="topic" maxlength="80" />
				</div>
			</div>
			<p class="note">{m.tut3_hw_topic_hint()}</p>
			<div class="field">
				<label for="hw-note">{m.hw_note()}</label>
				<textarea id="hw-note" name="note" rows="3" maxlength="2000"></textarea>
			</div>
			<div class="field">
				<label for="hw-due">{m.hw_due()}</label>
				<input id="hw-due" name="dueOn" type="date" min={localDate(new Date())} />
			</div>
			<div class="field">
				<label for="hw-file">{m.file_optional()}</label>
				<input
					id="hw-file"
					name="file"
					type="file"
					accept="image/jpeg,image/png,image/webp,application/pdf"
				/>
			</div>
			<button class="btn btn-block" type="submit">{m.hw_send()}</button>
		</form>
	{:else}
		<p class="note">{m.hw_no_students()}</p>
	{/if}
</section>

<style>
	.back {
		align-self: flex-start;
	}
	.rows > li.col {
		flex-direction: column;
		align-items: stretch;
		gap: 6px;
	}
	.col p {
		margin: 0;
	}
	.line {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
	}
	.score .field {
		flex: 1;
	}
	.who {
		border: none;
		padding: 0;
		margin: 0;
	}
	.who legend {
		margin-bottom: 8px;
		font-weight: 600;
	}
</style>
