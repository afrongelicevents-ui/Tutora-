<script lang="ts">
	import { m } from '#lib/i18n.ts';
	/** "My school work": shown to students (editable) and to parents. Never invented. */
	let {
		school,
		editable = false,
		action = ''
	}: {
		school: {
			school: string | null;
			year: string | null;
			subjects: {
				id: number;
				subject: string;
				syllabus: string | null;
				textbook: string | null;
				currentTopic: string | null;
				checkedAt: Date | null;
				checkedByName: string | null;
			}[];
		};
		editable?: boolean;
		/** form action prefix, e.g. "" (same page) or "?child=…" */
		action?: string;
	} = $props();
	const empty = $derived(!school.school && !school.year && !school.subjects.length);
</script>

<section class="softcard">
	<span class="eyebrow">{m.sw3_title()}</span>
	{#if empty}
		<span class="small">{editable ? m.sw3_empty_edit() : m.sw3_empty()}</span>
	{:else}
		{#if school.school || school.year}<span class="line"
				>{[school.year, school.school].filter(Boolean).join(' · ')}</span
			>{/if}
		{#each school.subjects as s (s.id)}
			<span class="line"
				><strong>{s.subject}</strong>{s.syllabus ? ` · ${s.syllabus}` : ''}{s.textbook
					? ` · ${m.sw3_textbook({ book: s.textbook })}`
					: ''}{#if s.currentTopic}. {m.sw3_now()} <strong>{s.currentTopic}</strong>.{/if}
				<span class="note block"
					>{s.checkedAt ? m.sw3_checked({ name: s.checkedByName ?? '' }) : m.sw3_not_checked()}</span
				></span
			>
		{/each}
	{/if}
	{#if editable}
		<details>
			<summary class="btn-link">{m.sw3_edit()}</summary>
			<form method="POST" action="{action}?/school" class="stack form">
				<label class="field"><span class="label">{m.sw3_school()}</span><input name="school" value={school.school ?? ''} maxlength="120" /></label>
				<label class="field"><span class="label">{m.sw3_year()}</span><input name="year" value={school.year ?? ''} maxlength="40" placeholder="Form 3" /></label>
				<button class="btn btn-ghost" type="submit">{m.sw3_save()}</button>
			</form>
			{#each [...school.subjects, null] as s, i (s?.id ?? `new-${i}`)}
				<form method="POST" action="{action}?/subject" class="stack form">
					{#if s}<input type="hidden" name="id" value={s.id} />{:else}<strong class="small">{m.sw3_add_subject()}</strong>{/if}
					<label class="field"><span class="label">{m.sw3_subject()}</span><input name="subject" value={s?.subject ?? ''} required maxlength="60" /></label>
					<label class="field"><span class="label">{m.sw3_syllabus()}</span><input name="syllabus" value={s?.syllabus ?? ''} maxlength="120" placeholder="ZIMSEC" /></label>
					<label class="field"><span class="label">{m.sw3_textbook_l()}</span><input name="textbook" value={s?.textbook ?? ''} maxlength="120" /></label>
					<label class="field"><span class="label">{m.sw3_topic()}</span><input name="currentTopic" value={s?.currentTopic ?? ''} maxlength="120" /></label>
					<div class="row">
						<button class="btn btn-ghost btn-sm" type="submit">{m.sw3_save()}</button>
						{#if s}<button class="btn-link small" type="submit" formaction="{action}?/removeSubject">{m.sw3_remove()}</button>{/if}
					</div>
				</form>
			{/each}
			<p class="note">{m.sw3_recheck()}</p>
		</details>
	{/if}
</section>

<style>
	.line {
		font-size: 0.9375rem;
		line-height: 1.5;
	}
	.block {
		display: block;
	}
	summary {
		cursor: pointer;
		min-height: 44px;
		display: flex;
		align-items: center;
		font-weight: 600;
	}
	.form {
		padding: 12px 0;
		border-top: 1px solid var(--border-strong);
	}
</style>
