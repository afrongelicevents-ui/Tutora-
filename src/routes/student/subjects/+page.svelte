<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import LineIcon, { subjectIcon } from '#lib/components/LineIcon.svelte';
	let { data } = $props();
	const href = (name: string) => `/student/subjects/${encodeURIComponent(name)}`;
</script>

<svelte:head><title>{m.subj_title()} · Tutora</title></svelte:head>

<div class="screen">
	<h1>{m.subj_title()}</h1>

	<section>
		<div class="section-h"><h2>{m.subj_mine()}</h2></div>
		{#if data.mine.length}
			<ul class="list">
				{#each data.mine as s (s)}
					<li>
						<a href={href(s)}
							><LineIcon name={subjectIcon(s)} /><span>{s}</span><span class="go" aria-hidden="true"
								>›</span
							></a
						>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted">{m.subj_mine_empty()}</p>
		{/if}
	</section>

	{#if data.explore.length}
		<section>
			<div class="section-h"><h2>{m.subj_explore()}</h2></div>
			<ul class="list">
				{#each data.explore as s (s)}
					<li>
						<a href={href(s)}
							><LineIcon name={subjectIcon(s)} /><span>{s}</span><span class="go" aria-hidden="true"
								>›</span
							></a
						>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<style>
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}
	.list li + li {
		border-top: 1px solid var(--border);
	}
	.list a {
		display: flex;
		align-items: center;
		gap: 14px;
		min-height: 56px;
		padding: 0 16px;
		color: var(--ocean);
		text-decoration: none;
	}
	.list a span:first-of-type {
		flex: 1;
		color: var(--text);
		font-weight: 600;
	}
	.go {
		color: var(--muted);
		font-size: 1.25rem;
	}
</style>
