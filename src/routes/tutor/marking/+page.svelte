<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { fmtDayTime } from '#lib/tz.ts';
	let { data } = $props();
	const toMark = $derived(data.list.filter((a) => a.needsMarking));
	const done = $derived(data.list.filter((a) => !a.needsMarking));
</script>

<svelte:head><title>{m.qb_marking_title()} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/tutor/assessments" aria-label={m.st5_tutor_title()}>‹</a>
	<h1>{m.qb_marking_title()}</h1>
	<p class="lead">{m.qb_marking_lead()}</p>

	<section>
		<div class="section-h"><h2>{m.qb_to_mark()}</h2></div>
		{#if toMark.length}
			<ul class="rows">
				{#each toMark as a (a.id)}
					<li>
						<a class="grow" href="/tutor/marking/{a.id}"
							><strong>{a.name}</strong><span class="small muted block"
								>{a.title} · {a.submittedAt ? fmtDayTime(a.submittedAt) : ''}</span
							></a
						>
						{#if a.late}<span class="ui-pill warn">{m.qb_late()}</span>{/if}
						<a class="btn btn-sm" href="/tutor/marking/{a.id}">{m.qb_mark_now()}</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="note">{m.qb_nothing_to_mark()}</p>
		{/if}
	</section>

	<section>
		<div class="section-h"><h2>{m.qb_marked()}</h2></div>
		{#if done.length}
			<ul class="rows">
				{#each done as a (a.id)}
					<li>
						<a class="grow" href="/tutor/marking/{a.id}"
							><strong>{a.name}</strong><span class="small muted block"
								>{a.title} · {a.submittedAt ? fmtDayTime(a.submittedAt) : ''}{a.autoClosed
									? ` · ${m.qb_time_ran_out()}`
									: ''}</span
							></a
						>
						{#if a.late}<span class="ui-pill warn">{m.qb_late()}</span>{/if}
						<strong>{a.score}/{a.maxScore}</strong>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="note">{m.qb_none_marked()}</p>
		{/if}
	</section>
</div>

<style>
	.grow {
		flex: 1;
		min-width: 0;
		color: inherit;
		text-decoration: none;
	}
	.block {
		display: block;
	}
</style>
