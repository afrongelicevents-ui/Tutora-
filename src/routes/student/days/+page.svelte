<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	import LineIcon from '#lib/components/LineIcon.svelte';
	let { data } = $props();
	const day = (d: string) => (d === data.today ? m.ds_today() : fmtDay(new Date(d + 'T12:00:00Z')));
	const mood = (x: string | null) => (x ? t(`ci_${x}`) : m.ds_none_mood());
</script>

<svelte:head><title>{m.ds_title()} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/student/progress#checkin">← {m.v3_nav_progress()}</a>
	<h1>{m.ds_title()}</h1>
	<p class="muted">{m.ds_lead()}</p>
	{#if data.days.length}
		<ol class="days">
			{#each data.days as d (d.date)}
				<li class="softcard">
					<strong class="dh">{day(d.date)}</strong>
					<p class="moods">
						<span><span class="lbl">{m.ds_start()}</span>{mood(d.startMood)}</span>
						<span aria-hidden="true">→</span>
						<span><span class="lbl">{m.ds_end()}</span>{mood(d.endMood)}</span>
					</p>
					<ul class="facts small">
						<li>
							<LineIcon name="check" size={18} />{d.sessions === 0
								? m.ds_sessions_none()
								: d.sessions === 1
									? m.ds_session_one()
									: m.ds_sessions({ n: d.sessions })}
						</li>
						{#if d.topics.length}<li>
								<LineIcon name="book" size={18} />{m.ds_topics({ list: d.topics.join(', ') })}
							</li>{/if}
						{#if d.streak}<li>
								<LineIcon name="flame" size={18} />{m.ds_streak({ n: d.streak })}
							</li>{/if}
					</ul>
					<p class="line">{t(d.line.key, { n: d.line.n ?? 0 })}</p>
				</li>
			{/each}
		</ol>
		{#if data.more}
			<a class="btn btn-secondary" href="?before={data.days.at(-1)?.date}">{m.ds_older()}</a>
		{/if}
	{:else}
		<p class="muted">{m.ds_empty()}</p>
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
	.days {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.dh {
		color: var(--navy);
		font-size: 1.0625rem;
	}
	.moods {
		margin: 0;
		display: flex;
		align-items: flex-end;
		gap: 10px;
		flex-wrap: wrap;
		font-weight: 600;
		color: var(--navy);
	}
	.moods > span:not([aria-hidden]) {
		display: flex;
		flex-direction: column;
	}
	.lbl {
		font-size: 0.75rem;
		color: var(--muted);
		font-weight: 600;
	}
	.facts {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
		color: var(--text);
	}
	.facts li {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.facts :global(svg) {
		color: var(--ocean);
		flex: none;
	}
	.line {
		margin: 0;
		color: var(--ocean);
		font-weight: 600;
	}
</style>
