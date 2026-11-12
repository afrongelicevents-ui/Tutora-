<script lang="ts">
	import { shortName } from '#lib/names.ts';
	import { m, t } from '#lib/i18n.ts';
	import {
		fmtDate,
		fmtMonth,
		fmtTime,
		fmtWeekday,
		fromLocal,
		localDate,
		fmtMinutes
	} from '#lib/tz.ts';
	import { toolLabel } from '#lib/components/tutor/labels.ts';
	let { data, form } = $props();

	type Item = {
		key: string;
		start: Date;
		time: string;
		title: string;
		sub: string;
		cls: 'on' | 'ip' | 'own' | 'pend' | 'blk';
		href?: string;
		joinHref?: string;
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
				joinHref: l.mode === 'online' && l.endsAt > now ? (l.joinUrl ?? `/room/${l.id}`) : undefined
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
		{#if it.joinHref}<a
				class="next-t"
				href={it.joinHref}
				target={it.joinHref.startsWith('http') ? '_blank' : undefined}
				rel="noopener noreferrer">{m.tut3_join()}</a
			>{/if}
		{#if it.id}
			<form method="POST" action="?/removeEvent">
				<input type="hidden" name="id" value={it.id} />
				<button class="linkbtn" type="submit">{m.remove()}</button>
			</form>
		{/if}
	</div>
{/snippet}

<section class="screen">
	<h1>{m.v3_nav_schedule()}</h1>
	<p class="avail">
		{availability ? m.tut3_available({ times: availability }) : m.tut3_no_times()}
		· <a href="/tutor/settings/times">{m.tut3_edit_availability()}</a>
	</p>

	<nav class="bar" aria-label={m.v3_nav_schedule()}>
		<div class="chips">
			<a
				class="chip"
				aria-current={data.view === 'day' ? 'true' : undefined}
				href={q(data.days[0], 'day')}>{m.cal_day()}</a
			>
			<a
				class="chip"
				aria-current={data.view === 'week' ? 'true' : undefined}
				href={q(data.days[0], 'week')}>{m.cal_week()}</a
			>
			<a
				class="chip"
				aria-current={data.view === 'month' ? 'true' : undefined}
				href={q(data.days[0], 'month')}>{m.cal_month()}</a
			>
		</div>
		<div class="step">
			<a class="chip" href={q(data.prev)} aria-label={m.previous()}>‹</a>
			<a class="chip" href={q(data.today)}>{m.cal_today()}</a>
			<a class="chip" href={q(data.next)} aria-label={m.next()}>›</a>
		</div>
	</nav>

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
	{:else}
		<h2 class="day-h">{fmtDate(fromLocal(data.days[0], 12 * 60))}</h2>
		{#each itemsOn(data.days[0]) as it (it.key)}
			{@render card(it)}
		{:else}
			<p class="note">{m.cal_nothing()}</p>
		{/each}
	{/if}

	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if form?.added}<p class="notice" role="status">{m.saved()}</p>{/if}

	<details class="fold">
		<summary>{m.cal_block_h()}</summary>
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
			<button class="btn btn-ghost btn-block" type="submit">{m.cal_block_add()}</button>
		</form>
	</details>

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
	.avail {
		margin: 0;
		font-size: 0.9375rem;
		color: var(--muted);
	}
	.avail a {
		color: var(--plum);
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
		border: 1px dashed #b9a3c0;
	}
	.ev-card.blk {
		background: var(--lilac);
		border-color: var(--lilac);
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
		color: var(--plum);
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
		color: var(--plum-2);
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
