<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay, fmtMinutes, fmtTime, localDate } from '#lib/tz.ts';
	import LineIcon from '#lib/components/LineIcon.svelte';
	import Avatar from '#lib/components/ui/Avatar.svelte';
	import ProgressRing from '#lib/components/ui/ProgressRing.svelte';
	let { data, form } = $props();
	const c = $derived(data.child);
	const n = $derived(c.firstName);
	const tipText = $derived.by(() => {
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
	const today = localDate(new Date());
	const isToday = (d: Date) => localDate(d) === today;
	const proposed = $derived(data.requests.filter((r) => r.status === 'proposed'));
	const late = $derived(data.homework.filter((h) => h.dueOn && h.dueOn < today));
	const q = $derived(`child=${encodeURIComponent(c.studentId)}`);
</script>

<svelte:head><title>{c.firstName} · Tutora</title></svelte:head>

<div class="screen ui-page">
	<a class="back" href="/parent" aria-label={m.v3_back()}>←</a>
	<header class="ui-card who">
		<Avatar name={c.name} photo={data.photo} size={76} />
		<div>
			<h1 class="ui-serif">{c.name}</h1>
			{#if data.level}<span class="level"><LineIcon name="school" size={16} /> {data.level}</span
				>{/if}
		</div>
	</header>

	{#if form?.responded}<p class="notice" role="status">
			{form.responded === 'yes' ? m.par3_req_yes() : m.par3_req_no()}
		</p>{/if}
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if data.booked}<p class="notice" role="status">{m.par3_booked()}</p>{/if}

	{#if c.alert}
		<div class="ui-card sky today">
			{#if c.alert.kind === 'study_now' || c.alert.kind === 'study_later'}
				<span class="small muted">{m.par3_today_at({ time: fmtMinutes(c.alert.startMinute) })}</span
				>
				<strong
					>{c.alert.kind === 'study_now'
						? m.par3_study_now({ name: n, subject: c.alert.subject })
						: m.par3_study_later({ name: n, subject: c.alert.subject })}</strong
				>
				<span class="small muted"
					>{m.par3_keep_free({ name: n, until: fmtMinutes(c.alert.endMinute) })}</span
				>
			{:else if c.alert.kind === 'study_done'}
				<span class="small muted">{m.par3_today_at({ time: fmtTime(c.alert.at) })}</span>
				<strong>{m.par3_study_done({ name: n, subject: c.alert.subject })}</strong>
				<span class="small muted">{m.par3_minutes({ n: c.alert.minutes })}</span>
			{:else}
				<span class="small muted">{m.par3_today_at({ time: fmtTime(c.alert.at) })}</span>
				<strong
					>{m.par3_lesson_today({ name: n, subject: c.alert.subject ?? m.intro_chat() })}</strong
				>
				<span class="small muted"
					>{c.alert.mode === 'online' ? m.find3_online() : m.sh_in_person()}</span
				>
			{/if}
		</div>
	{/if}

	<div class="ui-cols">
		<div>
			{#if proposed.length || late.length}
				<section class="ui-card attn" id="attention" aria-labelledby="att-h">
					<h2 id="att-h" class="ui-serif">{m.pf_needs_you()}</h2>
					{#each proposed as r (r.id)}
						<div class="req">
							<strong
								>{r.subjectName ?? m.intro_chat()}{r.tutorName ? ` · ${r.tutorName}` : ''}</strong
							>
							{#if r.proposedStartsAt}<span class="small"
									>{m.par3_req_proposed({
										when: `${fmtDay(r.proposedStartsAt)} ${fmtTime(r.proposedStartsAt)}`
									})}</span
								>{/if}
							{#if r.tutorMessage}<span class="small muted">“{r.tutorMessage}”</span>{/if}
							<span class="acts">
								<form method="POST" action="?/respond">
									<input type="hidden" name="id" value={r.id} />
									<input type="hidden" name="answer" value="yes" />
									<button class="ui-btn" type="submit">{m.accept_new_time()}</button>
								</form>
								<form method="POST" action="?/respond">
									<input type="hidden" name="id" value={r.id} />
									<input type="hidden" name="answer" value="no" />
									<button class="ui-btn-soft" type="submit">{m.no_thanks()}</button>
								</form>
							</span>
						</div>
					{/each}
					{#each late as h (h.id)}
						<p class="small">
							{m.pf_hw_late({ title: h.title, day: fmtDay(new Date(h.dueOn + 'T12:00:00Z')) })}
						</p>
					{/each}
				</section>
			{/if}

			<section class="ui-card" aria-labelledby="prog-h">
				<div class="ui-sec-h">
					<h2 id="prog-h">{m.pf_progress()}</h2>
					{#if c.access.progress}<a href="/parent/progress?{q}">{m.pf_details()} ›</a>{/if}
				</div>
				{#if !c.access.progress}
					<p class="muted">{m.pf_not_shared({ name: n })}</p>
				{:else if c.overall !== null}
					<div class="ov">
						<ProgressRing pct={c.overall} size={84} />
						<div>
							<strong>{m.par3_overall()}</strong>
							<span class="small muted">{m.pf_last30()}</span>
						</div>
					</div>
				{:else}
					<p class="muted">{m.par3_no_scores()}</p>
				{/if}
				{#each c.exams as e (e.id)}
					<p class="small">
						{m.pg3_exam({ title: e.title })}{e.daysLeft !== null
							? ` · ${m.pg3_days({ n: e.daysLeft })}`
							: ''} · <strong>{m.pg3_ready({ ready: e.ready, total: e.total })}</strong>
					</p>
				{/each}
				{#if c.week}
					<p class="small">
						{m.par3_sessions_week()}:
						<strong
							>{c.week.planned
								? `${Math.min(c.week.done, c.week.planned)}/${c.week.planned}${c.week.done > c.week.planned ? ` +${c.week.done - c.week.planned}` : ''}`
								: c.week.done}</strong
						>
					</p>
				{/if}
			</section>

			<section class="ui-card cream tip" aria-labelledby="tip-h">
				<h2 id="tip-h" class="small-h"><LineIcon name="sun" size={20} /> {m.par3_how_help()}</h2>
				<p class="ui-serif">{tipText}</p>
			</section>

			<section class="ui-card" id="lessons" aria-labelledby="les-h">
				<div class="ui-sec-h">
					<h2 id="les-h">{m.pf_lessons()}</h2>
					{#if data.guardian}<a href="/parent/book?{q}">{m.pf_book()} ›</a>{/if}
				</div>
				{#if !c.access.lessons}
					<p class="muted">{m.pf_not_shared({ name: n })}</p>
				{:else}
					<ul class="rows-list">
						{#each data.requests.filter((r) => r.status !== 'proposed') as r (r.id)}
							<li>
								<span
									>{r.subjectName ?? m.intro_chat()}{r.tutorName ? ` · ${r.tutorName}` : ''}</span
								>
								<span class="small muted"
									>{#if r.status === 'requested'}{fmtDay(r.startsAt)}
										{fmtTime(r.startsAt)} · {m.par3_req_waiting()}{:else}{m.par3_req_declined()}{#if r.tutorSlug}
											· <a href="/parent/book?{q}&tutor={encodeURIComponent(r.tutorSlug)}"
												>{m.choose_another_time()}</a
											>{/if}{/if}</span
								>
							</li>
						{/each}
						{#each c.upcoming as l (l.id)}
							<li>
								<span
									>{l.subjectName ?? m.intro_chat()}{l.tutorName ? ` · ${l.tutorName}` : ''}</span
								>
								<span class="small muted"
									>{isToday(l.startsAt) ? m.sh_today() : fmtDay(l.startsAt)}
									{fmtTime(l.startsAt)}</span
								>
							</li>
						{:else}
							{#if !data.requests.length}<li class="muted">{m.pf_none_booked()}</li>{/if}
						{/each}
					</ul>
				{/if}
			</section>
		</div>

		<div>
			<section class="ui-card" aria-labelledby="tut-h">
				<div class="ui-sec-h"><h2 id="tut-h">{m.v3_nav_tutors()}</h2></div>
				<ul class="rows-list">
					{#each data.tutors as tu (tu.slug)}
						<li>
							<span class="who-t"
								><span class="ui-ico blue"><LineIcon name="tutors" size={18} /></span>{tu.name ??
									''}</span
							>
							<a class="small" href="/t/{tu.slug}">{m.pf_profile()} ›</a>
						</li>
					{:else}
						<li>
							<span class="muted">{m.pf_no_tutor()}</span>
							<a class="small" href="/parent/tutors#find">{m.pf_find_tutor()} ›</a>
						</li>
					{/each}
				</ul>
				{#if data.readsMessages}<a class="ui-btn-soft" href="/parent/messages?{q}"
						><LineIcon name="chat" size={18} /> {m.msg_parent_link()}</a
					>{/if}
			</section>

			{#if data.schoolPlus}
				<section class="ui-card" aria-labelledby="sp-h" data-testid="child-school-plus">
					<div class="ui-sec-h"><h2 id="sp-h">{m.sp3_title()}</h2></div>
					<p class="small">
						{data.schoolPlus.subject} · {data.schoolPlus.school}<br /><span class="muted"
							>{t(`sp3_status_${data.schoolPlus.status}`)}</span
						>
					</p>
					<a class="ui-btn-soft" href="/parent/school-plus/{data.schoolPlus.id}">{m.spp_open()} ›</a
					>
				</section>
			{/if}

			<section class="ui-card" aria-labelledby="hw-h">
				<div class="ui-sec-h"><h2 id="hw-h">{m.pf_homework()}</h2></div>
				{#if !c.access.homework}
					<p class="muted">{m.pf_not_shared({ name: n })}</p>
				{:else}
					<ul class="rows-list">
						{#each data.homework as h (h.id)}
							<li>
								<span>{h.title}</span>
								<span class="small muted"
									>{h.dueOn ? fmtDay(new Date(h.dueOn + 'T12:00:00Z')) : m.pf_no_due()}</span
								>
							</li>
						{:else}
							<li class="muted">{m.pf_hw_none({ name: n })}</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="ui-card" aria-labelledby="ci-h">
				<div class="ui-sec-h"><h2 id="ci-h">{m.pf_feelings()}</h2></div>
				{#if c.checkin}
					<p>
						{m.par3_shared_checkin({ name: n })}: <strong>“{t(`ci_${c.checkin.mood}`)}”</strong>
					</p>
				{:else}
					<p class="muted">{m.pf_no_checkin({ name: n })}</p>
				{/if}
				{#if data.sharesReport}
					<a class="ui-btn-soft" href="/parent/personal?{q}">{m.pf_personal_report()} ›</a>
				{:else}
					<p class="small muted">{m.pf_report_private({ name: n })}</p>
				{/if}
			</section>

			<nav class="ui-card links" aria-label={m.pf_more()}>
				<a href="/parent/report?{q}"><span>{m.par3_weekly()}</span><span>›</span></a>
				<a href="/parent/buddies?{q}"><span>{m.pb_link()}</span><span>›</span></a>
				{#if data.guardian}<a href="/parent/payments?{q}"
						><span>{m.par3_pay_for({ name: n })}</span><span>›</span></a
					>{/if}
			</nav>
			<p class="note">{m.par3_privacy({ name: n })}</p>
		</div>
	</div>
</div>

<style>
	.who {
		display: flex;
		align-items: center;
		gap: 16px;
	}
	.who h1 {
		margin: 0 0 4px;
		font-size: 1.75rem;
	}
	.level {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 3px 10px;
		border-radius: 999px;
		background: var(--ice);
		color: var(--navy);
		font-size: 0.875rem;
	}
	.today {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.attn {
		border-color: #f2c9c9;
		background: #fff8f8;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.attn h2,
	.tip h2 {
		margin: 0;
		font-size: 1.2rem;
	}
	.small-h {
		display: flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-display);
		color: var(--navy);
	}
	.req {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.acts {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-top: 4px;
	}
	.ui-card > .ui-sec-h {
		margin-bottom: 10px;
	}
	.ov {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.ov div {
		display: flex;
		flex-direction: column;
	}
	.tip p {
		margin: 6px 0 0;
		font-size: 1.125rem;
		line-height: 1.45;
	}
	.rows-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.rows-list li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		padding: 10px 0;
		border-bottom: 1px solid var(--border);
		flex-wrap: wrap;
	}
	.rows-list li:last-child {
		border-bottom: none;
	}
	.who-t {
		display: inline-flex;
		align-items: center;
		gap: 10px;
	}
	.who-t .ui-ico {
		width: 34px;
		height: 34px;
		border-radius: 50%;
	}
	.links {
		display: flex;
		flex-direction: column;
		padding: 4px 16px;
	}
	.links a {
		display: flex;
		justify-content: space-between;
		padding: 12px 0;
		border-bottom: 1px solid var(--border);
		color: var(--navy);
		text-decoration: none;
		font-weight: 600;
	}
	.links a:last-child {
		border-bottom: none;
	}
	.ui-cols > div {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.ui-cols {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	@media (min-width: 900px) {
		.ui-cols {
			display: grid;
		}
	}
</style>
