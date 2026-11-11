<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { formatMoney } from '#lib/money.ts';
	import { fmtDay, fmtDayTime, fmtTime, fromLocal } from '#lib/tz.ts';
	let { data, form } = $props();
	const site = $derived(data.site);
	const modes = $derived(
		site.lessonModes === 'both' ? ['online', 'in_person'] : [site.lessonModes]
	);
	const price = (c: number | null) =>
		c == null ? m.ask_for_price() : m.per_lesson({ price: formatMoney(c, site.currency) });
	let n = 0;
	const step = () => ++n;
</script>

<svelte:head><title>{data.intro ? m.intro_title() : m.book_lesson()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<h1>{data.intro ? m.intro_title() : m.book_lesson()}</h1>
	{#if data.site.name}<p class="muted">{m.with_tutor({ name: data.site.name })}</p>{/if}
	{#if form?.error}<p class="alert" role="alert">
			{t(form.error, { minutes: (form as { minutes?: number }).minutes ?? 60 })}
		</p>{/if}

	{#if !data.intro && !site.subjects.length}
		<p class="panel">{m.book_not_ready()}</p>
	{:else if !data.days.length && !data.groups.length}
		<p class="panel">{m.book_no_times()}</p>
		{#if site.whatsapp}<p>
				<a href="/t/{site.slug}" class="btn btn-secondary">{m.nav_home()}</a>
			</p>{/if}
	{:else}
		<form method="POST" class="stack" novalidate>
			<input type="hidden" name="kind" value={data.intro ? 'intro' : 'lesson'} />
			{#if !data.intro}
				<fieldset>
					<legend>{step()}. {m.book_subject()}</legend>
					{#each site.subjects as s (s.id)}
						<label class="big-choice">
							<input
								type="radio"
								name="subjectId"
								value={s.id}
								checked={data.subject === s.id || site.subjects.length === 1}
								required
							/>
							<span><b>{s.name}</b><small>{s.levels}</small></span>
							<span class="price">{price(s.priceCents)}</span>
						</label>
					{/each}
				</fieldset>
			{:else}
				<p class="muted">{m.intro_lead()}</p>
			{/if}

			{#if modes.length > 1}
				<fieldset>
					<legend>{step()}. {m.book_where()}</legend>
					<div class="choice">
						{#each modes as mo (mo)}<label
								><input type="radio" name="mode" value={mo} checked={mo === 'online'} />
								{mo === 'online' ? m.mode_online() : m.mode_in_person()}</label
							>{/each}
					</div>
				</fieldset>
			{:else}
				<input type="hidden" name="mode" value={modes[0]} />
			{/if}

			<fieldset>
				<legend>{step()}. {m.book_time({ minutes: data.intro ? 15 : site.lessonMinutes })}</legend>
				{#each data.days as d (d.date)}
					<p class="day-h">{fmtDay(fromLocal(d.date, 720))}</p>
					<div class="slots">
						{#each d.slots as s (s.getTime())}
							<label
								><input type="radio" name="slot" value={s.toISOString()} /><span>{fmtTime(s)}</span
								></label
							>
						{/each}
					</div>
				{/each}
				{#if data.groups.length}
					<p class="day-h">{m.or_join_group()}</p>
					{#each data.groups as g (g.id)}
						<label class="big-choice"
							><input type="radio" name="join" value={g.id} /><span
								><b>{g.subjectName} · {fmtDayTime(g.startsAt)}</b><small
									>{m.places_left({ n: g.capacity - g.booked })} · {g.mode === 'online'
										? m.mode_online()
										: m.mode_in_person()}</small
								></span
							></label
						>
					{/each}
				{/if}
			</fieldset>

			<div class="field">
				<label for="note">{step()}. {m.book_note()}</label>
				<textarea id="note" name="note" maxlength="500" rows="3"></textarea>
			</div>
			<button class="btn btn-block" type="submit">{m.send_request()}</button>
			<p class="small muted">{m.book_footer()}</p>
		</form>
	{/if}
</section>
