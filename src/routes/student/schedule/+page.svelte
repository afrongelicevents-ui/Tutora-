<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtMinutes } from '#lib/tz.ts';
	import LineIcon from '#lib/components/LineIcon.svelte';
	import { KIND_ICON, KINDS } from '#lib/components/schedule/kinds.ts';
	let { data, form } = $props();
	// Monday first; 0 = Sunday
	const ORDER = [1, 2, 3, 4, 5, 6, 0];
	const dayName = (d: number) =>
		new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(
			new Date(Date.UTC(2026, 10, 15 + d))
		);
	const title = (b: { kind: string; label: string | null; subject: string | null }) =>
		b.kind === 'study'
			? `${m.ps_k_study()} · ${b.subject}${b.label ? ` (${b.label})` : ''}`
			: (b.label ?? t(`ps_k_${b.kind}`));
</script>

<svelte:head><title>{m.ps_title()} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/student/me">← {m.me_title()}</a>
	<h1>{m.ps_title()}</h1>
	<p class="lead">{m.ps_lead()}</p>
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if form?.added}<p class="notice" role="status">{m.ps_added()}</p>{/if}

	<nav class="days" aria-label={m.ps_days()}>
		{#each ORDER as d (d)}
			<a href="?day={d}" aria-current={d === data.day ? 'page' : undefined}
				>{dayName(d)}{#if data.counts[d]}<span class="n">{data.counts[d]}</span>{/if}</a
			>
		{/each}
	</nav>

	<section class="softcard">
		{#if data.blocks.length}
			<ul class="blocks">
				{#each data.blocks as b (b.key)}
					<li class="k-{b.kind}">
						<span class="ic"><LineIcon name={KIND_ICON[b.kind]} size={22} /></span>
						<span class="time">{fmtMinutes(b.start)} – {fmtMinutes(b.end % 1440)}</span>
						<span class="what">{title(b)}</span>
						{#if b.id}
							<form method="POST" action="?/remove&day={data.day}">
								<input type="hidden" name="id" value={b.id} />
								<button class="rm" type="submit" aria-label={m.ps_remove_named({ name: title(b) })}
									>×</button
								>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted">{m.ps_empty_day()}</p>
		{/if}
		<p class="small muted">
			{m.ps_study_note()} <a href="/student/study">{m.ps_edit_study()} →</a>
		</p>
	</section>

	{#if data.tips.length}
		<section class="softcard tips" aria-labelledby="ps-tips">
			<strong id="ps-tips">{m.ps_tips()}</strong>
			<ul>
				{#each data.tips as tip, i (i)}
					<li>
						{t(tip.key, {
							a: tip.a ? (KINDS.includes(tip.a) ? t(`ps_k_${tip.a}`) : tip.a) : '',
							b: tip.b ? (KINDS.includes(tip.b) ? t(`ps_k_${tip.b}`) : tip.b) : ''
						})}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<form method="POST" action="?/add&day={data.day}" class="card stack">
		<h2 class="h3">{m.ps_add()}</h2>
		<div class="field">
			<label for="ps-kind">{m.ps_kind()}</label>
			<select id="ps-kind" name="kind" required>
				{#each KINDS.filter((k) => k !== 'study') as k (k)}
					<option value={k}>{t(`ps_k_${k}`)}</option>
				{/each}
			</select>
		</div>
		<div class="field">
			<label for="ps-label">{m.ps_label()}</label>
			<input id="ps-label" name="label" maxlength="40" aria-describedby="ps-label-h" />
			<span class="hint" id="ps-label-h">{m.ps_label_hint()}</span>
		</div>
		<div class="times">
			<div class="field">
				<label for="ps-start">{m.ps_from()}</label>
				<input id="ps-start" name="start" type="time" required value="08:00" />
			</div>
			<div class="field">
				<label for="ps-end">{m.ps_to()}</label>
				<input id="ps-end" name="end" type="time" required value="14:00" />
			</div>
		</div>
		<fieldset class="field">
			<legend>{m.ps_days()}</legend>
			<div class="dchk">
				{#each ORDER as d (d)}
					<label
						><input type="checkbox" name="days" value={d} checked={d === data.day} />
						{dayName(d)}</label
					>
				{/each}
			</div>
		</fieldset>
		<button class="btn" type="submit">{m.ps_save()}</button>
	</form>
</div>

<style>
	.back {
		align-self: flex-start;
		color: var(--ocean);
		font-weight: 600;
		text-decoration: none;
		padding: 8px 0;
	}
	.days {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 4px;
	}
	.days a {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 8px 0;
		border-radius: 12px;
		text-decoration: none;
		color: var(--navy);
		font-weight: 600;
		font-size: 0.8125rem;
		background: #fff;
		border: 1px solid var(--border);
	}
	.days a[aria-current='page'] {
		background: var(--navy);
		color: #fff;
		border-color: var(--navy);
	}
	.n {
		font-size: 0.6875rem;
		opacity: 0.75;
	}
	.blocks {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}
	.blocks li {
		display: grid;
		grid-template-columns: 34px 132px minmax(0, 1fr) auto;
		align-items: center;
		gap: 8px;
		padding: 10px 0;
		border-bottom: 1px solid var(--border);
	}
	.ic {
		color: var(--ocean);
		display: grid;
		place-items: center;
	}
	.k-school .ic {
		color: #e0a100;
	}
	.time {
		font-size: 0.875rem;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
	.what {
		font-weight: 600;
		color: var(--navy);
		overflow-wrap: anywhere;
	}
	.rm {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: 1px solid var(--border);
		background: #fff;
		color: var(--muted);
		font-size: 1.125rem;
		cursor: pointer;
	}
	.tips ul {
		margin: 0;
		padding-left: 18px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.times {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
	}
	.dchk {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 14px;
	}
	.dchk label {
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: 40px;
	}
</style>
