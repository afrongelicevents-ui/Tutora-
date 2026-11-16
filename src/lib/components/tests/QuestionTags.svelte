<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	/** Small pills: kind, subject · form · chapter · term, difficulty, draft / shared. */
	let {
		q
	}: {
		q: {
			type: string;
			maths?: boolean;
			marks?: number;
			subject: string | null;
			form: string | null;
			chapter: string | null;
			term: string | null;
			difficulty: string | null;
			status?: string;
			shared?: boolean;
			hidden?: boolean;
			origin?: string;
			inQuiz?: boolean;
		};
	} = $props();
</script>

<span class="tags">
	<span class="ui-pill">{t(`qb_type_${q.maths ? 'maths' : q.type}`)}</span>
	{#if q.status === 'draft'}<span class="ui-pill warn">{m.qb_draft()}</span>{/if}
	{#if q.origin === 'ai'}<span class="ui-pill gold">{m.qb_from_ai()}</span>{/if}
	{#if q.shared}<span class="ui-pill ok">{q.hidden ? m.qb_hidden() : m.qb_shared()}</span>{/if}
	{#if q.inQuiz}<span class="ui-pill">{m.qb_in_quiz()}</span>{/if}
	<span class="small muted"
		>{[q.subject, q.form, q.chapter, q.term].filter(Boolean).join(' · ')}{q.difficulty
			? ` · ${t(`qb_diff_${q.difficulty}`)}`
			: ''}{q.marks && q.marks > 1 ? ` · ${m.qb_n_marks({ n: q.marks })}` : ''}</span
	>
</span>

<style>
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
	}
</style>
