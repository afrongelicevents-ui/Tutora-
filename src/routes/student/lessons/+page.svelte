<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay, fmtDayTime, fmtTime, localDate } from '#lib/tz.ts';
	import { waLink } from '#lib/whatsapp.ts';
	import { page } from '$app/state';
	import LineIcon from '#lib/components/LineIcon.svelte';
	import ToolLogo from '#lib/components/tools/ToolLogo.svelte';
	import ToolTiles from '#lib/components/tools/ToolTiles.svelte';
	let { data, form } = $props();
	const next = $derived(data.upcoming[0] ?? null);
	const rest = $derived(data.upcoming.slice(1));
	const showAll = $derived(page.url.searchParams.get('all') === '1');
	function due(d: string | null) {
		if (!d) return null;
		if (d < data.today) return { text: m.lt_late(), urgent: false, late: true };
		if (d === data.today) return { text: m.tt_due_today(), urgent: true, late: false };
		return {
			text: m.tt_due_on({ date: fmtDay(new Date(d + 'T12:00:00Z')) }),
			urgent: false,
			late: false
		};
	}
	const isToday = (d: Date) => localDate(d) === localDate(data.now);
	const waOf = (slug: string | null) => data.tutors.find((x) => x.slug === slug)?.whatsapp ?? null;
	const status = (s: string) =>
		({
			requested: m.status_pending(),
			proposed: m.status_proposed(),
			declined: m.status_declined()
		})[s] ?? s;
</script>

<svelte:head><title>{m.ls3_title()} · Tutora</title></svelte:head>

<div class="screen">
	<h1>{m.ls3_title()}</h1>
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if form?.done}<p class="notice" role="status">{t(`sdone_${form.done}`)}</p>{/if}

	{#each data.requests as r (r.id)}
		<div class="card lesson" id="requests">
			<div class="top">
				<strong
					>{r.kind === 'intro' ? m.intro_chat() : r.subjectName}{r.tutorName
						? ` ${m.ls3_with({ name: r.tutorName })}`
						: ''}</strong
				>
				<span
					class="pill {r.status === 'declined'
						? 'p-no'
						: r.status === 'proposed'
							? 'p-info'
							: 'p-wait'}">{status(r.status)}</span
				>
			</div>
			<span class="muted small"
				>{fmtDayTime(r.startsAt)} · {r.mode === 'online'
					? m.find3_online()
					: m.sh_in_person()}</span
			>
			{#if r.tutorMessage}<p class="small quote">“{r.tutorMessage}”</p>{/if}
			{#if r.status === 'proposed' && r.proposedStartsAt}
				<p class="small">{m.tutor_suggests({ when: fmtDayTime(r.proposedStartsAt) })}</p>
				<div class="row">
					<form method="POST" action="?/respond">
						<input type="hidden" name="id" value={r.id} /><input
							type="hidden"
							name="answer"
							value="yes"
						/>
						<button class="btn btn-sm" type="submit">{m.accept_new_time()}</button>
					</form>
					<form method="POST" action="?/respond">
						<input type="hidden" name="id" value={r.id} /><input
							type="hidden"
							name="answer"
							value="no"
						/>
						<button class="btn btn-ghost btn-sm" type="submit">{m.no_thanks()}</button>
					</form>
				</div>
			{:else if r.status === 'requested'}
				<form method="POST" action="?/withdraw">
					<input type="hidden" name="id" value={r.id} />
					<button class="btn-link small" type="submit">{m.withdraw_request()}</button>
				</form>
			{:else}
				<a class="small" href="/student/find">{m.choose_another_time()}</a>
			{/if}
		</div>
	{/each}

	<!-- next lesson -->
	{#if next}
		<section aria-labelledby="lt-next">
			<h2 id="lt-next" class="sec">{m.lt_next()}</h2>
			<div class="nextcard">
				<div class="n-top">
					<span class="n-ic">
						{#if next.meeting}<ToolLogo tool={next.meeting} size={34} chip />{:else}<LineIcon
								name={next.mode === 'online' ? 'video' : 'calendar'}
								size={30}
							/>{/if}
					</span>
					<span class="n-body">
						<strong>{next.subjectName ?? m.intro_chat()}</strong>
						<span
							>{isToday(next.startsAt) ? m.sh_today() : fmtDay(next.startsAt)} • {fmtTime(
								next.startsAt
							)}{next.tutorName ? ` · ${next.tutorName}` : ''}</span
						>
					</span>
					<span class="mode">{next.mode === 'online' ? m.lt_online() : m.lt_in_person()}</span>
				</div>
				{#if next.mode === 'in_person'}
					<p class="addr">
						<LineIcon name="home" size={18} />{next.address ?? m.ld3_address_ask()}
					</p>
				{/if}
				{#if next.mode === 'online' && data.nextJoin && next.roomOpen}
					<a
						class="btn navy big"
						href={data.nextJoin.joinUrl}
						target="_blank"
						rel="noopener noreferrer"
						><LineIcon name="video" size={22} />
						{data.nextJoin.provider === 'meet' ? m.ld3_join_meet() : m.ld3_join_teams()}</a
					>
					<a class="small center" href="/room/{next.id}">{m.ld3_use_room()}</a>
				{:else if next.mode === 'online' && next.roomOpen}
					<a class="btn navy big" href="/room/{next.id}"
						><LineIcon name="video" size={22} /> {m.lt_join()}</a
					>
				{:else}
					<a class="btn navy big" href="/student/lessons/{next.id}">{m.lt_view()}</a>
					{#if next.mode === 'online'}<span class="small center muted">{m.lt_join_soon()}</span
						>{/if}
				{/if}
				{#if !next.canCancel}
					<span class="note"
						>{m.cancel_too_late({ hours: next.cancelHours })}{#if waOf(next.tutorSlug)}
							<a href={waLink(waOf(next.tutorSlug)!)} target="_blank" rel="noopener noreferrer"
								>WhatsApp</a
							>{/if}</span
					>
				{/if}
			</div>
		</section>
	{:else if !data.requests.length}
		<div class="empty-state">
			<p class="lead">{m.no_lessons_yet()}</p>
			<a class="btn navy" href="/student/find">{m.find_a_tutor()}</a>
		</div>
	{/if}

	<!-- upcoming lessons -->
	{#if rest.length}
		<section aria-labelledby="lt-up">
			<div class="sh">
				<h2 id="lt-up" class="sec">{m.lt_upcoming()}</h2>
				{#if rest.length > 3 && !showAll}<a class="all" href="?all=1#lt-up"
						>{m.tt_view_all()} <LineIcon name="chevron" size={16} /></a
					>{/if}
			</div>
			<ul class="box">
				{#each showAll ? rest : rest.slice(0, 3) as l (l.id)}
					<li>
						<a class="row" href="/student/lessons/{l.id}">
							<span class="ic"><LineIcon name="calendar" size={24} /></span>
							<span class="rbody"
								><strong>{l.subjectName ?? m.intro_chat()}</strong><span class="meta"
									>{isToday(l.startsAt) ? m.sh_today() : fmtDay(l.startsAt)} • {fmtTime(
										l.startsAt
									)}{l.tutorName ? ` · ${l.tutorName}` : ''}{l.mode === 'in_person' && l.address
										? ` · ${l.address}`
										: ''}</span
								></span
							>
							<span class="mode">{l.mode === 'online' ? m.lt_online() : m.lt_in_person()}</span>
							<LineIcon name="chevron" size={20} />
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- homework and tasks -->
	<section aria-labelledby="lt-hw">
		<div class="sh">
			<h2 id="lt-hw" class="sec">{m.lt_homework()}</h2>
			<a class="all" href="/student/homework"
				>{m.tt_view_all()} <LineIcon name="chevron" size={16} /></a
			>
		</div>
		{#if data.todo.length}
			<ul class="box">
				{#each data.todo as w (w.key)}
					{@const d = due(w.dueOn)}
					<li>
						<a class="row" href={w.href}>
							<span class="ic"><LineIcon name="doc" size={26} /></span>
							<span class="rbody"
								><strong>{w.title}</strong>{#if w.tutorName}<span class="meta"
										>{w.kind === 'quiz' ? `${m.tt_quiz()} · ` : ''}{m.tt_from({
											name: w.tutorName
										})}</span
									>{/if}</span
							>
							{#if d}<span class="pill-d" class:urgent={d.urgent} class:late={d.late}>{d.text}</span
								>{/if}
							<LineIcon name="chevron" size={20} />
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted">{m.lt_hw_none()}</p>
		{/if}
		{#if data.handedIn.length}
			<ul class="done-list">
				{#each data.handedIn as h (h.id)}
					<li>
						<LineIcon name="check" size={18} />{h.title}
						<span class="pill-d done">{m.lt_done()}</span>
					</li>
				{/each}
			</ul>
		{/if}
		<a class="btn btn-secondary" href="/student/homework">{m.lt_upload()}</a>
	</section>

	<!-- lesson materials -->
	<section aria-labelledby="lt-mat">
		<div class="sh">
			<h2 id="lt-mat" class="sec">{m.lt_materials()}</h2>
			<a class="all" href="/student/homework#resources"
				>{m.tt_view_all()} <LineIcon name="chevron" size={16} /></a
			>
		</div>
		{#if data.materials.length}
			<ul class="box">
				{#each data.materials as mt (mt.id)}
					<li>
						<a class="row" href="/student/lessons/{mt.lessonId}">
							<span class="ic"
								>{#if mt.kind === 'drive' || mt.kind === 'kahoot'}<ToolLogo
										tool={mt.kind}
										size={28}
									/>{:else}<LineIcon
										name={mt.kind === 'file' ? 'doc' : 'link'}
										size={24}
									/>{/if}</span
							>
							<span class="rbody"
								><strong>{mt.title}</strong><span class="meta"
									>{m.lt_shared({ date: fmtDay(new Date(mt.createdAt)) })}</span
								></span
							>
							<LineIcon name="chevron" size={20} />
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted">{m.lt_mat_none()}</p>
		{/if}
	</section>

	<ToolTiles tools={data.tools} />

	{#each data.packages as p (p.id)}
		<div class="rows top">
			<div>
				<span><strong>{p.name}</strong>{p.tutorName ? ` · ${p.tutorName}` : ''}</span>
				<span class="pill p-ok"
					>{m.left_of({ left: p.lessonsTotal - p.lessonsUsed, total: p.lessonsTotal })}</span
				>
			</div>
		</div>
	{/each}

	<p class="note">{m.ls3_how_note()}</p>

	{#if data.past.length}
		<section>
			<div class="section-h"><h2>{m.past_lessons()}</h2></div>
			<div class="rows">
				{#each data.past.slice(0, 12) as l (l.id)}
					<a href="/student/lessons/{l.id}"
						><span>{l.subjectName ?? m.intro_chat()}{l.tutorName ? ` · ${l.tutorName}` : ''}</span
						><span class="muted small"
							>{fmtDay(l.startsAt)} · {fmtTime(l.startsAt)} · {l.mode === 'online'
								? m.lt_online()
								: m.lt_in_person()}</span
						></a
					>
				{/each}
			</div>
		</section>
	{/if}

	{#if data.tutors.length}
		<section>
			<div class="section-h"><h2>{m.my_tutors()}</h2></div>
			<div class="rows">
				{#each data.tutors as tu (tu.slug)}
					<div>
						{#if tu.active}<a href="/student/tutor/{tu.slug}">{tu.name ?? m.tutor_word()}</a
							>{:else}<span
								>{tu.name ?? m.tutor_word()}
								<span class="small muted">({m.tutor_unavailable()})</span></span
							>{/if}
						{#if tu.reviewable}<a class="small" href="/student/review?tutor={tu.slug}"
								>{m.leave_review()}</a
							>{/if}
					</div>
				{/each}
			</div>
		</section>
	{/if}
	{#if data.favourites.length}
		<section>
			<div class="section-h"><h2>{m.fav_title()}</h2></div>
			<div class="rows">
				{#each data.favourites as f (f.slug)}<a href="/student/tutor/{f.slug}"
						><span>{f.name}</span><span class="go" aria-hidden="true">›</span></a
					>{/each}
			</div>
		</section>
	{/if}
</div>

<style>
	section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.sec {
		margin: 0;
		font-size: 1.375rem;
		color: var(--navy);
	}
	.sh {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.all {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--navy);
		font-weight: 600;
		text-decoration: none;
		padding: 8px 0;
	}
	.nextcard {
		display: flex;
		flex-direction: column;
		gap: 14px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 22px;
		padding: 16px;
		box-shadow: var(--shadow-soft);
	}
	.n-top {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.n-ic {
		width: 52px;
		height: 52px;
		border-radius: 14px;
		background: var(--ocean);
		color: #fff;
		display: grid;
		place-items: center;
		flex: none;
	}
	.n-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		color: var(--navy);
	}
	.n-body strong {
		font-size: 1.125rem;
	}
	.mode {
		flex: none;
		background: var(--ice);
		color: var(--navy);
		border-radius: 99px;
		padding: 4px 12px;
		font-size: 0.8125rem;
		font-weight: 700;
	}
	.addr {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--text);
	}
	.big {
		min-height: 56px;
		font-size: 1.0625rem;
	}
	.center {
		text-align: center;
	}
	.done-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.done-list li {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--muted);
	}
	.pill-d.done {
		background: var(--ice);
		color: var(--navy);
	}
	.btn.navy {
		background: var(--navy);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		align-self: center;
		min-width: 60%;
	}
	.box {
		list-style: none;
		margin: 0;
		padding: 0;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 20px;
		overflow: hidden;
	}
	.box li + li {
		border-top: 1px solid var(--border);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		color: var(--navy);
		text-decoration: none;
		min-height: 60px;
	}
	.ic {
		width: 36px;
		display: grid;
		place-items: center;
		color: var(--ocean);
		flex: none;
	}
	.rbody {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.meta {
		font-size: 0.8125rem;
		color: var(--muted);
	}
	.pill-d {
		flex: none;
		border-radius: 99px;
		padding: 4px 12px;
		font-size: 0.8125rem;
		font-weight: 700;
		background: var(--ice);
		color: var(--navy);
	}
	.pill-d.urgent {
		background: #fde4e4;
		color: #a61b1b;
	}
	.pill-d.late {
		background: #eceff3;
		color: var(--text);
	}
	.lesson {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.top {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		align-items: flex-start;
	}
	.top strong {
		font-size: 1rem;
	}
	.rows a {
		text-decoration: none;
	}
	.empty-state {
		display: flex;
		flex-direction: column;
		gap: 12px;
		align-items: flex-start;
	}
</style>
