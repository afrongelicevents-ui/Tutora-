<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDate, fromLocal } from '#lib/tz.ts';
	import SetFields from './SetFields.svelte';
	import ProPill from '#lib/components/pro/ProPill.svelte';
	let { data, form } = $props();
</script>

<svelte:head><title>{m.st5_tutor_title()} · Tutora</title></svelte:head>

<div class="screen">
	<h1>{m.st5_tutor_title()}</h1>
	<p class="lead">{m.st5_tutor_lead()}</p>
	{#if form?.error && form?.form !== 'score'}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if form?.done === 'score'}<p class="notice" role="status">{m.qb_done_score()}</p>{/if}

	<div class="hub">
		<a class="ui-card hubcard" href="/tutor/bank">
			<strong>{m.qb_title()}</strong>
			<span class="small muted">{m.qb_count({ n: data.bank })}</span>
		</a>
		<a class="ui-card hubcard" href="/tutor/tests/new">
			<strong>{m.qb_build_title()}</strong>
			<span class="small muted">{m.qb_build_short()}</span>
		</a>
		<a class="ui-card hubcard" class:attn={data.toMark > 0} href="/tutor/marking">
			<strong>{m.qb_marking_title()}</strong>
			<span class="small muted"
				>{data.toMark ? m.qb_n_to_mark({ n: data.toMark }) : m.qb_nothing_to_mark()}</span
			>
		</a>
		<a class="ui-card hubcard" href="/tutor/ai">
			<strong
				>{m.ai_title()}
				{#if !data.pro}<ProPill />{/if}</strong
			>
			<span class="small muted">{data.pro ? m.ai_short() : m.pro_upgrade()}</span>
		</a>
	</div>

	<section class="part">
		<div class="section-h"><h2>{m.st5_my_sets()}</h2></div>
		{#if data.sets.length}
			<ul class="rows">
				{#each data.sets as s (s.id)}
					<li>
						<a class="grow" href="/tutor/assessments/{s.id}"
							><strong>{s.title}</strong><span class="small muted block"
								>{s.kind === 'test' ? m.st5_kind_test() : m.st5_kind_quiz()} · {s.subject} · {s.topic}{s.level
									? ` · ${s.level}`
									: ''}</span
							></a
						>
						<span class="small muted"
							>{s.built ? `${m.qb_from_bank()} · ` : ''}{s.questions === 1
								? m.st5_n_questions_one()
								: m.st5_n_questions({ n: s.questions })}{s.timerMinutes
								? ` · ${m.qb_timer_n({ n: s.timerMinutes })}`
								: ''}{s.dailyChecks ? ` · ${m.st5_in_daily()}` : ''}</span
						>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="note">{m.st5_sets_empty()}</p>
		{/if}
	</section>

	<details class="more" open={!data.sets.length || !!form?.error}>
		<summary>{m.st5_new_set()}</summary>
		<form method="POST" action="?/create" class="stack">
			<SetFields />
			<button class="btn" type="submit">{m.st5_create_set()}</button>
		</form>
	</details>

	<details class="more" open={form?.form === 'score'}>
		<summary>{m.qb_outside_title()}</summary>
		<p class="hint">{m.qb_outside_hint()}</p>
		{#if data.students.length}
			<form method="POST" action="?/score" class="stack">
				{#if form?.error && form?.form === 'score'}<p class="error" role="alert">
						{t(form.error)}
					</p>{/if}
				<div class="row2">
					<div class="field">
						<label for="os-student">{m.st5_assign_to()}</label>
						<select id="os-student" name="studentId" required>
							{#each data.students as st (st.id)}<option value={st.id}>{st.name}</option>{/each}
						</select>
					</div>
					<div class="field">
						<label for="os-source">{m.qb_outside_from()}</label>
						<select id="os-source" name="source">
							<option value="google_forms">Google Forms</option>
							<option value="kahoot">Kahoot!</option>
							<option value="test">{m.qb_outside_paper()}</option>
						</select>
					</div>
				</div>
				<div class="field">
					<label for="os-title">{m.qb_test_name()}</label>
					<input id="os-title" name="title" maxlength="120" />
				</div>
				<div class="row2">
					<div class="field">
						<label for="os-subject">{m.qb_subject()}</label>
						<input id="os-subject" name="subject" required maxlength="60" />
					</div>
					<div class="field">
						<label for="os-chapter">{m.qb_chapter()}</label>
						<input id="os-chapter" name="chapter" required maxlength="80" />
					</div>
				</div>
				<div class="row2">
					<div class="field">
						<label for="os-score">{m.qb_score()}</label>
						<input id="os-score" name="score" type="number" min="0" max="1000" required />
					</div>
					<div class="field">
						<label for="os-max">{m.qb_out_of()}</label>
						<input id="os-max" name="maxScore" type="number" min="1" max="1000" required />
					</div>
				</div>
				<div class="row2">
					<div class="field">
						<label for="os-term">{m.qb_term()}</label>
						<select id="os-term" name="term">
							<option value="">{m.qb_term_auto()}</option>
							{#each ['Term 1', 'Term 2', 'Term 3'] as tm (tm)}<option value={tm}>{tm}</option
								>{/each}
						</select>
					</div>
					<div class="field">
						<label for="os-date">{m.qb_taken_on()}</label>
						<input id="os-date" name="takenOn" type="date" max={data.today} value={data.today} />
					</div>
				</div>
				<button class="btn" type="submit">{m.qb_save_score()}</button>
			</form>
		{:else}
			<p class="note">{m.st5_no_students()}</p>
		{/if}
	</details>

	<section class="part">
		<div class="section-h"><h2>{m.st5_recent_results()}</h2></div>
		{#if data.results.length}
			<ul class="rows">
				{#each data.results as r (r.id)}
					<li>
						<span class="grow"
							><strong>{r.name}</strong><span class="small muted block"
								>{r.source === 'daily_check' ? m.st5_daily_title() : r.title}{r.source ===
								'google_forms'
									? ' · Google Forms'
									: r.source === 'kahoot'
										? ' · Kahoot!'
										: ''} · {r.topic} · {fmtDate(fromLocal(r.takenOn))}</span
							></span
						>
						<strong>{r.score}/{r.maxScore}</strong>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="note">{m.st5_results_empty()}</p>
		{/if}
	</section>
</div>

<style>
	.hub {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.hubcard {
		display: flex;
		flex-direction: column;
		gap: 4px;
		text-decoration: none;
		color: inherit;
		min-height: 76px;
	}
	.hubcard.attn {
		border-color: var(--amber, #d89b2b);
	}
	.row2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.part {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.grow {
		flex: 1;
		min-width: 0;
		color: inherit;
		text-decoration: none;
	}
	.block {
		display: block;
	}
	.more summary {
		cursor: pointer;
		font-weight: 600;
		color: var(--ocean);
		min-height: 44px;
		display: flex;
		align-items: center;
	}
</style>
