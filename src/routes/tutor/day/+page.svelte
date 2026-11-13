<script lang="ts">
	// My teaching day: lessons, reminders, the tutor's own tasks and breaks (tick them off),
	// and weekly personal goals. Same planner as students use, for the tutor.
	import { m, t } from '#lib/i18n.ts';
	import { fmtMinutes, fmtTime } from '#lib/tz.ts';
	import LineIcon from '#lib/components/LineIcon.svelte';
	import { KIND_ICON } from '#lib/components/schedule/kinds.ts';
	let { data, form } = $props();
	const ORDER = [1, 2, 3, 4, 5, 6, 0];
	const dayName = (d: number) =>
		new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(
			new Date(Date.UTC(2026, 10, 15 + d))
		);
	const name = (i: { kind: string; title: string | null; subject: string | null }) =>
		i.kind === 'task'
			? (i.title ?? '')
			: i.kind === 'study'
				? `${m.ps_k_study()} · ${i.subject}${i.title ? ` (${i.title})` : ''}`
				: (i.title ?? t(`ps_k_${i.kind}`));
	const pct = $derived(data.stats.pct ?? 0);
	const err = (where: string) =>
		form && 'error' in form && (form.where ?? '') === where ? t(form.error as string) : null;
</script>

<svelte:head><title>{m.td_title()} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/tutor/more">← {m.v3_nav_more()}</a>
	<h1>{m.td_title()}</h1>
	<p class="lead">{m.td_lead()}</p>

	<section class="softcard" aria-labelledby="td-lessons">
		<h2 id="td-lessons" class="h3">{m.td_lessons()}</h2>
		{#if data.lessons.length}
			<ul class="les">
				{#each data.lessons as l (l.id)}
					<li>
						<a href="/tutor/lessons/{l.id}"
							><strong>{fmtTime(l.startsAt)} – {fmtTime(l.endsAt)}</strong>
							{l.who.join(', ') || m.tut3_nobody()} · {l.subjectName ?? m.intro_chat()}</a
						>
					</li>
				{/each}
			</ul>
			<p class="small muted">{m.td_prep()}</p>
		{:else}
			<p class="muted">{m.today_no_lessons()}</p>
		{/if}
		<div class="rem">
			{#if data.toCheck}<a href="/tutor/homework">{m.td_mark({ n: data.toCheck })} →</a>{/if}
			{#if data.toConfirm}<a href="/tutor/payments">{m.td_confirm({ n: data.toConfirm })} →</a>{/if}
		</div>
	</section>
	{#if err('')}<p class="alert" role="alert">{err('')}</p>{/if}

	<!-- today -->
	<section class="softcard" aria-labelledby="pl-today">
		<div class="row-h">
			<h2 id="pl-today" class="h3">{m.td_tasks()}</h2>
			{#if data.stats.planned}<span class="small muted"
					>{m.pl_done_of({ done: data.stats.done, total: data.stats.planned })}</span
				>{/if}
		</div>
		{#if data.stats.planned}
			<div class="bar" role="img" aria-label="{pct}%"><span style="width:{pct}%"></span></div>
		{/if}
		{#if data.items.length}
			<ul class="items">
				{#each data.items as i (i.key)}
					<li class:done={i.done}>
						{#if i.tickable}
							<form method="POST" action="?/tick">
								<input type="hidden" name="key" value={i.key} />
								<input type="hidden" name="done" value={i.done ? '0' : '1'} />
								<button
									class="tick"
									class:on={i.done}
									type="submit"
									aria-pressed={i.done}
									aria-label={i.done
										? m.pl_untick({ name: name(i) })
										: m.pl_tick({ name: name(i) })}
									>{#if i.done}<LineIcon name="check" size={20} />{/if}</button
								>
							</form>
						{:else}
							<span class="tick off" aria-hidden="true"></span>
						{/if}
						<span class="ic k-{i.kind}"
							><LineIcon
								name={i.kind === 'task' ? 'clipboard' : KIND_ICON[i.kind]}
								size={20}
							/></span
						>
						<span class="body">
							<span class="what">{name(i)}</span>
							<span class="time"
								>{i.start === null
									? m.pl_any_time()
									: i.end === null
										? fmtMinutes(i.start)
										: `${fmtMinutes(i.start)} – ${fmtMinutes(i.end % 1440)}`}</span
							>
						</span>
						{#if i.kind === 'task' && i.id}
							<form method="POST" action="?/removeTask">
								<input type="hidden" name="id" value={i.id} />
								<button class="rm" type="submit" aria-label={m.pl_remove_task({ name: name(i) })}
									>×</button
								>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted">{m.td_empty()}</p>
		{/if}
		<a class="link" href="/tutor/calendar">{m.mo_view_schedule()} →</a>
	</section>

	<!-- add a task -->
	<form method="POST" action="?/addTask" class="card stack" id="tasks">
		<h2 class="h3">{m.pl_add_task()}</h2>
		{#if err('task')}<p class="alert" role="alert">{err('task')}</p>{/if}
		<div class="field">
			<label for="pl-title">{m.pl_task_title()}</label>
			<input id="pl-title" name="title" maxlength="60" required aria-describedby="pl-title-h" />
			<span class="hint" id="pl-title-h">{m.td_task_hint()}</span>
		</div>
		<div class="field">
			<label for="pl-time">{m.pl_task_time()}</label>
			<input id="pl-time" name="time" type="time" />
		</div>
		<fieldset class="field">
			<legend class="sr-only">{m.pl_repeat()}</legend>
			<label class="radio"
				><input type="radio" name="when" value="today" checked /> {m.pl_only_today()}</label
			>
			<label class="radio"><input type="radio" name="when" value="repeat" /> {m.pl_repeat()}</label>
			<div class="dchk">
				{#each ORDER as d (d)}
					<label
						><input type="checkbox" name="days" value={d} checked={d === data.weekday} />
						{dayName(d)}</label
					>
				{/each}
			</div>
		</fieldset>
		<button class="btn" type="submit">{m.pl_add()}</button>
	</form>

	<!-- weekly goals -->
	<section class="softcard" id="goals" aria-labelledby="pl-goals">
		<h2 id="pl-goals" class="h3">{m.pl_goals()}</h2>
		<p class="small muted">{m.pl_goals_lead()}</p>
		{#if data.goals.length}
			<ul class="goals">
				{#each data.goals as g (g.id)}
					<li>
						<div class="g-h">
							<strong>{g.title}</strong>
							<form method="POST" action="?/removeGoal">
								<input type="hidden" name="id" value={g.id} />
								<button class="rm" type="submit" aria-label={m.pl_goal_remove({ name: g.title })}
									>×</button
								>
							</form>
						</div>
						<div
							class="dots"
							role="img"
							aria-label={m.pl_goal_progress({ count: g.count, target: g.target })}
						>
							{#each Array.from({ length: g.target }) as _, k (k)}<span class:on={k < g.count}
								></span>{/each}
						</div>
						<span class="small" class:won={g.achieved}
							>{g.achieved
								? m.pl_goal_done()
								: m.pl_goal_progress({ count: g.count, target: g.target })}</span
						>
						<form method="POST" action="?/tickGoal">
							<input type="hidden" name="id" value={g.id} />
							<input type="hidden" name="done" value={g.today ? '0' : '1'} />
							<button class={g.today ? 'btn btn-secondary' : 'btn'} type="submit"
								>{g.today ? m.pl_goal_undo() : m.pl_goal_today()}</button
							>
						</form>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted">{m.pl_goals_none()}</p>
		{/if}
		<form method="POST" action="?/addGoal" class="stack goal-form">
			{#if err('goal')}<p class="alert" role="alert">{err('goal')}</p>{/if}
			<div class="field">
				<label for="pl-goal">{m.pl_goal_title()}</label>
				<input id="pl-goal" name="title" maxlength="60" required placeholder={m.pl_goal_hint()} />
			</div>
			<div class="field">
				<label for="pl-target">{m.pl_goal_days()}</label>
				<select id="pl-target" name="target">
					{#each [1, 2, 3, 4, 5, 6, 7] as n (n)}<option value={n} selected={n === 5}>{n}</option
						>{/each}
				</select>
			</div>
			<button class="btn btn-secondary" type="submit">{m.pl_goal_add()}</button>
		</form>
	</section>
</div>

<style>
	.les {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.les a {
		color: var(--navy);
		text-decoration: none;
	}
	.rem {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.rem a {
		color: var(--ocean);
		font-weight: 600;
		padding: 4px 0;
	}
	.back {
		align-self: flex-start;
		color: var(--ocean);
		font-weight: 600;
		text-decoration: none;
		padding: 8px 0;
	}
	.row-h {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
	}
	.bar {
		height: 10px;
		border-radius: 99px;
		background: #fff;
		overflow: hidden;
		border: 1px solid var(--border);
	}
	.bar span {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, var(--sky), var(--ocean));
	}
	.items {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.items li {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 0;
		border-bottom: 1px solid var(--border);
	}
	.tick {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: 2px solid var(--navy);
		background: #fff;
		color: #fff;
		display: grid;
		place-items: center;
		cursor: pointer;
		flex: none;
		padding: 0;
	}
	.tick.on {
		background: var(--navy);
	}
	.tick.off {
		border-style: dashed;
		border-color: var(--border-strong);
		display: inline-block;
	}
	.ic {
		color: var(--ocean);
		flex: none;
	}
	.ic.k-school {
		color: #e0a100;
	}
	.body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.what {
		font-weight: 600;
		color: var(--navy);
		overflow-wrap: anywhere;
	}
	li.done .what {
		color: var(--muted);
		text-decoration: line-through;
	}
	.time {
		font-size: 0.8125rem;
		color: var(--muted);
	}
	.rm {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		border: 1px solid var(--border);
		background: #fff;
		color: var(--muted);
		font-size: 1.125rem;
		cursor: pointer;
		flex: none;
	}
	.link {
		align-self: flex-start;
		color: var(--ocean);
		font-weight: 600;
		padding: 6px 0;
	}
	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.radio,
	.dchk label {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 40px;
	}
	.dchk {
		display: flex;
		flex-wrap: wrap;
		gap: 0 14px;
		padding-left: 24px;
	}
	.goals {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.goals li {
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 16px;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.g-h {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		color: var(--navy);
	}
	.dots {
		display: flex;
		gap: 6px;
	}
	.dots span {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		border: 2px solid var(--ocean);
	}
	.dots span.on {
		background: var(--ocean);
	}
	.won {
		color: var(--ok);
		font-weight: 700;
	}
	.goals form .btn {
		align-self: flex-start;
	}
	.goal-form {
		margin-top: 8px;
	}
</style>
