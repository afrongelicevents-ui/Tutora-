<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import Hero from '#lib/components/ui/Hero.svelte';
	import ProLocked from '#lib/components/pro/ProLocked.svelte';
	let { data } = $props();
	const behind = $derived(data.students.filter((s) => s.behind));
	const fine = $derived(data.students.filter((s) => !s.behind));
	const DAYS = $derived([
		m.day_sun(),
		m.day_mon(),
		m.day_tue(),
		m.day_wed(),
		m.day_thu(),
		m.day_fri(),
		m.day_sat()
	]);
	const why = (r: string) =>
		r === 'missed'
			? m.pro_ins_why_missed()
			: r === 'homework'
				? m.pro_ins_why_homework()
				: m.pro_ins_why_scores();
</script>

<svelte:head><title>{m.pro_f_insights()} · Tutora</title></svelte:head>

<section class="screen">
	<Hero title={m.pro_f_insights()} lead={m.pro_ins_lead()} />
	<div class="ui-page stack">
		{#if !data.pro}
			<ProLocked feature="insights" />
		{:else if !data.students.length}
			<p class="notice">{m.pro_ins_none()}</p>
		{:else}
			<section class="stack-s" aria-labelledby="ins-b">
				<h2 id="ins-b" class="ui-serif">{m.pro_ins_behind({ n: behind.length })}</h2>
				{#if !behind.length}<p class="small muted">{m.pro_ins_all_fine()}</p>{/if}
				{#each behind as s (s.id)}
					{@render card(s, true)}
				{/each}
			</section>
			{#if fine.length}
				<section class="stack-s" aria-labelledby="ins-f">
					<h2 id="ins-f" class="ui-serif">{m.pro_ins_on_track({ n: fine.length })}</h2>
					{#each fine as s (s.id)}
						{@render card(s, false)}
					{/each}
				</section>
			{/if}
		{/if}
	</div>
</section>

{#snippet card(s: (typeof data.students)[number], warn: boolean)}
	<article class="ui-card ins" class:warn>
		<div class="row">
			<a href="/tutor/students/{s.id}"><strong>{s.name}</strong></a>
			{#if warn}<span class="ui-pill warn">{m.pro_ins_flag()}</span>{/if}
		</div>
		{#if s.reasons.length}
			<p class="small">{s.reasons.map(why).join(' · ')}</p>
		{/if}
		<dl class="facts small">
			<div>
				<dt>{m.pro_ins_att()}</dt>
				<dd>
					{s.attendancePct === null
						? '–'
						: m.pro_ins_att_v({ pct: s.attendancePct, came: s.attended, missed: s.missed })}
				</dd>
			</div>
			<div>
				<dt>{m.pro_ins_hw()}</dt>
				<dd>
					{m.pro_ins_hw_v({ set: s.homeworkSet, missing: s.homeworkMissing, late: s.homeworkLate })}
				</dd>
			</div>
			<div>
				<dt>{m.pro_ins_scores()}</dt>
				<dd>
					{s.scoreNow === null
						? '–'
						: s.scoreBefore === null
							? `${s.scoreNow}%`
							: m.pro_ins_scores_v({ now: s.scoreNow, before: s.scoreBefore })}
				</dd>
			</div>
			{#if s.missedDay !== null}
				<div>
					<dt>{m.pro_ins_pattern()}</dt>
					<dd>{m.pro_ins_pattern_v({ day: DAYS[s.missedDay] })}</dd>
				</div>
			{/if}
		</dl>
	</article>
{/snippet}

<style>
	.ins .row {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		align-items: center;
	}
	.ins.warn {
		border-left: 4px solid #d98e04;
	}
	.facts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: 0.5rem;
		margin: 0.5rem 0 0;
	}
	.facts dt {
		opacity: 0.7;
	}
	.facts dd {
		margin: 0;
		font-weight: 600;
	}
</style>
