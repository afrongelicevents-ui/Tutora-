<script lang="ts">
	import { shortName } from '#lib/names.ts';
	import { m, t } from '#lib/i18n.ts';
	import {
		fmtDate,
		fmtDay,
		fmtMonth,
		fmtTime,
		fmtWeekday,
		fromLocal,
		localDate,
		fmtMinutes
	} from '#lib/tz.ts';
	import { toolLabel } from '#lib/components/tutor/labels.ts';
	import LineIcon from '#lib/components/LineIcon.svelte';
	let { data, form } = $props();
	const fmtDuration = (min: number) =>
		min >= 60
			? `${Math.floor(min / 60)}h${min % 60 ? ` ${Math.round(min % 60)}m` : ''}`
			: `${Math.round(min)}m`;

	type Item = {
		key: string;
		start: Date;
		time: string;
		title: string;
		sub: string;
		cls: 'on' | 'ip' | 'own' | 'pend' | 'blk';
		href?: string;
		joinHref?: string;
		msgHref?: string;
		id?: number;
	};
	const first = (n: string) => shortName(n) || n;
	const now = new Date();

	function itemsOn(day: string): Item[] {
		const ls: Item[] = data.lessons
			.filter((l) => localDate(l.startsAt) === day)
			.map((l) => ({
				key: 'l' + l.id,
				start: l.startsAt,
				time: fmtTime(l.startsAt),
				title: `${l.people.map((p) => first(p.name)).join(', ') || m.tut3_nobody()} · ${l.subjectName ?? m.intro_chat()}`,
				sub:
					l.mode === 'online'
						? l.meeting
							? m.tut3_online_with({ tool: toolLabel(l.meeting) })
							: m.tut3_online_room()
						: `${m.mode_in_person()}${l.address ? ` · ${l.address}` : ''}`,
				cls: l.mode === 'online' ? 'on' : 'ip',
				href: `/tutor/lessons/${l.id}`,
				joinHref:
					l.mode === 'online' && l.endsAt > now ? (l.joinUrl ?? `/room/${l.id}`) : undefined,
				msgHref:
					l.people.length === 1 && l.endsAt > now
						? `/tutor/messages/${l.people[0].userId}`
						: undefined
			}));
		const dayStart = fromLocal(day, 0).getTime();
		const dayEnd = dayStart + 86_400_000;
		const es: Item[] = data.events
			.filter((e) =>
				e.kind === 'blocked'
					? e.startsAt.getTime() < dayEnd && e.endsAt.getTime() > dayStart
					: localDate(e.startsAt) === day
			)
			.map((e) => ({
				key: 'e' + e.id,
				start: e.startsAt,
				time: e.kind === 'blocked' ? m.cal_all_day() : fmtTime(e.startsAt),
				title: e.kind === 'blocked' ? m.cal_blocked({ title: e.title }) : e.title,
				sub: e.kind === 'blocked' ? m.cal_blocked_legend() : m.cal_own(),
				cls: e.kind === 'blocked' ? 'blk' : 'own',
				id: e.id
			}));
		const rs: Item[] = data.requests
			.filter((r) => localDate(r.startsAt) === day)
			.map((r) => ({
				key: 'r' + r.id,
				start: r.startsAt,
				time: fmtTime(r.startsAt),
				title: `${r.student} · ${r.subjectName ?? m.intro_chat()}`,
				sub: m.tut3_request_waiting(),
				cls: 'pend',
				href: '/tutor'
			}));
		return [...ls, ...es, ...rs].sort((a, b) => a.start.getTime() - b.start.getTime());
	}
	const q = (date: string, view = data.view) => `?view=${view}&date=${date}`;
	const dayNames = $derived([
		m.day_sun(),
		m.day_mon(),
		m.day_tue(),
		m.day_wed(),
		m.day_thu(),
		m.day_fri(),
		m.day_sat()
	]);
	// "Mon 4:00 PM–8:00 PM, Tue ..." from the weekly free times
	const availability = $derived(
		[...data.times]
			.sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7) || a.start - b.start)
			.map((x) => `${dayNames[x.weekday]} ${fmtMinutes(x.start)}–${fmtMinutes(x.end)}`)
			.join(', ')
	);
	const dayLabel = (day: string) =>
		day === data.today
			? m.cal_today()
			: `${fmtWeekday(fromLocal(day, 720))} ${Number(day.slice(8))}`;
	const weekHasItems = $derived(data.days.some((d) => itemsOn(d).length));
</script>

<svelte:head><title>{m.v3_nav_schedule()} · Tutora</title></svelte:head>

{#snippet card(it: Item)}
	<div class="ev-card {it.cls}">
		<div class="ev-main">
			{#if it.href}<a class="ev-title" href={it.href}>{it.time} · {it.title}</a>{:else}<strong
					class="ev-title">{it.time} · {it.title}</strong
				>{/if}
			<span class="note">{it.sub}</span>
		</div>
		{#if it.joinHref || it.msgHref}
			<div class="ev-acts">
				{#if it.joinHref}<a
						class="btn btn-sm navy"
						href={it.joinHref}
						target={it.joinHref.startsWith('http') ? '_blank' : undefined}
						rel="noopener noreferrer"><LineIcon name="video" size={18} /> {m.tt2_join()}</a
					>{/if}
				{#if it.msgHref}<a class="btn btn-sm btn-secondary" href={it.msgHref}
						><LineIcon name="chat" size={18} /> {m.msg_open()}</a
					>{/if}
			</div>
		{/if}
		{#if it.id}
			<form method="POST" action="?/removeEvent">
				<input type="hidden" name="id" value={it.id} />
				<button class="linkbtn" type="submit">{m.remove()}</button>
			</form>
		{/if}
	</div>
{/snippet}

{#snippet clashBox(
	clash: { id: number; startsAt: Date | string; subjectName: string | null; who: string }[],
	action: string,
	values: Record<string, string>
)}
	<div class="clash" role="alert">
		<strong>{m.sc2_clash_h({ n: clash.length })}</strong>
		<ul>
			{#each clash as c (c.id)}
				<li>
					<a href="/tutor/lessons/{c.id}"
						>{fmtDay(new Date(c.startsAt))}
						{fmtTime(new Date(c.startsAt))} · {c.who} · {c.subjectName ?? m.intro_chat()}</a
					>
				</li>
			{/each}
		</ul>
		<p class="small">{m.sc2_clash_lead()}</p>
		<form method="POST" action="?/{action}">
			{#each Object.entries(values ?? {}) as [k, v] (k)}{#if k !== 'confirm'}<input
						type="hidden"
						name={k}
						value={v}
					/>{/if}{/each}
			<input type="hidden" name="confirm" value="1" />
			<button class="btn btn-warn btn-block" type="submit">{m.sc2_clash_go()}</button>
		</form>
	</div>
{/snippet}

<section class="screen">
	<header class="sh-head">
		<h1>{m.sc2_title()}</h1>
		<p class="lead">{m.sc2_lead()}</p>
	</header>

	<nav class="views" aria-label={m.v3_nav_schedule()}>
		<a
			href={q(data.today, 'day')}
			aria-current={data.view === 'day' && data.days[0] === data.today ? 'true' : undefined}
			><LineIcon name="calendar" size={18} /> {m.cal_today()}</a
		>
		<a href={q(data.today, 'week')} aria-current={data.view === 'week' ? 'true' : undefined}
			><LineIcon name="calendar" size={18} /> {m.sc2_week()}</a
		>
		<a href={q(data.today, 'month')} aria-current={data.view === 'month' ? 'true' : undefined}
			><LineIcon name="calendar" size={18} /> {m.sc2_month()}</a
		>
		<a href="?view=all" aria-current={data.view === 'all' ? 'true' : undefined}
			><LineIcon name="more" size={18} /> {m.sc2_all()}</a
		>
	</nav>

	{#if data.view !== 'all'}
		<div class="step">
			<a class="chip" href={q(data.prev)} aria-label={m.previous()}>‹</a>
			<a class="chip" href={q(data.today)}>{m.cal_today()}</a>
			<a class="chip" href={q(data.next)} aria-label={m.next()}>›</a>
		</div>
	{/if}

	<p class="avail">
		{availability ? m.tut3_available({ times: availability }) : m.tut3_no_times()}
	</p>

	{#if data.view === 'month'}
		<h2 class="h3">{fmtMonth(fromLocal(data.days[0], 12 * 60))}</h2>
		<div class="legend">
			<span class="l1">{m.cal_online()}</span><span class="l2">{m.cal_in_person()}</span><span
				class="l3">{m.cal_own()}</span
			><span class="l4">{m.cal_pending_legend()}</span><span class="l5"
				>{m.cal_blocked_legend()}</span
			>
		</div>
		<div class="cal-month">
			{#each Array((fromLocal(data.days[0], 12 * 60).getUTCDay() + 6) % 7) as _, i (i)}<span
				></span>{/each}
			{#each data.days as day (day)}
				{@const items = itemsOn(day)}
				<a class="mday" class:today={day === data.today} href={q(day, 'day')}>
					<b>{Number(day.slice(8))}</b>
					{#if items.length}<span class="dots"
							>{#each items.slice(0, 4) as it (it.key)}<i class={it.cls}></i>{/each}</span
						>{/if}
				</a>
			{/each}
		</div>
	{:else if data.view === 'week'}
		{#each data.days as day (day)}
			{@const items = itemsOn(day)}
			{#if items.length}
				<a class="day-h" href={q(day, 'day')}>{dayLabel(day)}</a>
				{#each items as it (it.key)}{@render card(it)}{/each}
			{/if}
		{/each}
		{#if !weekHasItems}<p class="note">{m.tut3_week_empty()}</p>{/if}
	{:else if data.view === 'all'}
		<h2 class="h3">{m.sc2_upcoming()}</h2>
		{#each data.days.filter((d) => d >= data.today) as day (day)}
			{@const items = itemsOn(day)}
			{#if items.length}
				<a class="day-h" href={q(day, 'day')}>{dayLabel(day)}</a>
				{#each items as it (it.key)}{@render card(it)}{/each}
			{/if}
		{/each}
		<h2 class="h3">{m.sc2_completed()}</h2>
		{#each data.days.filter((d) => d < data.today).reverse() as day (day)}
			{@const items = itemsOn(day).filter((x) => x.cls === 'on' || x.cls === 'ip')}
			{#if items.length}
				<a class="day-h" href={q(day, 'day')}>{dayLabel(day)}</a>
				{#each items as it (it.key)}{@render card(it)}{/each}
			{/if}
		{/each}
	{:else}
		{@const dayLessons = data.lessons.filter((l) => localDate(l.startsAt) === data.days[0])}
		<div class="overview">
			<div class="datebox">
				<span>{fmtWeekday(fromLocal(data.days[0], 720))}</span>
				<strong>{Number(data.days[0].slice(8))}</strong>
				<span>{fmtMonth(fromLocal(data.days[0], 720)).split(' ')[0].slice(0, 3)}</span>
			</div>
			<div class="ov-body">
				<span class="ov-l"
					>{data.days[0] === data.today ? m.sc2_today_overview() : m.sc2_day_overview()}</span
				>
				<strong>{m.sc2_n_lessons({ n: dayLessons.length })}</strong>
				<span class="ov-t"
					><LineIcon name="clock" size={18} />
					{m.sc2_total({
						time: fmtDuration(
							dayLessons.reduce(
								(a, l) =>
									a + (new Date(l.endsAt).getTime() - new Date(l.startsAt).getTime()) / 60000,
								0
							)
						)
					})}</span
				>
			</div>
		</div>
		<h2 class="h3">
			{data.days[0] === data.today
				? m.sc2_todays_lessons()
				: fmtDate(fromLocal(data.days[0], 12 * 60))}
		</h2>
		{#each itemsOn(data.days[0]) as it (it.key)}
			{@render card(it)}
		{:else}
			<p class="note">{m.cal_nothing()}</p>
		{/each}
		{#if data.upcoming.length}
			<div class="section-h">
				<h2>{m.sc2_upcoming_schedule()}</h2>
				<a href="?view=all">{m.tt_view_all()}</a>
			</div>
			<ul class="up">
				{#each data.upcoming as u (u.id)}
					<li>
						<a href="/tutor/lessons/{u.id}">
							<span class="upic"><LineIcon name="calendar" size={24} /></span>
							<span class="upb"
								><strong
									>{fmtWeekday(new Date(u.startsAt))}, {Number(
										localDate(new Date(u.startsAt)).slice(8)
									)}
									{fmtMonth(new Date(u.startsAt)).split(' ')[0].slice(0, 3)} · {fmtTime(u.startsAt)} –
									{fmtTime(u.endsAt)}</strong
								><span
									>{u.who.join(', ') || m.tut3_nobody()} · {u.subjectName ?? m.intro_chat()}</span
								></span
							>
							<LineIcon name="chevron" size={20} />
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}

	<section class="manage" aria-labelledby="mg-h">
		<h2 id="mg-h">{m.sc2_manage()}</h2>
		<div class="tiles3">
			<a href="?view={data.view}&date={data.days[0]}&add=holiday#holiday"
				><LineIcon name="palm" size={30} /><strong>{m.sc2_holiday()}</strong><span
					>{m.sc2_holiday_sub()}</span
				></a
			>
			<a href="?view={data.view}&date={data.days[0]}&add=timeoff#timeoff"
				><LineIcon name="clock" size={30} /><strong>{m.sc2_timeoff()}</strong><span
					>{m.sc2_timeoff_sub()}</span
				></a
			>
			<a href="/tutor/settings/times"
				><LineIcon name="pencil" size={30} /><strong>{m.sc2_edit()}</strong><span
					>{m.sc2_edit_sub()}</span
				></a
			>
		</div>
	</section>

	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if form?.added}<p class="notice" role="status">{m.saved()}</p>{/if}

	<details class="fold" id="holiday" open={data.add === 'holiday' || form?.where === 'holiday'}>
		<summary>{m.cal_block_h()}</summary>
		{#if form?.where === 'holiday' && form?.clash}{@render clashBox(
				form.clash,
				'addBlock',
				form.values
			)}{/if}
		<form method="POST" action="?/addBlock" class="stack" novalidate>
			<p class="note">{m.cal_block_lead()}</p>
			<div class="row">
				<div class="field grow">
					<label for="bl-from">{m.cal_from()}</label><input
						id="bl-from"
						name="from"
						type="date"
						value={data.days[0]}
						required
					/>
				</div>
				<div class="field grow">
					<label for="bl-to">{m.cal_to()}</label><input
						id="bl-to"
						name="to"
						type="date"
						value={data.days[0]}
						required
					/>
				</div>
			</div>
			<div class="field">
				<label for="bl-title">{m.cal_why()}</label><input
					id="bl-title"
					name="title"
					maxlength="80"
					placeholder={m.cal_why_hint()}
				/>
			</div>
			<button class="btn btn-block" type="submit">{m.cal_block_add()}</button>
		</form>
	</details>

	<details class="fold" id="timeoff" open={data.add === 'timeoff' || form?.where === 'timeoff'}>
		<summary>{m.sc2_timeoff_h()}</summary>
		{#if form?.where === 'timeoff' && form?.clash}{@render clashBox(
				form.clash,
				'addTimeOff',
				form.values
			)}{/if}
		<form method="POST" action="?/addTimeOff" class="stack" novalidate>
			<p class="note">{m.sc2_timeoff_lead()}</p>
			<div class="field">
				<label for="to-date">{m.date()}</label><input
					id="to-date"
					name="date"
					type="date"
					value={data.days[0]}
					required
				/>
			</div>
			<div class="row">
				<div class="field grow">
					<label for="to-start">{m.cal_from()}</label><input
						id="to-start"
						name="start"
						type="time"
						step="900"
						value="13:00"
						required
					/>
				</div>
				<div class="field grow">
					<label for="to-end">{m.cal_to()}</label><input
						id="to-end"
						name="end"
						type="time"
						step="900"
						value="15:00"
						required
					/>
				</div>
			</div>
			<div class="field">
				<label for="to-title">{m.cal_why()}</label><input
					id="to-title"
					name="title"
					maxlength="80"
					placeholder={m.sc2_timeoff_hint()}
				/>
			</div>
			<button class="btn btn-block" type="submit">{m.sc2_timeoff_add()}</button>
		</form>
	</details>

	<p class="visible"><LineIcon name="eye" size={20} /> {m.sc2_visible()}</p>

	<details class="fold">
		<summary>{m.cal_add_own()}</summary>
		<form method="POST" action="?/addEvent" class="stack" novalidate>
			<div class="field">
				<label for="ev-title">{m.cal_what()}</label><input
					id="ev-title"
					name="title"
					type="text"
					maxlength="80"
					required
					placeholder={m.cal_what_hint()}
				/>
			</div>
			<div class="row">
				<div class="field grow">
					<label for="ev-date">{m.date()}</label><input
						id="ev-date"
						name="date"
						type="date"
						value={data.days[0]}
						required
					/>
				</div>
				<div class="field grow">
					<label for="ev-time">{m.time()}</label><input
						id="ev-time"
						name="time"
						type="time"
						step="900"
						value="09:00"
						required
					/>
				</div>
			</div>
			<div class="field">
				<label for="ev-len">{m.cal_how_long()}</label>
				<select id="ev-len" name="minutes"
					>{#each [30, 60, 90, 120, 180, 240, 480] as n (n)}<option value={n} selected={n === 60}
							>{m.minutes({ n })}</option
						>{/each}</select
				>
			</div>
			<button class="btn btn-block" type="submit">{m.cal_add()}</button>
		</form>
	</details>
</section>

<style>
	.sh-head h1 {
		margin: 0;
	}
	.sh-head .lead {
		margin: 4px 0 0;
	}
	.views {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 6px;
	}
	.views a {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 8px 4px;
		border-radius: 16px;
		background: #fff;
		border: 1px solid var(--border);
		color: var(--navy);
		font-size: 0.8125rem;
		font-weight: 600;
		text-decoration: none;
		text-align: center;
	}
	.views a[aria-current='true'] {
		background: var(--navy);
		border-color: var(--navy);
		color: #fff;
	}
	.overview {
		display: flex;
		gap: 16px;
		align-items: center;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 22px;
		padding: 14px;
		box-shadow: var(--shadow-soft);
	}
	.datebox {
		display: flex;
		flex-direction: column;
		align-items: center;
		background: var(--ice);
		border-radius: 16px;
		padding: 8px 14px;
		color: var(--navy);
		font-weight: 600;
	}
	.datebox strong {
		font: 600 2.25rem var(--font-display);
		line-height: 1;
	}
	.ov-body {
		display: flex;
		flex-direction: column;
		gap: 2px;
		color: var(--navy);
	}
	.ov-l {
		font: 600 1rem var(--font-display);
	}
	.ov-body strong {
		font: 600 1.75rem var(--font-display);
	}
	.ov-t {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--text);
	}
	.ev-acts {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.btn.navy {
		background: var(--navy);
		border-color: var(--navy);
	}
	.up {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.up a {
		display: flex;
		align-items: center;
		gap: 12px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 18px;
		padding: 12px;
		color: var(--navy);
		text-decoration: none;
	}
	.upic {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		background: var(--ice);
		display: grid;
		place-items: center;
		color: var(--ocean);
		flex: none;
	}
	.upb {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.upb span {
		color: var(--muted);
		font-size: 0.875rem;
	}
	.manage h2 {
		margin: 0 0 10px;
		font-size: 1.375rem;
		color: var(--navy);
	}
	.tiles3 {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
	}
	.tiles3 a {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		text-align: center;
		padding: 14px 6px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 18px;
		color: var(--ocean);
		text-decoration: none;
	}
	.tiles3 strong {
		color: var(--navy);
		font-size: 0.9375rem;
		line-height: 1.2;
	}
	.tiles3 span {
		color: var(--muted);
		font-size: 0.75rem;
		line-height: 1.25;
	}
	.visible {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		background: var(--ice);
		border-radius: 14px;
		padding: 10px 14px;
		color: var(--navy);
		font-size: 0.875rem;
	}
	.clash {
		border: 1.5px solid var(--warn);
		background: var(--warn-bg);
		border-radius: 14px;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 8px 0;
	}
	.clash ul {
		margin: 0;
		padding-left: 18px;
	}
	.clash p {
		margin: 0;
	}
	.avail {
		margin: 0;
		font-size: 0.9375rem;
		color: var(--muted);
	}
	.avail a {
		color: var(--navy);
		font-weight: 700;
	}
	.bar {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 8px;
	}
	.step {
		display: flex;
		gap: 6px;
	}
	.day-h {
		margin: 6px 0 0;
		font-family: var(--font);
		font-size: 0.9375rem;
		font-weight: 700;
		color: var(--text);
		text-decoration: none;
	}
	.ev-card {
		display: flex;
		align-items: center;
		gap: 12px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 18px;
		padding: 14px 16px;
	}
	.ev-card.pend {
		border: 1px dashed var(--border-strong);
	}
	.ev-card.blk {
		background: var(--ice);
		border-color: var(--ice);
	}
	.ev-card.own {
		border-style: solid;
		border-left: 4px solid var(--border-strong);
	}
	.ev-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.ev-title {
		font-weight: 700;
		color: var(--text);
		text-decoration: none;
	}
	a.ev-title:hover {
		color: var(--navy);
	}
	.next-t {
		text-decoration: none;
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
	.fold {
		border-top: 1px solid var(--border);
		padding-top: 4px;
	}
	.fold:last-child {
		border-bottom: 1px solid var(--border);
	}
	.fold summary {
		cursor: pointer;
		font-weight: 700;
		padding: 12px 0;
	}
	.fold form {
		padding-bottom: 14px;
	}
</style>
