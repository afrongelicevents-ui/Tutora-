<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay, fmtMinutes, fmtTime, localDate } from '#lib/tz.ts';
	import { formatMoney } from '#lib/money.ts';
	import { CHECKIN_MOODS } from '#lib/checkin-moods.ts';
	let { data, form } = $props();

	const greet = $derived(
		data.partOfDay === 'morning'
			? m.sh_good_morning({ name: data.firstName })
			: data.partOfDay === 'afternoon'
				? m.sh_good_afternoon({ name: data.firstName })
				: m.sh_good_evening({ name: data.firstName })
	);
	const coming = $derived(data.plan.find((p) => p.state === 'now' || p.state === 'next'));
	const names = $derived(
		data.family.length <= 1
			? (data.family[0] ?? '')
			: `${data.family.slice(0, -1).join(', ')} ${m.and_word()} ${data.family.at(-1)}`
	);
	const picked = $derived((form?.checked as string | undefined) ?? data.checkin?.mood ?? null);
	const shared = $derived(form?.checked ? !!form.shared : !!data.checkin?.shared);
	const dayWord = (d: Date) => {
		const today = localDate(data.now);
		const tomorrow = localDate(new Date(data.now.getTime() + 86_400_000));
		const day = localDate(d);
		return day === today ? m.sh_today() : day === tomorrow ? m.sh_tomorrow() : fmtDay(d);
	};
	const how = (n: NonNullable<typeof data.next>) =>
		n.mode === 'in_person'
			? m.sh_in_person()
			: n.meeting === 'meet'
				? m.sh_on_meet()
				: n.meeting === 'teams'
					? m.sh_on_teams()
					: m.sh_on_room();
	const stateLabel: Record<string, () => string> = {
		done: m.sh_done,
		now: m.sh_now,
		next: m.sh_next,
		later: m.sh_later,
		missed: m.sh_missed
	};
</script>

<svelte:head><title>{m.v3_nav_home()} · Tutora</title></svelte:head>

<div class="screen wide-2">
	<div class="full">
		<h1>{greet}</h1>
		<p class="lead sub">
			{#if coming}{coming.state === 'now'
					? m.sh_study_now({ subject: coming.subject })
					: m.sh_study_at({ subject: coming.subject, time: fmtMinutes(coming.startMinute) })}
			{/if}
			{#if data.streak === 1}{m.sh_streak_one()}{:else if data.streak > 1}{m.sh_streak({
					n: data.streak
				})}{:else if !coming}{m.sh_no_plan()}{/if}
		</p>
	</div>

	{#each data.attention as a, i (i)}
		<a class="softcard attention full" href={a.link}>
			{a.kind === 'owe'
				? m.att_owe({
						amount: formatMoney(Number(a.text.values.amount), String(a.text.values.currency) as 'USD'),
						name: String(a.text.values.name)
					})
				: t(a.text.key, a.text.values)}
		</a>
	{/each}

	{#if data.next}
		<a class="plumcard next" href="/student/lessons/{data.next.id}">
			<span class="eyebrow">{m.sh_next_lesson()}</span>
			<strong
				>{data.next.kind === 'intro'
					? m.sh_intro_with({ tutor: data.next.tutorName ?? '' })
					: m.sh_lesson_with({
							subject: data.next.subjectName ?? '',
							tutor: data.next.tutorName ?? ''
						})}</strong
			>
			<span class="sub"
				>{dayWord(data.next.startsAt)} · {fmtTime(data.next.startsAt)} · {how(data.next)}</span
			>
			<span class="chev" aria-hidden="true">›</span>
		</a>
	{:else}
		<a class="plumcard next" href="/student/find">
			<span class="eyebrow">{m.sh_next_lesson()}</span>
			<strong>{m.sh_no_lesson()}</strong>
			<span class="sub">{m.sh_no_lesson_sub()}</span>
			<span class="chev" aria-hidden="true">›</span>
		</a>
	{/if}

	<section>
		<div class="section-h">
			<h2>{m.sh_todays_plan()}</h2>
			<a href="/student/progress">{m.sh_progress_link()}</a>
		</div>
		{#if data.plan.length}
			<div class="rows">
				{#each data.plan as p (p.id)}
					<div>
						{#if p.state === 'done'}
							<span class="muted struck">{fmtMinutes(p.startMinute)} {p.subject}{p.topic ? ` · ${p.topic}` : ''}</span>
							<span class="ok-t">{m.sh_done()}</span>
						{:else if p.state === 'now' || p.state === 'next'}
							<a href="/student/study"
								><strong>{fmtMinutes(p.startMinute)} {p.subject}{p.topic ? ` · ${p.topic}` : ''}</strong></a
							>
							<span class="next-t">{stateLabel[p.state]()}</span>
						{:else}
							<span>{fmtMinutes(p.startMinute)} {p.subject}{p.topic ? ` · ${p.topic}` : ''}</span>
							<span class="muted">{stateLabel[p.state]()}</span>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<p class="muted small">
				{m.sh_plan_empty()} <a href="/student/study">{m.sh_plan_make()}</a>
			</p>
		{/if}
	</section>

	<section class="softcard checkin">
		<strong>{m.sh_checkin_q()}</strong>
		<form method="POST" action="?/checkin" class="stack-s">
			{#if data.family.length}
				<label class="share"
					><input type="checkbox" name="share" checked={picked ? shared : false} />
					{m.sh_share_with({ names })}</label
				>
			{/if}
			<div class="chips">
				{#each CHECKIN_MOODS as mood (mood)}
					<button
						class="chip"
						type="submit"
						name="mood"
						value={mood}
						aria-pressed={picked === mood}>{t(`ci_${mood}`)}</button
					>
				{/each}
			</div>
		</form>
		{#if picked}
			<span class="small plum2" role="status">
				{#if !data.family.length}{m.sh_checkin_saved()} {m.sh_no_family_note()}
				{:else if shared}{m.sh_shared_with({ names })}
				{:else}{m.sh_kept_private()}{/if}
			</span>
			{#if data.family.length && data.checkinId}
				<form method="POST" action="?/share">
					<input type="hidden" name="id" value={data.checkinId} />
					<input type="hidden" name="shared" value={shared ? '' : 'on'} />
					<button class="btn-link small" type="submit"
						>{shared ? m.sh_make_private() : m.sh_share_it({ names })}</button
					>
				</form>
			{/if}
		{/if}
	</section>

	<nav class="rows top side links">
		<a href="/student/homework"
			><span><strong>{m.sh_homework_link()}</strong> · {data.due
					? m.sh_due_week({ n: data.due })
					: m.sh_nothing_due()}</span
			><span class="go" aria-hidden="true">›</span></a
		>
		<a href="/student/study"
			><span><strong>{m.sh_study_link()}</strong> · {m.sh_week_done({
					done: data.week.done,
					planned: data.week.planned
				})}</span
			><span class="go" aria-hidden="true">›</span></a
		>
		<a href="/student/check"
			><span><strong>{m.sh_check_link()}</strong> · {m.sh_check_sub()}</span><span
				class="go"
				aria-hidden="true">›</span
			></a
		>
		<a href="/student/tools"
			><span><strong>{m.sh_tools_link()}</strong> · {data.tools.length
					? data.tools.join(', ')
					: m.sh_tools_none()}</span
			><span class="go" aria-hidden="true">›</span></a
		>
		<a href="/student/payments"
			><span><strong>{m.sh_payments_link()}</strong></span><span class="go" aria-hidden="true"
				>›</span
			></a
		>
	</nav>
</div>

<style>
	.sub {
		margin: 6px 0 0;
	}
	.full h1 {
		margin: 0;
		font-size: 1.875rem;
	}
	.next {
		position: relative;
		padding-right: 40px;
	}
	.chev {
		position: absolute;
		right: 18px;
		top: 50%;
		transform: translateY(-50%);
		font-size: 1.375rem;
	}
	.struck {
		text-decoration: line-through;
	}
	.rows a {
		color: var(--text);
		text-decoration: none;
	}
	.checkin {
		gap: 12px;
	}
	.stack-s {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.share {
		display: flex;
		gap: 10px;
		align-items: center;
		font-size: 0.875rem;
		min-height: 44px;
	}
	.share input {
		width: 20px;
		height: 20px;
		accent-color: var(--plum);
	}
	.plum2 {
		color: var(--plum-2);
	}
	.attention {
		color: var(--text);
		text-decoration: none;
		font-size: 0.9375rem;
	}
</style>
