<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay, fmtDate } from '#lib/tz.ts';
	import { formatMoney } from '#lib/money.ts';
	import { waLink } from '#lib/whatsapp.ts';
	import { shrink } from '#lib/shrink.ts';
	import { moodLabel } from '#lib/components/tutor/mood.ts';
	let { data, form } = $props();
	const s = $derived(data.student);
	const money = (c: number) => formatMoney(c, data.currency);
	const now = $derived(new Date(data.now));
	const day = (iso: string) => fmtDay(new Date(iso + 'T12:00:00Z'));
	const WEEK = 7 * 86_400_000;
	const doneText = $derived.by(() => {
		if (!form) return null;
		if ('saved' in form && form.saved)
			return `${m.saved()}${form.receipt ? ` ${form.receipt}` : ''}`;
		switch ('done' in form ? form.done : null) {
			case 'attendance':
				return m.tut3_done_attendance();
			case 'school':
				return m.tut3_done_school();
			case 'result':
				return m.tut3_done_result();
			case 'lessonNote':
				return m.tut3_done_lesson_note();
		}
		return null;
	});
	const meterCls = (pct: number) => (pct < 60 ? 'low' : pct < 70 ? 'mid' : '');
	const sourceLabel = (k: string) =>
		({
			test: m.tut3_src_test(),
			quiz: m.tut3_src_quiz(),
			kahoot: 'Kahoot!',
			daily_check: m.tut3_src_daily(),
			homework: m.tut3_src_homework()
		})[k] ?? k;
</script>

<svelte:head><title>{s.name} · Tutora</title></svelte:head>

<section class="screen">
	<a class="back" href="/tutor/students" aria-label={m.students_title()}>‹</a>
	<div class="head">
		<span class="avatar-l" aria-hidden="true">{s.name.trim().charAt(0).toUpperCase()}</span>
		<div>
			<h1>{s.name}</h1>
			<span class="note"
				>{s.childName ? m.for_child({ name: s.childName }) : ''}{s.childName && s.level
					? ' · '
					: ''}{s.level ?? ''}</span
			>
		</div>
	</div>

	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if doneText}<p class="notice" role="status">{doneText}</p>{/if}

	<!-- how learning feels: only what the student shares with tutors -->
	<div class="softcard">
		<span class="eyebrow">{m.tut3_latest_checkin()}</span>
		{#if data.checkin}
			<strong>“{moodLabel(data.checkin.mood)}”</strong>
			<span class="note"
				>{fmtDay(new Date(data.checkin.createdAt))}{data.checkin.subject
					? ` · ${data.checkin.subject}`
					: ''}</span
			>
		{:else}
			<span class="note">{m.tut3_no_checkin()}</span>
		{/if}
	</div>

	<div class="section-h"><h2>{m.tut3_scores_h()}</h2></div>
	{#if data.scores.length}
		<ul class="rows topics">
			{#each data.scores as sc (sc.subject + sc.topic)}
				<li>
					<div class="topic">
						<div class="line">
							<span>{sc.topic} <span class="note">· {sc.subject}</span></span><strong
								>{sc.pct}%</strong
							>
						</div>
						<div class="meter {meterCls(sc.pct)}" aria-hidden="true">
							<span style="width:{sc.pct}%"></span>
						</div>
					</div>
				</li>
			{/each}
		</ul>
		<p class="note">{m.tut3_scores_note()}</p>
	{:else}
		<p class="note">{m.tut3_no_scores()}</p>
	{/if}

	<div class="section-h"><h2>{m.tut3_results_h()}</h2></div>
	<ul class="rows">
		{#each data.results as r (r.id)}
			<li class="col">
				<div class="line">
					<span>{r.title} <span class="note">· {r.subject}, {r.topic}</span></span>
					<strong>{r.score}/{r.maxScore}</strong>
				</div>
				<span class="note">{day(r.takenOn)} · {sourceLabel(r.source)}</span>
				{#if r.feedback && r.mine}<span class="note quote">“{r.feedback}”</span>{/if}
			</li>
		{:else}
			<li class="note">{m.tut3_no_results()}</li>
		{/each}
	</ul>
	<details class="fold" open={form && 'form' in form && form.form === 'result'}>
		<summary>{m.tut3_record_result()}</summary>
		<form method="POST" action="?/result" class="stack" novalidate>
			<p class="note">{m.tut3_record_result_lead()}</p>
			<div class="row">
				<div class="field grow">
					<label for="r-subj">{m.tut3_subject()}</label><input
						id="r-subj"
						name="subject"
						maxlength="60"
						required
					/>
				</div>
				<div class="field grow">
					<label for="r-topic">{m.tut3_topic()}</label><input
						id="r-topic"
						name="topic"
						maxlength="80"
						required
					/>
				</div>
			</div>
			<div class="field">
				<label for="r-title">{m.tut3_result_title()}</label><input
					id="r-title"
					name="title"
					maxlength="120"
					placeholder={m.tut3_result_title_hint()}
				/>
			</div>
			<div class="row">
				<div class="field grow">
					<label for="r-score">{m.tut3_score()}</label><input
						id="r-score"
						name="score"
						type="number"
						inputmode="numeric"
						min="0"
						required
					/>
				</div>
				<div class="field grow">
					<label for="r-max">{m.tut3_out_of()}</label><input
						id="r-max"
						name="maxScore"
						type="number"
						inputmode="numeric"
						min="1"
						max="1000"
						required
					/>
				</div>
				<div class="field grow">
					<label for="r-date">{m.date()}</label><input
						id="r-date"
						name="takenOn"
						type="date"
						max={data.today}
						value={data.today}
					/>
				</div>
			</div>
			<div class="field">
				<label for="r-fb">{m.feedback()}</label><textarea
					id="r-fb"
					name="feedback"
					rows="2"
					maxlength="2000"></textarea>
			</div>
			<button class="btn btn-block" type="submit">{m.tut3_save_result()}</button>
		</form>
	</details>

	<div class="section-h"><h2>{m.tut3_school_h()}</h2></div>
	{#if data.school.school || data.school.year}<p class="note">
			{[data.school.school, data.school.year].filter(Boolean).join(' · ')}
		</p>{/if}
	<ul class="rows">
		{#each data.school.subjects as sub (sub.id)}
			<li class="col">
				<div class="line">
					<strong>{sub.subject}</strong>
					{#if sub.checkedAt}
						<span class="ok-t small">{m.tut3_checked_by({ name: sub.checkedByName ?? '' })}</span>
					{:else}
						<form method="POST" action="?/checkSchool">
							<input type="hidden" name="id" value={sub.id} />
							<button class="linkbtn" type="submit">{m.tut3_mark_checked()}</button>
						</form>
					{/if}
				</div>
				{#if sub.currentTopic}<span class="note"
						>{m.tut3_school_now({ topic: sub.currentTopic })}</span
					>{/if}
				{#if sub.syllabus || sub.textbook}<span class="note"
						>{[sub.syllabus, sub.textbook].filter(Boolean).join(' · ')}</span
					>{/if}
			</li>
		{:else}
			<li class="note">{m.tut3_no_school()}</li>
		{/each}
	</ul>

	<div class="section-h"><h2>{m.tut3_contact_h()}</h2></div>
	<ul class="rows">
		<li><span class="note">{m.field_email()}</span><span class="wrap-any">{s.email}</span></li>
		{#if s.phone}<li>
				<span class="note">{m.phone()}</span><a
					href={waLink(s.phone)}
					target="_blank"
					rel="noopener noreferrer">{s.phone} · WhatsApp</a
				>
			</li>{/if}
		{#if s.isUnder18}
			<li>
				<span class="note">{m.parent()}</span>
				<span class="right"
					>{s.parentName}{s.parentPhone ? ` · ${s.parentPhone}` : ''}{s.parentEmail
						? ` · ${s.parentEmail}`
						: ''}{#if s.parentPhone}
						· <a href={waLink(s.parentPhone)} target="_blank" rel="noopener noreferrer"
							>{m.wa_parent()}</a
						>{/if}</span
				>
			</li>
		{/if}
		<li>
			<span class="note">{m.account_role()}</span><span
				>{s.role === 'parent'
					? m.role_parent()
					: s.isUnder18
						? m.role_student_minor()
						: m.role_student()}</span
			>
		</li>
	</ul>
	<form method="POST" action="?/level" class="row">
		<label class="sr-only" for="lvl">{m.level()}</label>
		<input
			id="lvl"
			name="level"
			class="grow input"
			defaultValue={s.level ?? ''}
			placeholder={m.level_hint()}
			maxlength="60"
		/>
		<button class="btn btn-ghost btn-sm" type="submit">{m.save()}</button>
	</form>

	<div class="section-h"><h2>{m.payments_h()}</h2></div>
	<div class="stat3">
		<div><strong>{money(data.balance.paid)}</strong><span>{m.paid()}</span></div>
		<div><strong>{money(data.balance.waiting)}</strong><span>{m.waiting()}</span></div>
		<div>
			<strong class:owe={data.balance.owed > 0}>{money(data.balance.owed)}</strong><span
				>{m.owed()}</span
			>
		</div>
	</div>
	{#if data.balance.credit > 0}<p class="note">
			{m.credit({ amount: money(data.balance.credit) })}
		</p>{/if}
	{#each data.packages as p (p.id)}
		<p class="note">
			{m.package_left({
				name: p.name,
				left: p.lessonsTotal - p.lessonsUsed,
				total: p.lessonsTotal
			})}
		</p>
	{/each}
	<ul class="rows">
		{#each data.payments as p (p.id)}
			<li>
				<span>{money(p.amountCents)} · {fmtDay(p.createdAt)}</span>
				{#if p.receipt}<a href="/tutor/payments/{p.id}/receipt">{p.receipt}</a>{:else}<span
						class={p.status === 'rejected' ? 'note' : 'warn-t small'}
						>{p.status === 'rejected' ? m.status_rejected() : m.status_waiting()}</span
					>{/if}
			</li>
		{:else}
			<li class="note">{m.none_yet()}</li>
		{/each}
	</ul>
	<details class="fold">
		<summary>{m.record_cash()}</summary>
		<form method="POST" action="?/cash" class="stack" novalidate>
			<div class="row">
				<div class="field grow">
					<label for="ca">{m.amount({ currency: data.currency === 'ZWG' ? 'ZiG' : 'USD' })}</label
					><input id="ca" name="amount" inputmode="decimal" required />
				</div>
				<div class="field grow">
					<label for="cd">{m.date()}</label><input
						id="cd"
						name="date"
						type="date"
						defaultValue={data.today}
					/>
				</div>
			</div>
			<button class="btn" type="submit">{m.record_cash_btn()}</button>
		</form>
	</details>

	<div class="section-h"><h2>{m.lessons_notes_h()}</h2></div>
	<ul class="rows">
		{#each data.lessons as l (l.attendeeId)}
			{@const cancelled = l.attendeeStatus === 'cancelled' || l.lessonStatus === 'cancelled'}
			{@const started = new Date(l.startsAt) <= now}
			<li class="col">
				<div class="line">
					<a class="lesson-link" href="/tutor/lessons/{l.lessonId}"
						>{fmtDay(new Date(l.startsAt))} · {l.subjectName ?? m.intro_chat()}</a
					>
					{#if cancelled}<span class="note">{m.cancelled()}</span>{:else if started}<span
							class="small {l.attendance === 'absent'
								? 'warn-t'
								: l.attendance === 'completed'
									? 'ok-t'
									: 'note'}"
							>{l.attendance === 'absent'
								? m.att_absent()
								: l.attendance === 'completed'
									? m.status_done()
									: m.att_not_marked()}</span
						>{:else}<span class="next-t small">{m.booked()}</span>{/if}
				</div>
				{#if !cancelled && started && new Date(l.endsAt).getTime() > now.getTime() - WEEK}
					<div class="acts">
						{#if l.attendance !== 'completed'}
							<form method="POST" action="?/attendance">
								<input type="hidden" name="attendeeId" value={l.attendeeId} />
								<input type="hidden" name="value" value="completed" />
								<button class="linkbtn" type="submit">{m.att_mark_done()}</button>
							</form>
						{/if}
						{#if l.attendance !== 'absent'}
							<form method="POST" action="?/attendance">
								<input type="hidden" name="attendeeId" value={l.attendeeId} />
								<input type="hidden" name="value" value="absent" />
								<button class="linkbtn" type="submit">{m.att_mark_absent()}</button>
							</form>
						{/if}
					</div>
				{/if}
				{#if !cancelled && started}
					<form method="POST" action="?/lessonNote" class="stack">
						<input type="hidden" name="attendeeId" value={l.attendeeId} />
						<label class="small" for="ln-{l.attendeeId}">{m.tut3_note_for_student()}</label>
						<textarea
							id="ln-{l.attendeeId}"
							name="text"
							rows="2"
							maxlength="2000"
							placeholder={m.tut3_note_for_student_hint()}
							defaultValue={l.feedback ?? ''}></textarea>
						<button class="btn btn-ghost btn-sm" type="submit">{m.tut3_send_note()}</button>
					</form>
				{/if}
				<form method="POST" action="?/note" class="stack">
					<input type="hidden" name="attendeeId" value={l.attendeeId} />
					<label class="small" for="n-{l.attendeeId}">{m.tut3_private_note_label()}</label>
					<textarea
						id="n-{l.attendeeId}"
						name="note"
						rows="2"
						maxlength="2000"
						placeholder={m.private_note_hint()}
						defaultValue={l.note ?? ''}></textarea>
					<button class="btn btn-ghost btn-sm" type="submit">{m.save_note()}</button>
				</form>
			</li>
		{:else}
			<li class="note">{m.none_yet()}</li>
		{/each}
	</ul>

	<div class="section-h">
		<h2>{m.homework_h()}</h2>
		<a href="/tutor/homework">{m.v3_nav_marking()}</a>
	</div>
	<ul class="rows">
		{#each data.homework as h (h.id)}
			<li class="col">
				<div class="line">
					<strong>{h.title}</strong>
					{#if h.dueOn}<span class="note"
							>{m.due({ date: fmtDate(new Date(h.dueOn + 'T12:00:00Z')) })}</span
						>{/if}
				</div>
				{#if h.subject || h.topic}<span class="note"
						>{[h.subject, h.topic].filter(Boolean).join(' · ')}</span
					>{/if}
				{#if h.note}<p class="small prewrap">{h.note}</p>{/if}
				{#if h.fileUrl}<a class="small" href={h.fileUrl} target="_blank" rel="noopener"
						>{h.fileName}</a
					>{/if}
				{#each h.answers as a (a.id)}
					<div class="answer">
						<strong class="small"
							>{m.answer_from({ date: fmtDay(a.createdAt) })}{a.score !== null && a.maxScore
								? ` · ${a.score}/${a.maxScore}`
								: ''}</strong
						>
						{#if a.note}<p class="small prewrap">{a.note}</p>{/if}
						{#if a.fileUrl}<a class="small" href={a.fileUrl} target="_blank" rel="noopener"
								>{a.fileName}</a
							>{/if}
						<form method="POST" action="?/feedback" class="stack">
							<input type="hidden" name="answerId" value={a.id} />
							<label class="sr-only" for="fb-{a.id}">{m.feedback()}</label>
							<textarea
								id="fb-{a.id}"
								name="feedback"
								rows="2"
								maxlength="1000"
								placeholder={m.feedback()}
								defaultValue={a.feedback ?? ''}></textarea>
							<button class="btn btn-ghost btn-sm" type="submit">{m.send_feedback()}</button>
						</form>
					</div>
				{/each}
			</li>
		{:else}
			<li class="note">{m.none_yet()}</li>
		{/each}
	</ul>
	<details class="fold">
		<summary>{m.give_homework()}</summary>
		<form method="POST" action="?/homework" enctype="multipart/form-data" class="stack" novalidate>
			<div class="field">
				<label for="hw-t">{m.title()}</label><input
					id="hw-t"
					name="title"
					maxlength="120"
					required
				/>
			</div>
			<div class="row">
				<div class="field grow">
					<label for="hw-s">{m.tut3_subject_optional()}</label><input
						id="hw-s"
						name="subject"
						maxlength="60"
					/>
				</div>
				<div class="field grow">
					<label for="hw-tp">{m.tut3_topic_optional()}</label><input
						id="hw-tp"
						name="topic"
						maxlength="80"
					/>
				</div>
			</div>
			<p class="note">{m.tut3_hw_topic_hint()}</p>
			<div class="field">
				<label for="hw-n">{m.instructions()}</label><textarea
					id="hw-n"
					name="note"
					rows="3"
					maxlength="2000"></textarea>
			</div>
			<div class="field">
				<label for="hw-d">{m.due_date_optional()}</label><input
					id="hw-d"
					name="dueOn"
					type="date"
				/>
			</div>
			<div class="field">
				<label for="hw-f">{m.file_optional()}</label><span class="hint">{m.file_hint_5mb()}</span
				><input
					id="hw-f"
					name="file"
					type="file"
					accept="image/jpeg,image/png,image/webp,application/pdf"
					use:shrink
				/>
			</div>
			<button class="btn btn-block" type="submit"
				>{m.send_homework({ name: s.name.split(' ')[0] })}</button
			>
		</form>
	</details>

	<p class="note">{m.stu_temp_admin()}</p>
</section>

<style>
	.back {
		align-self: flex-start;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-top: -8px;
	}
	.head h1 {
		margin: 0;
		font-size: 1.75rem;
	}
	.rows > li.col {
		flex-direction: column;
		align-items: stretch;
		gap: 6px;
	}
	.line {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
	}
	.topic {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.lesson-link {
		color: var(--text);
		text-decoration: none;
		font-weight: 600;
	}
	.lesson-link:hover {
		color: var(--plum);
	}
	.acts {
		display: flex;
		gap: 16px;
	}
	.linkbtn {
		background: none;
		border: none;
		padding: 10px 0;
		font: inherit;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--plum-2);
		cursor: pointer;
	}
	.answer {
		border-left: 3px solid var(--lilac);
		padding-left: 12px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.answer p,
	.col > p {
		margin: 0;
	}
	.right {
		text-align: right;
	}
	.wrap-any {
		overflow-wrap: anywhere;
		text-align: right;
	}
	.fold {
		border-top: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
	}
	.fold summary {
		cursor: pointer;
		font-weight: 700;
		padding: 12px 0;
		color: var(--plum);
	}
	.fold form {
		padding-bottom: 14px;
	}
</style>
