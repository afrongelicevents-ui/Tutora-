<script lang="ts">
	// My students: stats, search, Add student, status filter, a card per student, insights.
	import { m } from '#lib/i18n.ts';
	import { formatMoney } from '#lib/money.ts';
	import { fmtDay } from '#lib/tz.ts';
	import LineIcon from '#lib/components/LineIcon.svelte';
	import Face from '#lib/components/people/Face.svelte';
	let { data } = $props();
	const href = (status: string) => {
		const p = new URLSearchParams();
		if (data.q) p.set('q', data.q);
		if (status) p.set('status', status);
		const s = p.toString();
		return s ? `?${s}` : '?';
	};
	const label = (s: string) =>
		s === 'active' ? m.st2_active() : s === 'inactive' ? m.st2_inactive() : m.st2_pending();
</script>

<svelte:head><title>{m.students_title()} · Tutora</title></svelte:head>

<section class="screen">
	<header>
		<h1>{m.st2_title()}</h1>
		<p class="lead">{m.st2_lead()}</p>
	</header>

	<div class="stats3">
		<div>
			<LineIcon name="tutors" size={28} /><strong>{data.total}</strong><span>{m.st2_total()}</span>
		</div>
		<div>
			<LineIcon name="calendar" size={28} /><strong>{data.stats.activeThisMonth}</strong><span
				>{m.st2_active_month()}</span
			>
		</div>
		<div>
			<LineIcon name="star" size={28} /><strong>{data.stats.rating ?? '–'}</strong><span
				>{m.st2_rating({ n: data.stats.reviews })}</span
			>
		</div>
	</div>

	<div class="tools">
		<form method="GET" class="search" role="search">
			<label class="sr-only" for="q">{m.search()}</label>
			<LineIcon name="search" size={20} />
			<input id="q" name="q" type="search" value={data.q} placeholder={m.st2_search()} />
			{#if data.status}<input type="hidden" name="status" value={data.status} />{/if}
		</form>
		<a class="btn navy add" href="/tutor/students/add"
			><LineIcon name="plus" size={20} /> {m.st2_add()}</a
		>
	</div>

	<nav class="filters" aria-label={m.st2_filter()}>
		<a href={href('')} aria-current={!data.status ? 'true' : undefined}
			><LineIcon name="tutors" size={18} /> {m.st2_all()} ({data.total})</a
		>
		<a href={href('active')} aria-current={data.status === 'active' ? 'true' : undefined}
			><span class="ring act"></span> {m.st2_active()} ({data.counts.active})</a
		>
		<a href={href('inactive')} aria-current={data.status === 'inactive' ? 'true' : undefined}
			><span class="ring"></span> {m.st2_inactive()} ({data.counts.inactive})</a
		>
		<a href={href('pending')} aria-current={data.status === 'pending' ? 'true' : undefined}
			><span class="ring pend"></span> {m.st2_pending()} ({data.counts.pending})</a
		>
	</nav>

	<ul class="cards">
		{#each data.students as s (s.id)}
			<li class="card">
				<Face name={s.name} size={64} />
				<div class="body">
					<div class="top">
						<a class="name" href="/tutor/students/{s.id}">{s.name}</a>
						<span class="badge {s.status}">{label(s.status)}</span>
					</div>
					{#if s.childName}<span class="small muted">{m.for_child({ name: s.childName })}</span
						>{/if}
					<span class="subs">{s.subjects.join(' • ') || s.level || ''}</span>
					<span class="last"
						><LineIcon name="calendar" size={16} />
						{s.nextLesson
							? m.st2_next({ when: fmtDay(new Date(s.nextLesson)) })
							: s.lastLesson
								? m.st2_last({ when: fmtDay(new Date(s.lastLesson)) })
								: m.st2_no_lessons()}</span
					>
					{#if s.owed > 0}<span class="owe small"
							>{m.owes({ amount: formatMoney(s.owed, data.currency) })}</span
						>{/if}
				</div>
				<div class="acts">
					{#if s.canMessage}
						<a
							class="round"
							href="/tutor/messages/{s.id}"
							aria-label={m.st2_message({ name: s.name })}><LineIcon name="chat" size={20} /></a
						>
					{/if}
					<a class="round" href="/tutor/students/{s.id}" aria-label={m.st2_open({ name: s.name })}
						><LineIcon name="more" size={20} /></a
					>
				</div>
			</li>
		{:else}
			<li class="note">{data.q || data.status ? m.no_match() : m.students_empty()}</li>
		{/each}
	</ul>

	{#if data.insights}
		<section class="ins" aria-labelledby="ins-h">
			<h2 id="ins-h"><LineIcon name="progress" size={22} /> {m.st2_insights()}</h2>
			<div class="ins3">
				<div>
					<strong>{data.insights.avgPct !== null ? `${data.insights.avgPct}%` : '–'}</strong><span
						>{m.st2_avg()}</span
					>
				</div>
				<div>
					<strong>{data.insights.onTrackPct !== null ? `${data.insights.onTrackPct}%` : '–'}</strong
					><span>{m.st2_on_track()}</span>
				</div>
				<div><strong>{data.insights.improving}</strong><span>{m.st2_improving()}</span></div>
			</div>
			<p class="small muted">{m.st2_insights_note()}</p>
		</section>
	{/if}
</section>

<style>
	header h1 {
		margin: 0;
	}
	header .lead {
		margin: 4px 0 0;
	}
	.stats3,
	.ins3 {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
	}
	.stats3 div {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 2px;
		padding: 14px 6px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 20px;
		box-shadow: var(--shadow-soft);
		color: var(--ocean);
	}
	.stats3 strong,
	.ins3 strong {
		font: 600 1.75rem var(--font-display);
		color: var(--navy);
		line-height: 1.1;
	}
	.stats3 span,
	.ins3 span {
		font-size: 0.8125rem;
		color: var(--text);
		line-height: 1.2;
	}
	.tools {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.search {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 8px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 99px;
		padding: 0 14px;
		color: var(--ocean);
	}
	.search input {
		flex: 1;
		min-width: 0;
		border: 0;
		background: transparent;
		min-height: 48px;
		font: inherit;
	}
	.btn.navy {
		background: var(--navy);
		border-color: var(--navy);
	}
	.add {
		min-height: 48px;
		padding: 0 16px;
		white-space: nowrap;
	}
	.filters {
		display: flex;
		gap: 6px;
		overflow-x: auto;
		padding-bottom: 2px;
	}
	.filters a {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		white-space: nowrap;
		padding: 8px 14px;
		border-radius: 99px;
		background: #fff;
		border: 1px solid var(--border);
		color: var(--navy);
		font-size: 0.875rem;
		font-weight: 600;
		text-decoration: none;
	}
	.filters a[aria-current='true'] {
		background: var(--navy);
		color: #fff;
		border-color: var(--navy);
	}
	.ring {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 2px solid var(--muted);
	}
	.ring.act {
		border-color: var(--ok);
	}
	.ring.pend {
		border-color: #d98a00;
	}
	.cards {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.card {
		display: flex;
		align-items: center;
		gap: 12px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 22px;
		padding: 14px;
		box-shadow: var(--shadow-soft);
	}
	.body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}
	.name {
		font: 600 1.125rem var(--font-display);
		color: var(--navy);
		text-decoration: none;
	}
	.badge {
		border-radius: 99px;
		padding: 3px 10px;
		font-size: 0.75rem;
		font-weight: 700;
		white-space: nowrap;
	}
	.badge.active {
		background: var(--ok-bg);
		color: var(--ok);
	}
	.badge.inactive {
		background: #eceff3;
		color: var(--muted);
	}
	.badge.pending {
		background: #fdf1dc;
		color: #8a5a00;
	}
	.subs {
		color: var(--text);
		font-size: 0.875rem;
	}
	.last {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--muted);
		font-size: 0.8125rem;
	}
	.owe {
		color: var(--warn);
		font-weight: 600;
	}
	.acts {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-left: 10px;
		border-left: 1px solid var(--border);
	}
	.round {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		border: 1px solid var(--border);
		display: grid;
		place-items: center;
		color: var(--navy);
	}
	.ins {
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 22px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.ins h2 {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 1.125rem;
		color: var(--navy);
	}
	.ins3 div {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}
	.ins3 div + div {
		border-left: 1px solid var(--border);
	}
	.ins p {
		margin: 0;
	}
</style>
