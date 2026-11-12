<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDate, fromLocal } from '#lib/tz.ts';
	import ChildSwitcher from '#lib/components/parent/ChildSwitcher.svelte';
	let { data } = $props();
	const r = $derived(data.report);
</script>

<svelte:head><title>{m.par3_weekly()} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/parent" aria-label={m.v3_back()}>←</a>
	<h1>{m.par3_weekly()}</h1>
	<ChildSwitcher kids={data.kids} current={data.current} base="/parent/report" />
	{#if r}
		<p class="lead">
			{m.par3_week_of({ name: r.name, date: fmtDate(fromLocal(r.weekStart, 720)) })}
		</p>
		<div class="stat3">
			<div>
				<strong
					>{r.access.study
						? r.sessionsPlanned
							? `${r.sessionsDone}/${r.sessionsPlanned}`
							: r.sessionsDone
						: '—'}</strong
				><span>{m.par3_sessions()}</span>
			</div>
			<div>
				<strong>{r.access.study ? r.minutes : '—'}</strong><span>{m.par3_minutes_studied()}</span>
			</div>
			<div>
				<strong>{r.access.lessons ? r.lessons : '—'}</strong><span>{m.par3_lessons_had()}</span>
			</div>
		</div>
		{#if r.access.progress}
			<section>
				<div class="section-h"><h2>{m.par3_scores()}</h2></div>
				<div class="rows">
					{#each r.topics as tp (tp.topic)}<div>
							<span>{tp.topic}</span><strong>{tp.pct}%</strong>
						</div>{:else}<div><span class="muted">{m.par3_no_scores_week()}</span></div>{/each}
					<div><span>{m.par3_checks()}</span><strong>{r.checks}</strong></div>
				</div>
			</section>
		{/if}
		{#if r.access.homework}
			<div class="rows top">
				<div><span>{m.par3_hw_set()}</span><strong>{r.homeworkSet}</strong></div>
			</div>
		{/if}
		{#if r.checkins.length}
			<section>
				<div class="section-h"><h2>{m.par3_checkins_week()}</h2></div>
				<div class="chips">
					{#each r.checkins as c, i (i)}<span class="chip">{t(`ci_${c}`)}</span>{/each}
				</div>
			</section>
		{/if}
		<p class="note">{m.par3_report_note()}</p>
		<div class="row">
			{#if data.prev}<a class="btn btn-ghost btn-sm" href="?child={data.current}&week={data.prev}"
					>{m.par3_prev_week()}</a
				>{/if}
			{#if data.next}<a class="btn btn-ghost btn-sm" href="?child={data.current}&week={data.next}"
					>{m.par3_next_week()}</a
				>{/if}
		</div>
	{:else}
		<p class="lead">{m.par_no_children()}</p>
	{/if}
</div>
