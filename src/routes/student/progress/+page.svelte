<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { READY_PCT_CLIENT } from '#lib/progress-ui.ts';
	import SchoolWork from '#lib/components/progress/SchoolWork.svelte';
	let { data, form } = $props();
	const tone = (p: number) => (p >= READY_PCT_CLIENT ? '' : p >= 50 ? 'mid' : 'low');
	const change = $derived(
		data.overall.current && data.overall.previous
			? data.overall.current.pct - data.overall.previous.pct
			: null
	);
	const weeks = (d: number) => Math.max(1, Math.round(d / 7));
</script>

<svelte:head><title>{m.pg3_title()} · Tutora</title></svelte:head>

<div class="screen">
	<h1>{m.pg3_title()}</h1>
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if form?.saved}<p class="notice" role="status">{m.sw3_saved()}</p>{/if}

	{#if data.overall.current}
		<div class="overall">
			<span class="bignum">{data.overall.current.pct}%</span>
			{#if change !== null && data.overall.previous}
				<span class="small" class:up={change > 0} class:down={change < 0}
					>{change > 0
						? m.pg3_up({ from: data.overall.previous.pct })
						: change < 0
							? m.pg3_down({ from: data.overall.previous.pct })
							: m.pg3_same()}</span
				>
			{:else}
				<span class="small muted">{m.pg3_from_n({ n: data.overall.current.n })}</span>
			{/if}
		</div>
	{:else}
		<div class="softcard">
			<strong>{m.pg3_none()}</strong>
			<span class="small">{m.pg3_none_lead()}</span>
			<a class="btn btn-ghost" href="/student/check">{m.sh_check_link()}</a>
		</div>
	{/if}

	{#each data.topics.slice(0, 8) as tp (tp.subject + tp.topic)}
		<div class="topic">
			<div class="tl"><span>{tp.topic} <span class="muted small">· {tp.subject}</span></span><strong>{tp.pct}%</strong></div>
			<div class="meter {tone(tp.pct)}" role="img" aria-label="{tp.topic} {tp.pct}%"><span style="width:{tp.pct}%"></span></div>
		</div>
	{/each}

	{#if data.weak}
		<p class="advice">
			{data.weak.examDays !== null
				? m.pg3_weak_exam({ topic: data.weak.topic, weeks: weeks(data.weak.examDays) })
				: m.pg3_weak({ topic: data.weak.topic })}
			{data.weak.slots ? m.pg3_weak_plan({ n: data.weak.slots }) : m.pg3_weak_add()}
		</p>
	{/if}

	<SchoolWork school={data.school} editable />

	<div class="rows">
		{#each data.exams as e (e.id)}
			<div>
				<span>{m.pg3_exam({ title: e.title })}{e.daysLeft !== null ? ` · ${m.pg3_days({ n: e.daysLeft })}` : ''}</span>
				<strong>{e.total ? m.pg3_ready({ ready: e.ready, total: e.total }) : m.pg3_no_topics()}</strong>
			</div>
		{:else}
			<div><span>{m.pg3_exam_none()}</span><a href="/student/study">{m.pg3_add_exam()}</a></div>
		{/each}
		<div>
			<span>{m.pg3_sessions()}</span>
			<strong>{data.week.planned ? m.pg3_of({ done: data.week.done, planned: data.week.planned }) : data.week.done}</strong>
		</div>
	</div>

	{#if data.results.length}
		<section>
			<div class="section-h"><h2>{m.pg3_marked()}</h2></div>
			<div class="rows">
				{#each data.results as r (r.id)}
					<details>
						<summary
							><span>{r.title} · {r.topic}</span><strong>{r.score}/{r.maxScore}</strong></summary
						>
						<p class="small muted">{r.subject} · {r.takenOn} · {t(`pg3_src_${r.source}`)}</p>
						{#if r.feedback}<p class="prewrap small">{r.feedback}</p>{/if}
					</details>
				{/each}
			</div>
		</section>
	{/if}
</div>

<style>
	.overall {
		display: flex;
		align-items: baseline;
		gap: 10px;
		flex-wrap: wrap;
	}
	.up {
		color: var(--ok);
		font-weight: 600;
	}
	.down {
		color: var(--warn);
		font-weight: 600;
	}
	.topic {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.tl {
		display: flex;
		justify-content: space-between;
		font-size: 0.9375rem;
	}
	.advice {
		margin: 0;
		font-size: 0.9375rem;
		line-height: 1.6;
		padding-top: 12px;
		border-top: 1px solid var(--border);
	}
	details summary {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		cursor: pointer;
		list-style: none;
		width: 100%;
	}
	.rows > details {
		display: block;
	}
</style>
