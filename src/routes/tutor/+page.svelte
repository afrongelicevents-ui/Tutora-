<script lang="ts">
	import { shortName } from '#lib/names.ts';
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay, fmtDayTime, fmtTime, localDate, minutesToHHMM, local } from '#lib/tz.ts';
	import { waLink } from '#lib/whatsapp.ts';
	import BriefLine from '#lib/components/tutor/BriefLine.svelte';
	import { toolLabel } from '#lib/components/tutor/labels.ts';
	import LineIcon from '#lib/components/LineIcon.svelte';
	import { ago } from '#lib/ago.ts';
	let { data, form } = $props();
	const greeting = $derived(
		data.hour < 12 ? m.tt2_morning() : data.hour < 17 ? m.tt2_afternoon() : m.tt2_evening()
	);
	const initials = (n: string) =>
		n
			.replace(/^(Mr|Mrs|Ms|Miss|Dr)\.?\s+/i, '')
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0]!.toUpperCase())
			.join('');
	function untilText(start: Date | string, end: Date | string) {
		const ms = new Date(start).getTime() - Date.now();
		if (ms <= 0) return new Date(end).getTime() > Date.now() ? m.tt2_now() : '';
		const min = Math.round(ms / 60000);
		if (min < 60) return m.tt2_in_min({ n: min });
		if (min < 24 * 60) return m.tt2_in_hm({ h: Math.floor(min / 60), m: min % 60 });
		return fmtDay(new Date(start));
	}

	const first = (n: string) => shortName(n) || n;
	const accepted = $derived.by(() => {
		if (form?.done !== 'accepted' || !('student' in form)) return null;
		const f = form as { student?: string; family?: number; meeting?: string | null };
		const name = String(f.student || m.tut3_the_student());
		const fam = Number(f.family) > 0;
		const tool = f.meeting ? toolLabel(String(f.meeting)) : null;
		if (tool)
			return fam
				? m.tut3_accepted_link_family({ tool, name })
				: m.tut3_accepted_link_one({ tool, name });
		return fam ? m.tut3_accepted_family({ name }) : m.tut3_accepted_one({ name });
	});
	const doneText = $derived.by(() => {
		if (!form?.done || form.done === 'accepted') return null;
		if (form.done === 'submitted') return m.tdone_submitted();
		if (form.done === 'attendance') return m.tut3_done_attendance();
		return `${t(`done_${form.done}`)}${'receipt' in form && form.receipt ? ` ${form.receipt}` : ''}`;
	});
	const now = $derived(new Date(data.now));
</script>

<svelte:head><title>{m.today_title()} · Tutora</title></svelte:head>

<section class="screen">
	<header class="greet">
		<p class="g1">{greeting},</p>
		<h1>{first(data.name)}.</h1>
		<p class="g2">{m.tt2_lead()}</p>
	</header>

	<div class="stat2">
		<a class="statcard" href="/tutor/students">
			<LineIcon name="tutors" size={30} />
			<strong>{data.stats.students}</strong>
			<span>{m.tt2_my_students()} <LineIcon name="chevron" size={16} /></span>
		</a>
		<a class="statcard" href="/tutor/calendar?view=week">
			<LineIcon name="calendar" size={30} />
			<strong>{data.stats.week}</strong>
			<span>{m.tt2_lessons_week()} <LineIcon name="chevron" size={16} /></span>
		</a>
	</div>

	{#if data.next}
		{@const nx = data.next}
		<section class="nextcard" aria-labelledby="nx-h">
			<div class="nx-top">
				<h2 id="nx-h"><LineIcon name="calendar" size={22} /> {m.tt2_next()}</h2>
				<span class="when">{untilText(nx.startsAt, nx.endsAt)}</span>
			</div>
			<div class="nx-body">
				<span class="face" aria-hidden="true">{initials(nx.who[0] ?? '?')}</span>
				<div class="nx-who">
					<strong>{nx.who.length ? nx.who.map((n) => first(n)).join(', ') : m.tut3_nobody()}</strong
					>
					<span
						>{nx.subjectName ?? m.intro_chat()} · {fmtDay(nx.startsAt)} {fmtTime(nx.startsAt)}</span
					>
					<span class="mode"
						><LineIcon name={nx.mode === 'online' ? 'video' : 'home'} size={18} />
						{nx.mode === 'online' ? m.mode_online() : m.mode_in_person()}</span
					>
				</div>
			</div>
			{#if nx.mode === 'online' && nx.open}
				<a
					class="joinbtn"
					href={nx.joinUrl ?? `/room/${nx.id}`}
					target={nx.joinUrl ? '_blank' : undefined}
					rel={nx.joinUrl ? 'noopener noreferrer' : undefined}
					><LineIcon name="video" size={20} />
					{nx.joinUrl
						? m.tut3_join_on({ tool: toolLabel(nx.provider ?? 'meet') })
						: m.tt2_join()}</a
				>
			{:else}
				<a class="joinbtn" href="/tutor/lessons/{nx.id}">{m.tt2_open_lesson()}</a>
			{/if}
		</section>
	{/if}

	<section class="tcard" aria-labelledby="att-h">
		<div class="tc-h">
			<h2 id="att-h"><LineIcon name="bell" size={22} /> {m.tt2_attention()}</h2>
			<a href="/notifications">{m.tt_view_all()} <LineIcon name="chevron" size={16} /></a>
		</div>
		<div class="att3">
			<a href="#requests"
				><LineIcon name="calendar" size={26} /><strong>{data.requests.length}</strong><span
					>{m.tt2_requests()}</span
				></a
			>
			<a href="/tutor/homework"
				><LineIcon name="clipboard" size={26} /><strong>{data.toCheck}</strong><span
					>{m.tt2_homework()}</span
				></a
			>
		</div>
	</section>

	<section class="tcard" aria-labelledby="msg-h">
		<div class="tc-h">
			<h2 id="msg-h"><LineIcon name="chat" size={22} /> {m.tt2_messages()}</h2>
			<a href="/tutor/messages">{m.tt_view_all()} <LineIcon name="chevron" size={16} /></a>
		</div>
		{#if data.messages.length}
			<ul class="msgs">
				{#each data.messages as c (c.otherId)}
					<li>
						<a href="/tutor/messages/{c.otherId}">
							<span class="face sm" aria-hidden="true">{initials(c.otherName)}</span>
							<span class="mb"
								><strong>{c.otherName}</strong><span class="snip"
									>{c.lastFromMe ? m.tt_you({ text: c.last }) : c.last}</span
								></span
							>
							<span class="ago"
								>{ago(new Date(c.lastAt))}{#if c.unread}<span class="dot"
										><span class="sr-only">{m.tt_unread({ n: c.unread, name: c.otherName })}</span
										></span
									>{/if}</span
							>
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="note">{m.tt2_no_messages()}</p>
		{/if}
	</section>

	{#if accepted}<p class="ok-box" role="status">{accepted}</p>{/if}
	{#if doneText}<p class="notice" role="status">{doneText}</p>{/if}
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}

	{#if data.missing.length}
		<a class="softcard setup" href="/tutor/setup/1">
			<strong>{m.today_setup_title()}</strong>
			<span class="note">{m.today_setup_lead({ n: data.missing.length })}</span>
		</a>
	{/if}

	<div id="requests"></div>
	{#each data.requests as r (r.id)}
		<article class="request">
			<span class="eyebrow">{r.kind === 'intro' ? m.tut3_new_intro() : m.tut3_new_request()}</span>
			<strong class="who"
				>{r.studentName}{r.childName ? ` (${r.childName})` : ''} · {r.kind === 'intro'
					? m.intro_chat()
					: r.subjectName} · {fmtDayTime(r.startsAt)}</strong
			>
			<span class="note"
				>{r.mode === 'online' ? m.mode_online() : m.mode_in_person()}{r.joinLessonId
					? ` · ${m.joins_group()}`
					: ''}</span
			>
			<BriefLine brief={data.briefs[r.id] ?? null} />
			{#if r.note}<p class="quote small">“{r.note}”</p>{/if}
			<div class="two">
				<form method="POST" action="?/accept">
					<input type="hidden" name="id" value={r.id} />
					<button class="btn btn-block" type="submit">{m.accept()}</button>
				</form>
				<form method="POST" action="?/decline">
					<input type="hidden" name="id" value={r.id} />
					<button class="btn btn-ghost btn-block" type="submit">{m.decline()}</button>
				</form>
			</div>
			{#if !r.joinLessonId}
				<details class="more">
					<summary>{m.propose_other()}</summary>
					<form method="POST" action="?/propose" class="stack">
						<input type="hidden" name="id" value={r.id} />
						<div class="row">
							<div class="field grow">
								<label for="pd-{r.id}">{m.date()}</label><input
									id="pd-{r.id}"
									name="date"
									type="date"
									value={localDate(r.startsAt)}
									required
								/>
							</div>
							<div class="field grow">
								<label for="pt-{r.id}">{m.time()}</label><input
									id="pt-{r.id}"
									name="time"
									type="time"
									step="900"
									value={minutesToHHMM(local(r.startsAt).minutes)}
									required
								/>
							</div>
						</div>
						<div class="field">
							<label for="pm-{r.id}">{m.message_optional()}</label><input
								id="pm-{r.id}"
								name="message"
								type="text"
								maxlength="300"
							/>
						</div>
						<button class="btn btn-ghost btn-sm" type="submit">{m.send_suggestion()}</button>
					</form>
				</details>
			{/if}
		</article>
	{/each}

	<div class="section-h">
		<h2>{m.tt2_today_schedule()}</h2>
		<a href="/tutor/calendar">{m.tut3_see_schedule()}</a>
	</div>
	<ul class="rows">
		{#each data.lessons as l (l.id)}
			{@const ended = new Date(l.endsAt) < now}
			{@const started = new Date(l.startsAt) <= now}
			{@const open =
				new Date(l.startsAt).getTime() - data.openBeforeMin * 60_000 <= new Date(now).getTime()}
			<li class="lesson">
				<div class="line">
					<a class="what" href="/tutor/lessons/{l.id}"
						>{fmtTime(l.startsAt)} · {l.people.map((p) => first(p.name)).join(', ') ||
							m.tut3_nobody()} · {l.subjectName ?? m.intro_chat()}</a
					>
					{#if l.mode === 'online' && !ended && open}
						{#if l.meeting}
							<a class="next-t" href={l.meeting.joinUrl} target="_blank" rel="noopener noreferrer"
								>{m.tut3_join_on({ tool: toolLabel(l.meeting.provider) })}</a
							>
						{:else}
							<a class="next-t" href="/room/{l.id}">{m.tut3_join()}</a>
						{/if}
					{:else if !started}
						<span class="note">{m.tut3_later()}</span>
					{/if}
				</div>
				<span class="note"
					>{l.mode === 'online'
						? m.mode_online()
						: `${m.mode_in_person()}${l.address ? ` · ${l.address}` : ''}`}{l.people.length > 1
						? ` · ${m.group()}`
						: ''}{#if l.mode === 'online' && l.meeting && !ended && open}
						· <a href="/room/{l.id}">{m.tut3_room_fallback()}</a>{/if}</span
				>
				{#if started}
					{#each l.people.filter((p) => p.attendeeId) as p (p.userId)}
						<div class="att">
							<span class="note grow"
								>{first(p.name)}: {p.attendance === 'completed'
									? m.status_done()
									: p.attendance === 'absent'
										? m.att_absent()
										: m.att_not_marked()}</span
							>
							{#if p.attendance !== 'completed'}
								<form method="POST" action="?/attendance">
									<input type="hidden" name="attendeeId" value={p.attendeeId} />
									<input type="hidden" name="value" value="completed" />
									<button class="linkbtn" type="submit">{m.att_mark_done()}</button>
								</form>
							{/if}
							{#if p.attendance !== 'absent'}
								<form method="POST" action="?/attendance">
									<input type="hidden" name="attendeeId" value={p.attendeeId} />
									<input type="hidden" name="value" value="absent" />
									<button class="linkbtn" type="submit">{m.att_mark_absent()}</button>
								</form>
							{/if}
						</div>
					{/each}
				{:else}
					{#each l.people.filter((p) => p.phone) as p (p.userId)}
						<a
							class="note wa"
							target="_blank"
							rel="noopener noreferrer"
							href={waLink(
								p.phone!,
								m.wa_reminder_text({
									subject: l.subjectName ?? m.intro_chat(),
									time: fmtTime(l.startsAt)
								})
							)}>{m.wa_remind({ name: first(p.name) })}</a
						>
					{/each}
				{/if}
			</li>
		{:else}
			<li class="note">{m.today_no_lessons()}</li>
		{/each}
	</ul>

	{#if data.toCheck}
		<a class="rows-link line-link" href="/tutor/homework"
			><span>{m.today_hw_check({ n: data.toCheck })}</span><span class="go" aria-hidden="true"
				>›</span
			></a
		>
	{/if}

	{#if data.activity.length}
		<div class="section-h">
			<h2>{m.today_activity()}</h2>
			<a href="/notifications">{m.notif_title()}</a>
		</div>
		<ul class="rows">
			{#each data.activity as a (a.id)}<li>
					<span>{a.title}</span><span class="note">{fmtDay(new Date(a.createdAt))}</span>
				</li>{/each}
		</ul>
	{/if}
</section>

<style>
	.greet {
		display: flex;
		flex-direction: column;
	}
	.greet .g1 {
		margin: 0;
		font: 600 1.75rem var(--font-display);
		color: var(--navy);
	}
	.greet h1 {
		margin: 0;
		font-size: 2.75rem;
		line-height: 1.05;
		color: var(--navy);
	}
	.greet .g2 {
		margin: 6px 0 0;
		color: var(--text);
	}
	.stat2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.statcard {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 16px 10px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 22px;
		box-shadow: var(--shadow-soft);
		color: var(--ocean);
		text-decoration: none;
		text-align: center;
	}
	.statcard strong {
		font: 600 2rem var(--font-display);
		color: var(--navy);
	}
	.statcard span {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--navy);
		font-weight: 600;
	}
	.nextcard {
		background: linear-gradient(150deg, var(--navy), #163a6e);
		color: #fff;
		border-radius: 24px;
		padding: 18px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		box-shadow: 0 14px 30px rgb(11 37 69 / 0.25);
	}
	.nx-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
	}
	.nx-top h2 {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 1.375rem;
		color: #fff;
	}
	.when {
		border: 1px solid rgb(255 255 255 / 0.35);
		border-radius: 99px;
		padding: 4px 12px;
		font-size: 0.8125rem;
		font-weight: 600;
		white-space: nowrap;
	}
	.nx-body {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.face {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: #dcebfa;
		color: var(--navy);
		display: grid;
		place-items: center;
		font: 600 1.375rem var(--font-display);
		flex: none;
		box-shadow: 0 0 0 3px rgb(255 255 255 / 0.6);
	}
	.face.sm {
		width: 46px;
		height: 46px;
		font-size: 1rem;
		box-shadow: none;
	}
	.nx-who {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.nx-who strong {
		font: 600 1.25rem var(--font-display);
	}
	.nx-who span {
		color: #cfe0f5;
		font-size: 0.875rem;
	}
	.nx-who .mode {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: #fff;
	}
	.joinbtn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 52px;
		border-radius: 99px;
		background: #fff;
		color: var(--navy);
		font-weight: 700;
		text-decoration: none;
	}
	.tcard {
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 22px;
		padding: 16px;
		box-shadow: var(--shadow-soft);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.tc-h {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
	}
	.tc-h h2 {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 1.25rem;
		color: var(--navy);
	}
	.tc-h a {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--navy);
		font-weight: 600;
		text-decoration: none;
		font-size: 0.875rem;
	}
	.att3 {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.att3 a {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		text-align: center;
		color: var(--ocean);
		text-decoration: none;
		padding: 4px;
	}
	.att3 a + a {
		border-left: 1px solid var(--border);
	}
	.att3 strong {
		font: 600 1.5rem var(--font-display);
		color: var(--navy);
	}
	.att3 span {
		font-size: 0.8125rem;
		color: var(--text);
		line-height: 1.25;
	}
	.msgs {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.msgs a {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 6px 0;
		color: var(--navy);
		text-decoration: none;
	}
	.mb {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.snip {
		color: var(--muted);
		font-size: 0.875rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.ago {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--muted);
		font-size: 0.8125rem;
		white-space: nowrap;
	}
	.dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--ocean);
	}
	.ok-box {
		margin: 0;
		background: var(--ok-bg);
		color: #1f5a3a;
		border-radius: 18px;
		padding: 14px 16px;
		font-size: 0.9375rem;
	}
	.setup {
		text-decoration: none;
		color: var(--text);
	}
	.request {
		display: flex;
		flex-direction: column;
		gap: 8px;
		background: var(--white);
		border: 1.5px solid var(--navy);
		border-radius: 18px;
		padding: 16px;
	}
	.request .who {
		font-size: 1rem;
	}
	.request .quote {
		margin: 0;
	}
	.two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.more summary {
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--ocean);
		padding: 8px 0;
	}
	.rows > li.lesson {
		flex-direction: column;
		align-items: stretch;
		gap: 4px;
	}
	.line {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
	}
	.what {
		color: var(--text);
		text-decoration: none;
	}
	.what:hover {
		color: var(--navy);
	}
	.next-t,
	.wa {
		text-decoration: none;
	}
	.att {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 14px;
	}
	.linkbtn {
		background: none;
		border: none;
		padding: 10px 0;
		font: inherit;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--ocean);
		cursor: pointer;
	}
	.line-link {
		display: flex;
		justify-content: space-between;
		padding: 13px 0;
		border-top: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
		color: var(--text);
		text-decoration: none;
	}
</style>
