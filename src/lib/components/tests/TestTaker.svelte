<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { m, t } from '#lib/i18n.ts';
	import { fmtDate, fmtDayTime, fromLocal } from '#lib/tz.ts';

	/**
	 * A test built from the question bank, as this student got it. With a time limit the clock
	 * counts down and the test is handed in by itself at 0 (the server checks the time too).
	 * Answers are kept on the phone while typing, so a reload doesn't lose them.
	 */
	interface Item {
		qid: number;
		type: string;
		prompt: string;
		choices: string[];
		marks: number;
		chapter: string;
		numeric: boolean;
		given?: string | null;
		awarded?: number | null;
		right?: string | null;
		chosen?: string | null;
		explanation?: string | null;
	}
	let {
		test,
		error = null
	}: {
		test: {
			id: number;
			title: string;
			subject: string;
			topic: string;
			tutorName: string;
			dueOn: string | null;
			timerMinutes: number | null;
			deadlineAt: Date | string | null;
			submittedAt: Date | string | null;
			late: boolean;
			autoClosed: boolean;
			score: number | null;
			maxScore: number;
			toMark: number;
			items: Item[];
		};
		error?: string | null;
	} = $props();

	const done = $derived(!!test.submittedAt);
	const storeKey = $derived(`tutora-test-${test.id}`);
	let left = $state<number | null>(null);
	let formEl = $state<HTMLFormElement | null>(null);
	let sending = $state(false);

	const mmss = (s: number) =>
		`${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, '0')}`;

	onMount(() => {
		if (done) {
			localStorage.removeItem(storeKey);
			return;
		}
		// put back answers typed before a reload
		try {
			const saved = JSON.parse(localStorage.getItem(storeKey) ?? '{}') as Record<string, string>;
			for (const [name, value] of Object.entries(saved)) {
				const els = formEl?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
					`[name="${CSS.escape(name)}"]`
				);
				els?.forEach((el) => {
					if (el instanceof HTMLInputElement && el.type === 'radio')
						el.checked = el.value === value;
					else el.value = value;
				});
			}
		} catch {
			/* nothing saved */
		}
		if (!test.deadlineAt) return;
		const end = new Date(test.deadlineAt).getTime();
		const tick = () => {
			left = Math.max(0, Math.round((end - Date.now()) / 1000));
			if (left === 0 && !sending) {
				sending = true;
				formEl?.requestSubmit();
			}
		};
		tick();
		const h = setInterval(tick, 1000);
		return () => clearInterval(h);
	});

	function remember() {
		if (!formEl) return;
		const out: Record<string, string> = {};
		for (const [k, v] of new FormData(formEl).entries()) if (typeof v === 'string') out[k] = v;
		localStorage.setItem(storeKey, JSON.stringify(out));
	}
</script>

<div class="screen">
	<a class="back" href="/student/study" aria-label={m.st5_back_study()}>‹</a>
	<span class="eyebrow">{m.st5_kind_test()} · {test.subject}</span>
	<h1>{test.title}</h1>
	<p class="note">
		{test.topic} · {m.st5_from_tutor({ name: test.tutorName })}{test.dueOn
			? ` · ${m.st5_due({ date: fmtDate(fromLocal(test.dueOn)) })}`
			: ''}
	</p>
	{#if error}<p class="alert" role="alert">{t(error)}</p>{/if}

	{#if done}
		<div class="ui-card sky score" role="status">
			<span class="bignum">{test.score}/{test.maxScore}</span>
			{#if test.toMark}
				<span class="lead">{m.qb_waiting_tutor({ n: test.toMark })}</span>
			{:else}
				<span class="lead">{m.st5_quiz_saved()}</span>
			{/if}
			<span class="small muted"
				>{m.qb_handed_in({ when: fmtDayTime(new Date(test.submittedAt!)) })}{test.late
					? ` · ${test.autoClosed ? m.qb_time_ran_out() : m.qb_late()}`
					: ''}</span
			>
		</div>
		<ol class="rows review">
			{#each test.items as it, i (it.qid)}
				<li>
					<div class="grow">
						<p class="prompt"><span class="n">{i + 1}.</span> {it.prompt}</p>
						<span class="small"
							>{m.qb_your_answer()}:
							<strong>{it.chosen ?? it.given ?? m.qb_no_answer()}</strong></span
						>
						{#if it.right && it.awarded !== it.marks}
							<span class="small">{m.st5_right_answer()}: {it.right}</span>
						{/if}
						{#if it.explanation && it.type !== 'written'}<span class="small muted"
								>{it.explanation}</span
							>{/if}
					</div>
					<span class="mark" class:ok={it.awarded === it.marks}
						>{it.awarded === null || it.awarded === undefined
							? m.qb_to_be_marked()
							: `${it.awarded}/${it.marks}`}</span
					>
				</li>
			{/each}
		</ol>
		<a class="btn btn-secondary" href="/student/study">{m.st5_back_study()}</a>
	{:else}
		{#if left !== null}
			<div class="clock" class:low={left < 60} role="timer" aria-live="off">
				{m.qb_time_left()} <strong>{mmss(left)}</strong>
			</div>
		{:else if test.timerMinutes}
			<p class="note">{m.qb_timer_n({ n: test.timerMinutes })}</p>
		{/if}
		<p class="lead">
			{test.items.length === 1 ? m.st5_quiz_lead_one() : m.st5_quiz_lead({ n: test.items.length })}
		</p>
		<form
			method="POST"
			action="?/test"
			class="stack"
			bind:this={formEl}
			oninput={remember}
			use:enhance={() => {
				sending = true;
				return async ({ update }) => {
					localStorage.removeItem(storeKey);
					await update();
					sending = false;
				};
			}}
		>
			<ol class="rows qs">
				{#each test.items as it, i (it.qid)}
					<li>
						<fieldset>
							<legend class="prompt"
								><span class="n">{i + 1}.</span>
								{it.prompt}{#if it.marks > 1}
									<span class="small muted">({m.qb_n_marks({ n: it.marks })})</span>{/if}</legend
							>
							{#if it.type === 'mcq'}
								{#each it.choices as c, j (j)}
									<label class="opt"
										><input type="radio" name="a{it.qid}" value={j} /> <span>{c}</span></label
									>
								{/each}
							{:else if it.type === 'short'}
								<input
									name="a{it.qid}"
									maxlength="200"
									autocomplete="off"
									inputmode={it.numeric ? 'decimal' : 'text'}
									aria-label={m.qb_your_answer()}
								/>
							{:else}
								<textarea name="a{it.qid}" rows="4" maxlength="4000" aria-label={m.qb_your_answer()}
								></textarea>
							{/if}
						</fieldset>
					</li>
				{/each}
			</ol>
			<button class="btn btn-block" type="submit" disabled={sending}>{m.st5_quiz_submit()}</button>
		</form>
	{/if}
</div>

<style>
	.score {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.clock {
		position: sticky;
		top: 8px;
		z-index: 2;
		align-self: flex-start;
		padding: 8px 14px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.85);
		backdrop-filter: blur(8px);
		border: 1px solid rgba(11, 37, 69, 0.12);
		font-variant-numeric: tabular-nums;
	}
	.clock.low {
		color: #9b2c2c;
		border-color: #e3a3a3;
	}
	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 100%;
	}
	.prompt {
		margin: 0;
		font-weight: 600;
		white-space: pre-line;
		padding: 0;
	}
	.n {
		color: var(--ocean);
	}
	.opt {
		display: flex;
		gap: 10px;
		align-items: center;
		min-height: 44px;
	}
	.opt input {
		width: 22px;
		height: 22px;
		accent-color: var(--navy);
		flex-shrink: 0;
	}
	.qs > li,
	.review > li {
		align-items: flex-start;
	}
	.grow {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.mark {
		font-weight: 700;
		white-space: nowrap;
	}
	.mark.ok {
		color: var(--green, #1f7a4d);
	}
</style>
