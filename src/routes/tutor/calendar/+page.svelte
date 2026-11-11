<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDate, fmtTime, fmtWeekday, fromLocal, localDate } from '#lib/tz.ts';
	let { data, form } = $props();

	type Item = {
		key: string;
		start: Date;
		html: { time: string; text: string; cls: string; href?: string; id?: number };
	};
	function itemsOn(day: string): Item[] {
		const ls = data.lessons
			.filter((l) => localDate(l.startsAt) === day)
			.map((l) => ({
				key: 'l' + l.id,
				start: l.startsAt,
				html: {
					time: fmtTime(l.startsAt),
					text: `${l.subjectName ?? m.intro_chat()} · ${l.people.map((p) => p.name.split(' ')[0]).join(', ')}`,
					cls: l.mode === 'online' ? 'on' : 'ip',
					href: `/tutor/lessons/${l.id}`
				}
			}));
		const es = data.events
			.filter((e) => localDate(e.startsAt) === day)
			.map((e) => ({
				key: 'e' + e.id,
				start: e.startsAt,
				html: { time: fmtTime(e.startsAt), text: e.title, cls: 'own', id: e.id }
			}));
		return [...ls, ...es].sort((a, b) => a.start.getTime() - b.start.getTime());
	}
	const q = (date: string, view = data.view) => `?view=${view}&date=${date}`;
</script>

<svelte:head><title>{m.cal_title()} · Tutora</title></svelte:head>

<section class="wrap">
	<h1>{m.cal_title()}</h1>
	<div class="row cal-bar">
		<a
			class="tab"
			aria-current={data.view === 'day' ? 'true' : undefined}
			href={q(data.days[0], 'day')}>{m.cal_day()}</a
		>
		<a
			class="tab"
			aria-current={data.view === 'week' ? 'true' : undefined}
			href={q(data.days[0], 'week')}>{m.cal_week()}</a
		>
		<span class="grow"></span>
		<a class="btn btn-secondary btn-sm" href={q(data.prev)} aria-label={m.previous()}>‹</a>
		<a class="btn btn-secondary btn-sm" href={q(data.today)}>{m.cal_today()}</a>
		<a class="btn btn-secondary btn-sm" href={q(data.next)} aria-label={m.next()}>›</a>
	</div>
	<div class="legend">
		<span class="l1">{m.cal_online()}</span><span class="l2">{m.cal_in_person()}</span><span
			class="l3">{m.cal_own()}</span
		>
	</div>

	{#if data.view === 'week'}
		<div class="cal-week">
			{#each data.days as day (day)}
				{@const d = fromLocal(day, 12 * 60)}
				<a class="cal-day" class:today={day === data.today} href={q(day, 'day')}>
					<span class="d">{fmtWeekday(d)}<br />{Number(day.slice(8))}</span>
					{#each itemsOn(day) as it (it.key)}<span class="ev {it.html.cls}" title={it.html.text}
							><b>{it.html.time}</b><span class="ev-text">{it.html.text}</span></span
						>{/each}
				</a>
			{/each}
		</div>
	{:else}
		<h2 class="h3">{fmtDate(fromLocal(data.days[0], 12 * 60))}</h2>
		{#each itemsOn(data.days[0]) as it (it.key)}
			<div class="ev big {it.html.cls}">
				<b>{it.html.time}</b>
				{it.html.text}
				{#if it.html.href}<a href={it.html.href}>{m.details()}</a>{/if}
				{#if it.html.id}
					<form method="POST" action="?/removeEvent" class="inline">
						<input type="hidden" name="id" value={it.html.id} /><button
							class="btn-link"
							type="submit">{m.remove()}</button
						>
					</form>
				{/if}
			</div>
		{:else}
			<p class="empty">{m.cal_nothing()}</p>
		{/each}
	{/if}

	<form method="POST" action="?/addEvent" class="card stack" style="margin-top:16px" novalidate>
		<h2 class="h3">{m.cal_add_own()}</h2>
		{#if form?.error}<p class="alert">{t(form.error)}</p>{/if}
		{#if form?.added}<p class="notice" role="status">{m.saved()}</p>{/if}
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
</section>
