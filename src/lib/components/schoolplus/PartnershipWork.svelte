<script lang="ts">
	import LineIcon from '#lib/components/LineIcon.svelte';
	// The working part of an active School+ partnership, for the tutor and the teacher:
	// the shared learning plan, this month's note for the parent, logged messages, and ending it.
	import { m } from '#lib/i18n.ts';
	import { fmtDayTime, monthWords } from '#lib/tz.ts';
	let {
		id,
		status,
		log,
		plan,
		reports,
		who
	}: {
		id: number;
		status: string;
		log: { id: number; kind: string; fromName: string; body: string; createdAt: Date | string }[];
		plan: { goals: string | null; topics: string | null; examFocus: string | null } | null;
		reports: { id: number; month: string; fromName: string; body: string }[];
		/** whose page this is: changes only the wording */
		who: 'tutor' | 'teacher';
	} = $props();
	const active = $derived(status === 'active');
</script>

{#if active}
	<details class="block pw sky">
		<summary
			><span class="ui-ico blue"><LineIcon name="check" size={20} /></span><strong class="ui-serif"
				>{m.spw_plan_h()}</strong
			></summary
		>
		<form method="POST" action="?/plan" class="stack" data-testid="sp-plan">
			<input type="hidden" name="id" value={id} />
			<label class="field"
				><span class="label">{m.spw_goals()}</span><textarea name="goals" rows="2" maxlength="1000"
					>{plan?.goals ?? ''}</textarea
				></label
			>
			<label class="field"
				><span class="label">{m.spw_topics()}</span><textarea
					name="topics"
					rows="2"
					maxlength="1000">{plan?.topics ?? ''}</textarea
				></label
			>
			<label class="field"
				><span class="label">{m.spw_exam()}</span><input
					name="examFocus"
					maxlength="500"
					value={plan?.examFocus ?? ''}
				/></label
			>
			<button class="btn btn-ghost btn-sm" type="submit">{m.save()}</button>
		</form>
	</details>
	<details class="block pw cream">
		<summary
			><span class="ui-ico amber"><LineIcon name="progress" size={20} /></span><strong
				class="ui-serif">{m.spw_report_h()}</strong
			></summary
		>
		<form method="POST" action="?/report" class="stack" data-testid="sp-report">
			<input type="hidden" name="id" value={id} />
			<label class="field"
				><span class="label">{m.spw_report_label()}</span><textarea
					name="body"
					rows="3"
					maxlength="1500"
					required></textarea></label
			>
			<button class="btn btn-ghost btn-sm" type="submit">{m.save()}</button>
			<span class="note">{m.spw_report_note()}</span>
		</form>
		{#each reports as r (r.id)}
			<p class="small"><strong>{monthWords(r.month)} · {r.fromName}:</strong> {r.body}</p>
		{/each}
	</details>
{/if}

{#if log.length}
	<div class="rows pwlog">
		{#each log as l (l.id)}<div class="logrow" class:msg={l.kind === 'message'}>
				<span class="muted tiny">{fmtDayTime(new Date(l.createdAt))} · {l.fromName}</span><span
					class="prewrap">{l.body}</span
				>
			</div>{/each}
	</div>
{/if}

{#if active}
	<form method="POST" action="?/message" class="stack" data-testid="sp-message">
		<input type="hidden" name="id" value={id} />
		<label class="field"
			><span class="label">{who === 'tutor' ? m.sp3_message_teacher() : m.spw_message_tutor()}</span
			><textarea name="body" rows="3" maxlength="2000" required></textarea></label
		>
		<button class="btn btn-ghost btn-sm" type="submit">{m.sp3_send()}</button>
		<span class="note">{m.sp3_logged_note()}</span>
	</form>
{/if}

{#if active || (who === 'tutor' && ['tutor_accepted', 'teacher_invited', 'teacher_accepted'].includes(status)) || (who === 'teacher' && status === 'teacher_accepted')}
	<details class="small">
		<summary>{m.spw_end()}</summary>
		<form method="POST" action="?/end" class="stack" data-testid="sp-end">
			<input type="hidden" name="id" value={id} />
			<p class="small">{m.spw_end_lead()}</p>
			<label class="check"
				><input type="checkbox" name="sure" /> <span>{m.spw_end_sure()}</span></label
			>
			<button class="btn btn-warn btn-sm" type="submit">{m.spw_end()}</button>
		</form>
	</details>
{/if}

<style>
	.logrow {
		flex-direction: column;
		align-items: flex-start !important;
		gap: 2px !important;
	}
	.logrow.msg .prewrap {
		font-weight: 600;
	}
	.tiny {
		font-size: 0.75rem;
	}
	.block summary {
		cursor: pointer;
		padding: 6px 0;
	}
	.pw {
		border-radius: 20px;
		padding: 12px 16px;
		margin: 4px 0;
	}
	.pw.sky {
		background: var(--ice);
		border: 1px solid #d3e3f6;
	}
	.pw.cream {
		background: #fdf6e9;
		border: 1px solid #f1e1c2;
	}
	.pw summary {
		display: flex;
		align-items: center;
		gap: 12px;
		list-style: none;
		font-size: 1.0625rem;
	}
	.pw summary::-webkit-details-marker {
		display: none;
	}
	.pw[open] summary {
		margin-bottom: 10px;
	}
	.pwlog .logrow.msg .prewrap {
		background: var(--ice);
		border-radius: 14px 14px 14px 4px;
		padding: 8px 12px;
	}
</style>
