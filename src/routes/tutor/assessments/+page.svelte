<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDate, fromLocal } from '#lib/tz.ts';
	import SetFields from './SetFields.svelte';
	let { data, form } = $props();
</script>

<svelte:head><title>{m.st5_tutor_title()} · Tutora</title></svelte:head>

<div class="screen">
	<h1>{m.st5_tutor_title()}</h1>
	<p class="lead">{m.st5_tutor_lead()}</p>
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}

	<section class="part">
		<div class="section-h"><h2>{m.st5_my_sets()}</h2></div>
		{#if data.sets.length}
			<ul class="rows">
				{#each data.sets as s (s.id)}
					<li>
						<a class="grow" href="/tutor/assessments/{s.id}"
							><strong>{s.title}</strong><span class="small muted block"
								>{s.kind === 'test' ? m.st5_kind_test() : m.st5_kind_quiz()} · {s.subject} · {s.topic}{s.level
									? ` · ${s.level}`
									: ''}</span
							></a
						>
						<span class="small muted"
							>{m.st5_n_questions({ n: s.questions })}{s.dailyChecks
								? ` · ${m.st5_in_daily()}`
								: ''}</span
						>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="note">{m.st5_sets_empty()}</p>
		{/if}
	</section>

	<details class="more" open={!data.sets.length || !!form?.error}>
		<summary>{m.st5_new_set()}</summary>
		<form method="POST" action="?/create" class="stack">
			<SetFields />
			<button class="btn" type="submit">{m.st5_create_set()}</button>
		</form>
	</details>

	<section class="part">
		<div class="section-h"><h2>{m.st5_recent_results()}</h2></div>
		{#if data.results.length}
			<ul class="rows">
				{#each data.results as r (r.id)}
					<li>
						<span class="grow"
							><strong>{r.name}</strong><span class="small muted block"
								>{r.source === 'daily_check' ? m.st5_daily_title() : r.title} · {r.topic} · {fmtDate(
									fromLocal(r.takenOn)
								)}</span
							></span
						>
						<strong>{r.score}/{r.maxScore}</strong>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="note">{m.st5_results_empty()}</p>
		{/if}
	</section>
</div>

<style>
	.part {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.grow {
		flex: 1;
		min-width: 0;
		color: inherit;
		text-decoration: none;
	}
	.block {
		display: block;
	}
	.more summary {
		cursor: pointer;
		font-weight: 600;
		color: var(--ocean);
		min-height: 44px;
		display: flex;
		align-items: center;
	}
</style>
