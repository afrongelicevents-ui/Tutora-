<script lang="ts">
	// Tutors tab: my tutors, to do from tutors, messages, connected tools.
	// "You don't have a tutor yet" only shows when the student has no tutors.
	import { m } from '#lib/i18n.ts';
	import { fmtDay, fmtTime, localDate, addDays } from '#lib/tz.ts';
	import { ago } from '#lib/ago.ts';
	import LineIcon from '#lib/components/LineIcon.svelte';
	import Face from '#lib/components/people/Face.svelte';
	import ToolLogo, { TOOL_NAME, type Tool } from '#lib/components/tools/ToolLogo.svelte';
	let { data } = $props();

	const today = $derived(localDate(new Date(data.today)));
	const tomorrow = $derived(localDate(addDays(new Date(data.today), 1)));
	function due(d: string | null) {
		if (!d) return { text: m.tt_no_date(), urgent: false };
		if (d < today) return { text: m.tt_overdue(), urgent: true };
		if (d === today) return { text: m.tt_due_today(), urgent: true };
		if (d === tomorrow) return { text: m.tt_due_tomorrow(), urgent: false };
		return { text: m.tt_due_on({ date: fmtDay(new Date(d + 'T12:00:00Z')) }), urgent: false };
	}
	const photo = (t: { slug: string | null; hasPhoto: boolean; photoVersion: number }) =>
		t.hasPhoto && t.slug ? `/t/${t.slug}/photo?v=${t.photoVersion}` : null;

	// short names on the small tiles (the full name is on the logo's alt text)
	const SHORT: Record<Tool, string> = {
		meet: 'Meet',
		teams: 'Teams',
		drive: 'Drive',
		kahoot: 'Kahoot!'
	};
	type Tile = { tool: Tool; state: 'connected' | 'ready' | 'connect'; href?: string };
	const tiles = $derived<Tile[]>([
		{ tool: 'meet', state: 'ready' },
		{ tool: 'teams', state: 'ready' },
		data.tools.drive
			? { tool: 'drive', state: 'connected' }
			: { tool: 'drive', state: 'connect', href: data.tools.driveConnectHref },
		data.tools.kahoot
			? { tool: 'kahoot', state: 'connected' }
			: { tool: 'kahoot', state: 'connect', href: '/student/tools#kahoot' }
	]);
</script>

<svelte:head><title>{m.tt_title()} · Tutora</title></svelte:head>

<div class="screen tt">
	<h1>{m.tt_title()}</h1>

	<!-- My tutors -->
	<section aria-labelledby="tt-my">
		<div class="sh">
			<h2 id="tt-my">{m.tt_my()}</h2>
			<a class="plus" href="/student/find" aria-label={m.tt_find()} title={m.tt_find()}
				><LineIcon name="plus" size={24} /></a
			>
		</div>
		{#if data.tutors.length}
			<ul class="list">
				{#each data.tutors as tu (tu.tutorId)}
					<li class="tcard">
						<Face name={tu.name} src={photo(tu)} size={64} />
						<div class="tbody">
							<div class="trow">
								<a class="tname stretch" href="/student/tutor/{tu.slug}">{tu.name}</a>
								{#if tu.unread}
									<a
										class="badge above"
										href="/student/messages/{tu.tutorId}"
										aria-label={m.tt_unread({ n: tu.unread, name: tu.name })}
										><LineIcon name="chat" size={16} /><span aria-hidden="true">{tu.unread}</span
										></a
									>
								{/if}
							</div>
							{#if tu.subjects.length}
								<p class="subs">{tu.subjects.join(' • ')}</p>
							{/if}
							<p class="next">
								<LineIcon name="calendar" size={18} />
								{#if tu.next}
									<a class="above" href="/student/lessons/{tu.next.id}"
										>{m.tt_next({
											when: `${fmtDay(new Date(tu.next.startsAt))} • ${fmtTime(new Date(tu.next.startsAt))}`
										})}</a
									>
								{:else}
									<span>{m.tt_no_next()}</span>
								{/if}
							</p>
						</div>
						<span class="chev"><LineIcon name="chevron" size={20} /></span>
					</li>
				{/each}
			</ul>
			<a class="another" href="/student/find">{m.tt_find_another()}</a>
		{/if}
	</section>

	<!-- To do from tutors -->
	{#if data.tutors.length || data.todoTotal}
		<section aria-labelledby="tt-todo">
			<div class="sh">
				<h2 id="tt-todo">{m.tt_todo()}</h2>
				{#if data.todoTotal}<a class="all" href="/student/homework"
						>{m.tt_view_all()} <LineIcon name="chevron" size={16} /></a
					>{/if}
			</div>
			{#if data.todo.length}
				<ul class="box">
					{#each data.todo as w (w.key)}
						{@const d = due(w.dueOn)}
						<li>
							<a class="row" href={w.href}>
								<span class="ic"><LineIcon name="clipboard" size={30} /></span>
								<span class="rbody">
									<strong>{w.title}</strong>
									<span class="meta">
										<span
											>{[
												w.kind === 'quiz' ? m.tt_quiz() : '',
												w.tutorName ? m.tt_from({ name: w.tutorName }) : ''
											]
												.filter(Boolean)
												.join(' • ')}</span
										>
										<span class="pill" class:urgent={d.urgent}>{d.text}</span>
									</span>
								</span>
								<LineIcon name="chevron" size={20} />
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty-line">{m.tt_todo_none()}</p>
			{/if}
		</section>
	{/if}

	<!-- Messages -->
	{#if data.tutors.length || data.messages.length}
		<section aria-labelledby="tt-msg">
			<div class="sh">
				<h2 id="tt-msg">{m.tt_messages()}</h2>
				<a class="all" href="/student/messages"
					>{m.tt_view_all()} <LineIcon name="chevron" size={16} /></a
				>
			</div>
			{#if data.messages.length}
				<ul class="box">
					{#each data.messages as c (c.otherId)}
						<li>
							<a class="row" href="/student/messages/{c.otherId}">
								<Face name={c.otherName} src={photo(c)} size={48} />
								<span class="rbody">
									<strong>{c.otherName}</strong>
									<span class="snip">{c.lastFromMe ? m.tt_you({ text: c.last }) : c.last}</span>
								</span>
								<span class="when">
									{ago(new Date(c.lastAt))}
									{#if c.unread}<span class="dot"
											><span class="sr-only">{m.tt_unread({ n: c.unread, name: c.otherName })}</span
											></span
										>{/if}
								</span>
								<LineIcon name="chevron" size={20} />
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty-line">{m.tt_messages_none()}</p>
			{/if}
		</section>
	{/if}

	<!-- Connected tools -->
	<section aria-labelledby="tt-tools">
		<div class="sh">
			<h2 id="tt-tools">{m.tt_tools()}</h2>
			<a class="all" href="/student/tools"
				>{m.tt_view_all()} <LineIcon name="chevron" size={16} /></a
			>
		</div>
		<ul class="tiles">
			{#each tiles as tl (tl.tool)}
				<li class="tile">
					<ToolLogo tool={tl.tool} size={40} />
					<span class="tn">{SHORT[tl.tool]}</span>
					{#if tl.state === 'connected'}
						<span class="st on">{m.tt_connected()}</span>
					{:else if tl.state === 'ready'}
						<span class="st ready" title={m.tt_ready_hint()}>{m.tt_ready()}</span>
					{:else}
						<a
							class="st connect"
							href={tl.href}
							aria-label={`${m.tt_connect()} ${TOOL_NAME[tl.tool]}`}>{m.tt_connect()}</a
						>
					{/if}
				</li>
			{/each}
		</ul>
		<p class="hint">{m.tt_ready_hint()}</p>
	</section>

	<!-- only when there are no tutors -->
	{#if !data.tutors.length}
		<section class="emptycard">
			<LineIcon name="tutors" size={48} />
			<h2>{m.tt_empty_h()}</h2>
			<p>{m.tt_empty_p()}</p>
			<a class="btn navy" href="/student/find"><LineIcon name="search" size={20} /> {m.tt_find()}</a
			>
		</section>
	{/if}
</div>

<style>
	.tt {
		gap: 26px;
	}
	h1 {
		margin: 0;
		font-size: 2.5rem;
		color: var(--navy);
	}
	section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.sh {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.sh h2 {
		margin: 0;
		font-size: 1.5rem;
		color: var(--navy);
	}
	.plus {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--navy);
		color: #fff;
		display: grid;
		place-items: center;
		flex: none;
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
	.list,
	.box,
	.tiles {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.tcard {
		position: relative;
		display: flex;
		align-items: center;
		gap: 14px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 22px;
		padding: 14px;
		box-shadow: var(--shadow-soft);
	}
	.tbody {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.tname {
		font-weight: 700;
		font-size: 1.0625rem;
		color: var(--navy);
		text-decoration: none;
	}
	/* the whole card opens the tutor; inner links sit above */
	.stretch::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 22px;
	}
	.above {
		position: relative;
		z-index: 1;
	}
	.subs {
		margin: 0;
		color: var(--muted);
		font-size: 0.9375rem;
	}
	.next {
		margin: 2px 0 0;
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.875rem;
		color: var(--text);
	}
	.next a {
		color: var(--text);
		text-decoration: none;
	}
	.trow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.chev {
		color: var(--navy);
		flex: none;
	}
	.next :global(svg),
	.row :global(svg) {
		flex: none;
	}
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: var(--navy);
		color: #fff;
		border-radius: 99px;
		padding: 6px 12px;
		font-weight: 700;
		text-decoration: none;
		min-height: 32px;
	}
	.another {
		align-self: flex-start;
		color: var(--ocean);
		font-weight: 600;
		padding: 4px 0;
	}
	.box {
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 22px;
		box-shadow: var(--shadow-soft);
		overflow: hidden;
	}
	.box li + li {
		border-top: 1px solid var(--border);
		margin: 0 14px;
	}
	.box li + li .row {
		padding-left: 0;
		padding-right: 0;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px;
		color: var(--navy);
		text-decoration: none;
		min-height: 64px;
	}
	.ic {
		width: 52px;
		display: grid;
		place-items: center;
		color: var(--navy);
		flex: none;
	}
	.rbody {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.rbody strong {
		color: var(--navy);
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		color: var(--muted);
		font-size: 0.875rem;
	}
	.pill {
		border-radius: 99px;
		padding: 2px 10px;
		background: var(--ice);
		color: var(--navy);
		font-weight: 600;
	}
	.pill.urgent {
		background: #fde4e4;
		color: #a61b1b;
	}
	.snip {
		color: var(--muted);
		font-size: 0.875rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.when {
		display: flex;
		align-items: center;
		gap: 8px;
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
	.empty-line {
		margin: 0;
		color: var(--muted);
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 8px;
	}
	.tile {
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 18px;
		padding: 12px 4px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		text-align: center;
		min-width: 0;
	}
	.tn {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--navy);
		line-height: 1.2;
	}
	.st {
		font-size: 0.75rem;
		font-weight: 700;
		border-radius: 99px;
		padding: 6px 8px;
		width: 100%;
		max-width: 92px;
		box-sizing: border-box;
	}
	.st.on {
		background: var(--navy);
		color: #fff;
	}
	.st.ready {
		background: var(--ice);
		color: var(--navy);
	}
	.st.connect {
		border: 1.5px solid var(--navy);
		color: var(--navy);
		text-decoration: none;
		min-height: 32px;
		display: grid;
		place-items: center;
	}
	.hint {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--muted);
	}
	.emptycard {
		align-items: center;
		text-align: center;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 22px;
		padding: 26px 18px;
		color: var(--navy);
		gap: 8px;
	}
	.emptycard h2 {
		margin: 0;
		font-size: 1.375rem;
	}
	.emptycard p {
		margin: 0 0 8px;
		color: var(--muted);
	}
	.btn.navy {
		background: var(--navy);
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
</style>
