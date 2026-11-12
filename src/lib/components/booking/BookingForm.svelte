<script lang="ts">
	import { onMount } from 'svelte';
	import { m, t } from '#lib/i18n.ts';
	import { formatMoney } from '#lib/money.ts';
	import { fmtDate, fmtDayTime, fmtTime, fromLocal } from '#lib/tz.ts';

	interface Site {
		name: string | null;
		slug: string;
		lessonModes: 'online' | 'in_person' | 'both';
		lessonMinutes: number;
		currency: 'USD' | 'ZWG';
		subjects: { id: number; name: string; levels: string; priceCents: number | null }[];
	}
	let {
		site,
		intro,
		days,
		groups,
		preselect,
		error,
		back,
		forName = null
	}: {
		site: Site;
		intro: boolean;
		days: { date: string; slots: Date[] }[];
		groups: {
			id: number;
			subjectName: string | null;
			startsAt: Date;
			capacity: number;
			booked: number;
			mode: string;
		}[];
		preselect: number | null;
		error?: string | null;
		back: string;
		/** a parent booking for a younger child */
		forName?: string | null;
	} = $props();

	const modes = $derived(site.lessonModes === 'both' ? ['online', 'in_person'] : [site.lessonModes]);
	let js = $state(false);
	onMount(() => (js = true));
	let day = $state('');
	let slot = $state('');
	let subjectId = $state('');
	let mode = $state('');
	$effect.pre(() => {
		if (!day && days.length) day = days[0].date;
		if (!subjectId)
			subjectId = String(preselect ?? (site.subjects.length === 1 ? site.subjects[0].id : ''));
		if (!mode) mode = modes[0];
	});
	const subj = $derived(site.subjects.find((s) => String(s.id) === subjectId));
	const chosen = $derived(slot ? new Date(slot) : null);
	const minutes = $derived(intro ? 15 : site.lessonMinutes);
	const dayLabel = (iso: string) => {
		const d = fromLocal(iso, 720);
		return new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Harare', weekday: 'short', day: 'numeric' }).format(d);
	};
</script>

<a class="back" href={back} aria-label={m.v3_back()}>←</a>
<h1>{intro ? m.intro_title() : m.bk3_title({ name: site.name ?? '' })}</h1>
{#if forName}<p class="lead">{m.bk3_for({ name: forName })}</p>{/if}
{#if error}<p class="alert" role="alert">{t(error)}</p>{/if}

{#if !intro && !site.subjects.length}
	<p class="softcard">{m.book_not_ready()}</p>
{:else if !days.length && !groups.length}
	<p class="softcard">{m.book_no_times()}</p>
{:else}
	<form method="POST" class="stack" novalidate>
		<input type="hidden" name="kind" value={intro ? 'intro' : 'lesson'} />
		{#if !intro}
			{#if site.subjects.length > 1}
				<fieldset>
					<legend class="lbl">{m.book_subject()}</legend>
					<div class="chips">
						{#each site.subjects as s (s.id)}
							<label class="chip"
								><input type="radio" name="subjectId" value={s.id} bind:group={subjectId} />{s.name}</label
							>
						{/each}
					</div>
				</fieldset>
			{:else}
				<input type="hidden" name="subjectId" value={site.subjects[0].id} />
			{/if}
		{/if}
		{#if modes.length > 1}
			<fieldset>
				<legend class="lbl">{m.book_where()}</legend>
				<div class="chips">
					{#each modes as mo (mo)}
						<label class="chip"
							><input type="radio" name="mode" value={mo} bind:group={mode} />{mo === 'online'
								? m.mode_online()
								: m.mode_in_person()}</label
						>
					{/each}
				</div>
			</fieldset>
		{:else}
			<input type="hidden" name="mode" value={modes[0]} />
		{/if}

		{#if days.length}
			<fieldset>
				<legend class="lbl">{m.bk3_when()}</legend>
				{#if js}
					<div class="chips days">
						{#each days as d (d.date)}
							<button
								type="button"
								class="chip"
								aria-pressed={day === d.date}
								onclick={() => (day = d.date)}>{dayLabel(d.date)}</button
							>
						{/each}
					</div>
				{/if}
				{#each days as d (d.date)}
					<div class="day" hidden={js && day !== d.date}>
						<strong class="dayname">{fmtDate(fromLocal(d.date, 720))}</strong>
						<div class="times">
							{#each d.slots as s (s.getTime())}
								<label class="time"
									><input type="radio" name="slot" value={s.toISOString()} bind:group={slot} /><span
										>{fmtTime(s)}</span
									></label
								>
							{/each}
						</div>
					</div>
				{/each}
			</fieldset>
		{/if}
		{#if groups.length}
			<fieldset>
				<legend class="lbl">{m.or_join_group()}</legend>
				<div class="rows">
					{#each groups as g (g.id)}
						<label
							><span
								><input type="radio" name="join" value={g.id} />
								{g.subjectName} · {fmtDayTime(g.startsAt)}</span
							><span class="muted small">{m.places_left({ n: g.capacity - g.booked })}</span></label
						>
					{/each}
				</div>
			</fieldset>
		{/if}

		<div class="field">
			<label for="note" class="lbl">{m.book_note()}</label>
			<textarea id="note" name="note" maxlength="500" rows="2"></textarea>
		</div>

		<div class="summary">
			<span class="muted">{m.bk3_summary()}</span>
			<strong
				>{intro ? m.intro_title() : (subj?.name ?? m.book_subject())} · {m.tp3_minutes({ n: minutes })}</strong
			>
			<span
				>{chosen ? fmtDayTime(chosen) : m.bk3_pick_time()} · {mode === 'in_person'
					? m.mode_in_person()
					: m.bk3_online()}</span
			>
			{#if !intro}<span
					>{subj?.priceCents != null
						? m.bk3_price({ price: formatMoney(subj.priceCents, site.currency) })
						: m.ask_for_price()}</span
				>{/if}
		</div>
		<button class="btn btn-block big" type="submit">{m.send_request()}</button>
		<p class="note">{m.bk3_footer()}</p>
	</form>
{/if}

<style>
	h1 {
		margin: 0;
		font-size: 1.75rem;
	}
	fieldset {
		border: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.lbl {
		font-weight: 700;
		font-size: 0.9375rem;
		padding: 0;
		margin-bottom: 8px;
	}
	.days {
		flex-wrap: nowrap;
		overflow-x: auto;
		padding-bottom: 4px;
	}
	.days .chip {
		flex-shrink: 0;
	}
	.day {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 8px;
	}
	.dayname {
		font-size: 0.9375rem;
	}
	.times {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
	}
	.time {
		position: relative;
	}
	.time input {
		position: absolute;
		opacity: 0;
	}
	.time span {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 48px;
		border-radius: 14px;
		border: 1px solid var(--border-strong);
		background: #fff;
		font-size: 0.9375rem;
	}
	.time input:checked + span {
		background: var(--plum);
		border-color: var(--plum);
		color: var(--ivory);
		font-weight: 700;
	}
	.time input:focus-visible + span {
		box-shadow: var(--focus);
	}
	.summary {
		display: flex;
		flex-direction: column;
		gap: 6px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 18px;
		padding: 16px;
		font-size: 0.9375rem;
	}
	.big {
		min-height: 54px;
	}
	.rows label {
		cursor: pointer;
	}
</style>
