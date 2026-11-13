<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	import ChildSwitcher from '#lib/components/parent/ChildSwitcher.svelte';
	let { data } = $props();
</script>

<svelte:head><title>{m.pp_title()} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/parent?child={data.current ?? ''}">← {m.v3_nav_home()}</a>
	<h1>{m.pp_title()}{data.name ? ` · ${data.name}` : ''}</h1>
	<ChildSwitcher kids={data.kids} current={data.current} base="/parent/personal" />
	{#if !data.shared}
		<p class="muted">{m.pp_not_shared({ name: data.name })}</p>
	{:else}
		<p class="lead">{m.pp_lead({ name: data.name })}</p>
		<div class="stats softcard">
			<div>
				<strong>{data.week.followed}/{data.week.planned}</strong><span>{m.pp_followed()}</span>
			</div>
			<div><strong>{data.week.tasks}</strong><span>{m.pp_tasks()}</span></div>
			<div><strong>{data.goalsReached}</strong><span>{m.pp_goals()}</span></div>
		</div>
		{#if data.checkins.length}
			<section class="softcard">
				<strong>{m.pr_feelings()}</strong>
				<ul>
					{#each data.checkins as c (c.id)}
						<li>{fmtDay(new Date(c.createdAt))}: {t(`ci_${c.mood}`)}</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/if}
</div>

<style>
	.back {
		align-self: flex-start;
		color: var(--ocean);
		font-weight: 600;
		text-decoration: none;
		padding: 8px 0;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		text-align: center;
	}
	.stats div {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.stats strong {
		font-size: 1.5rem;
		color: var(--navy);
	}
	.stats span {
		font-size: 0.75rem;
		color: var(--muted);
	}
	ul {
		margin: 0;
		padding-left: 18px;
	}
</style>
