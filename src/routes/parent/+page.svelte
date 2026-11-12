<script lang="ts">
	import { page } from '$app/state';
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay, fmtMinutes, fmtTime, localDate } from '#lib/tz.ts';
	import ChildSwitcher from '#lib/components/parent/ChildSwitcher.svelte';
	let { data } = $props();
	const connected = $derived(page.url.searchParams.get('connected'));
	const pending = $derived(page.url.searchParams.get('pending'));
	const c = $derived(data.child);
	const n = $derived(c?.firstName ?? '');
	const tipText = $derived.by(() => {
		if (!c) return '';
		const tp = c.tip;
		switch (tp.kind) {
			case 'weak_planned':
				return m.par3_tip_weak_planned({ name: n, topic: tp.topic });
			case 'weak':
				return m.par3_tip_weak({ name: n, topic: tp.topic });
			case 'hard':
				return m.par3_tip_hard({ name: n });
			case 'break':
				return m.par3_tip_break({ name: n });
			case 'all_done':
				return m.par3_tip_all_done({ name: n });
			case 'streak':
				return m.par3_tip_streak({ name: n, days: tp.days });
			case 'homework':
				return m.par3_tip_homework({
					title: tp.title,
					day: fmtDay(new Date(tp.dueOn + 'T12:00:00Z'))
				});
			case 'exam':
				return m.par3_tip_exam({ name: n, title: tp.title, days: tp.days });
			default:
				return m.par3_tip_interest({ name: n });
		}
	});
	const isToday = (d: Date) => localDate(d) === localDate(new Date());
</script>

<svelte:head><title>{m.v3_nav_overview()} · Tutora</title></svelte:head>

<div class="screen wide-2">
	<div class="full stackish">
		<h1>{m.par_hello({ name: data.name })}</h1>
		{#if connected}<p class="notice" role="status">{m.par_connected({ name: connected })}</p>{/if}
		{#if pending}<p class="notice" role="status">{m.par_pending({ name: pending })}</p>{/if}
		{#if page.url.searchParams.has('booked')}<p class="notice" role="status">
				{m.par3_booked()}
			</p>{/if}
		{#if data.waitingCode}
			<div class="softcard">
				<span>{m.par_code_waiting({ name: data.waitingCode.firstName })}</span>
				<a class="btn" href="/code/connect">{m.par_code_finish()}</a>
			</div>
		{/if}
		<ChildSwitcher kids={data.kids} current={data.current} base="/parent" />
	</div>

	{#if !data.kids.length}
		<div class="full stackish">
			<h2 class="h3">{m.par_no_children()}</h2>
			<p class="lead">{m.par_no_children_lead()}</p>
			<a class="btn" href="/parent/children">{m.par_add_child_code_h()}</a>
		</div>
	{:else if !c}
		<p class="lead full">{m.par_pending_short()}</p>
	{:else}
		<div class="stackish">
			{#if c.alert}
				<div class="card alert-card">
					{#if c.alert.kind === 'study_now'}
						<span class="eyebrow muted"
							>{m.par3_today_at({ time: fmtMinutes(c.alert.startMinute) })}</span
						>
						<strong>{m.par3_study_now({ name: n, subject: c.alert.subject })}</strong>
						<span class="small muted"
							>{m.par3_keep_free({ name: n, until: fmtMinutes(c.alert.endMinute) })}</span
						>
					{:else if c.alert.kind === 'study_later'}
						<span class="eyebrow muted"
							>{m.par3_today_at({ time: fmtMinutes(c.alert.startMinute) })}</span
						>
						<strong>{m.par3_study_later({ name: n, subject: c.alert.subject })}</strong>
						<span class="small muted"
							>{m.par3_keep_free({ name: n, until: fmtMinutes(c.alert.endMinute) })}</span
						>
					{:else if c.alert.kind === 'study_done'}
						<span class="eyebrow muted">{m.par3_today_at({ time: fmtTime(c.alert.at) })}</span>
						<strong>{m.par3_study_done({ name: n, subject: c.alert.subject })}</strong>
						<span class="small muted">{m.par3_minutes({ n: c.alert.minutes })}</span>
					{:else}
						<span class="eyebrow muted">{m.par3_today_at({ time: fmtTime(c.alert.at) })}</span>
						<strong
							>{m.par3_lesson_today({
								name: n,
								subject: c.alert.subject ?? m.intro_chat()
							})}</strong
						>
						<span class="small muted"
							>{c.alert.mode === 'online' ? m.find3_online() : m.sh_in_person()}</span
						>
					{/if}
				</div>
			{/if}

			{#if c.checkin}
				<div class="softcard">
					<span class="eyebrow">{m.par3_shared_checkin({ name: n })}</span>
					<strong>“{t(`ci_${c.checkin.mood}`)}”</strong>
				</div>
			{/if}

			<div class="stat3">
				<div>
					<strong
						>{c.week
							? c.week.planned
								? `${c.week.done}/${c.week.planned}`
								: c.week.done
							: '—'}</strong
					>
					<span>{c.week ? m.par3_sessions() : m.par3_not_shared()}</span>
				</div>
				<div>
					<strong>{c.overall !== null ? `${c.overall}%` : '—'}</strong>
					<span
						>{c.access.progress
							? c.overall !== null
								? m.par3_overall()
								: m.par3_no_scores()
							: m.par3_not_shared()}</span
					>
				</div>
				<div>
					<strong>{c.lessonsBooked ?? '—'}</strong>
					<span>{c.lessonsBooked !== null ? m.par3_lessons_booked() : m.par3_not_shared()}</span>
				</div>
			</div>

			<div class="help">
				<span class="eyebrow">{m.par3_how_help()}</span>
				<p class="serif tip">{tipText}</p>
			</div>
		</div>

		<div class="side stackish">
			{#if c.upcoming.length}
				<section>
					<div class="section-h"><h2>{m.par3_upcoming()}</h2></div>
					<div class="rows">
						{#each c.upcoming as l (l.id)}
							<div>
								<span
									>{l.subjectName ?? m.intro_chat()}{l.tutorName ? ` · ${l.tutorName}` : ''}</span
								>
								<span class="muted small"
									>{isToday(l.startsAt) ? m.sh_today() : fmtDay(l.startsAt)}
									{fmtTime(l.startsAt)}</span
								>
							</div>
						{/each}
					</div>
				</section>
			{/if}
			{#each c.exams as e (e.id)}
				<div class="rows top">
					<div>
						<span
							>{m.pg3_exam({ title: e.title })}{e.daysLeft !== null
								? ` · ${m.pg3_days({ n: e.daysLeft })}`
								: ''}</span
						>
						<strong>{m.pg3_ready({ ready: e.ready, total: e.total })}</strong>
					</div>
				</div>
			{/each}
			<div class="links rows top">
				<a href="/parent/updates?child={c.studentId}"
					><span>{m.par3_see_updates()}</span><span class="go">›</span></a
				>
				<a href="/parent/report?child={c.studentId}"
					><span>{m.par3_weekly()}</span><span class="go">›</span></a
				>
				<a href="/parent/buddies?child={c.studentId}"
					><span>{m.pb_link()}</span><span class="go">›</span></a
				>
				<a href="/parent/messages?child={c.studentId}"
					><span>{m.msg_parent_link()}</span><span class="go">›</span></a
				>
				<a href="/parent/personal?child={c.studentId}"
					><span>{m.pp_link()}</span><span class="go">›</span></a
				>
				<a href="/parent/children"><span>{m.par3_manage()}</span><span class="go">›</span></a>
			</div>
			<p class="note">{m.par3_privacy({ name: n })}</p>
		</div>
	{/if}
</div>

<style>
	h1 {
		margin: 0;
		font-size: 1.75rem;
	}
	.stackish {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.alert-card {
		display: flex;
		flex-direction: column;
		gap: 3px;
		border-radius: 18px;
	}
	.alert-card strong {
		font-size: 0.9375rem;
	}
	.eyebrow.muted {
		color: var(--muted);
	}
	.help {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.tip {
		margin: 0;
		font-size: 1.1875rem;
		line-height: 1.45;
		color: var(--text);
	}
	.links a {
		text-decoration: none;
	}
</style>
