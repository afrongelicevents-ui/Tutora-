<script lang="ts">
	// The figures of a stored report (lessons, homework, check-ins, tests), compact.
	import { m } from '#lib/i18n.ts';
	import type { ReportFigures } from '#lib/server/db/report.schema.ts';
	let { figures: f }: { figures: ReportFigures } = $props();
</script>

<dl class="rf">
	<div>
		<dt>{m.rp_lessons()}</dt>
		<dd>{m.rp_lessons_line({ attended: f.lessons.attended, missed: f.lessons.missed })}</dd>
	</div>
	<div>
		<dt>{m.rp_homework()}</dt>
		<dd>
			{m.rp_hw_line({
				done: f.homework.done,
				late: f.homework.late,
				missing: f.homework.missing,
				set: f.homework.set
			})}
		</dd>
	</div>
	<div>
		<dt>{m.rp_checkins()}</dt>
		<dd>{m.rp_checkin_line({ days: f.checkins.days })}</dd>
	</div>
	<div>
		<dt>{m.rp_tests()}</dt>
		<dd>
			{#if f.testAvg !== null}{m.rp_tests_line({
					avg: f.testAvg,
					n: f.tests.length
				})}{:else}{m.rp_no_tests()}{/if}
		</dd>
	</div>
</dl>
{#if f.tests.length}
	<ul class="chap">
		{#each f.tests.slice(0, 8) as c (c.subject + c.chapter)}
			<li><span>{c.subject} · {c.chapter}</span><strong>{c.pct}%</strong></li>
		{/each}
	</ul>
{/if}

<style>
	.rf {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
		margin: 0;
	}
	.rf div {
		background: var(--ice);
		border-radius: 12px;
		padding: 8px 10px;
	}
	dt {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	dd {
		margin: 2px 0 0;
		font-size: 0.875rem;
		color: var(--navy);
		font-weight: 600;
	}
	.chap {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 0.875rem;
	}
	.chap li {
		display: flex;
		justify-content: space-between;
		gap: 8px;
	}
</style>
