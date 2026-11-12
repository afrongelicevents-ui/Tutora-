<script lang="ts">
	// Tutors tab: my tutors, messages, what tutors can help with.
	// "You don't have a tutor yet" only shows when the student has no tutors.
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay, fmtTime } from '#lib/tz.ts';
	import { ago } from '#lib/ago.ts';
	import LineIcon from '#lib/components/LineIcon.svelte';
	import Face from '#lib/components/people/Face.svelte';
	import type { IconName } from '#lib/components/LineIcon.svelte';
	let { data } = $props();

	const photo = (t: { slug: string | null; hasPhoto: boolean; photoVersion: number }) =>
		t.hasPhoto && t.slug ? `/t/${t.slug}/photo?v=${t.photoVersion}` : null;

	// kinds of help tutors offer (each opens Find a tutor)
	const HELP: { key: string; icon: IconName }[] = [
		{ key: 'homework', icon: 'home' },
		{ key: 'exams', icon: 'trophy' },
		{ key: 'catchup', icon: 'book' },
		{ key: 'revision', icon: 'refresh' },
		{ key: 'skills', icon: 'school' },
		{ key: 'group', icon: 'tutors' }
	];
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

	<!-- What tutors can help with -->
	<section aria-labelledby="tt-help">
		<div class="sh"><h2 id="tt-help">{m.th_title()}</h2></div>
		<ul class="help">
			{#each HELP as h (h.key)}
				<li>
					<a href="/student/find"
						><LineIcon name={h.icon} size={30} /><span>{t(`th_${h.key}`)}</span></a
					>
				</li>
			{/each}
		</ul>
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
	.help {
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
	.help {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 8px;
	}
	.help a {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		text-align: center;
		min-height: 96px;
		padding: 10px 4px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 18px;
		color: var(--navy);
		text-decoration: none;
		font-size: 0.8125rem;
		font-weight: 600;
		line-height: 1.2;
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
