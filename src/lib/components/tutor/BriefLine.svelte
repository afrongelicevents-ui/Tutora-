<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	import type { Brief } from '#lib/server/brief.ts';
	import { moodLabel } from './mood.ts';

	let { brief }: { brief: Brief | null } = $props();

	const parts = $derived.by(() => {
		if (!brief || brief.empty) return [];
		const out: string[] = [];
		for (const w of brief.weak) out.push(m.tut3_brief_weak({ topic: w.topic, pct: w.pct }));
		if (brief.checkin) out.push(m.tut3_brief_said({ mood: moodLabel(brief.checkin.mood) }));
		const h = brief.homework;
		if (h.overdue) out.push(m.tut3_brief_hw_overdue({ n: h.overdue }));
		else if (h.nextDue)
			out.push(m.tut3_brief_hw_due({ date: fmtDay(new Date(h.nextDue + 'T12:00:00Z')) }));
		else if (h.open) out.push(m.tut3_brief_hw_open({ n: h.open }));
		if (brief.school) out.push(m.tut3_brief_school({ topic: brief.school.topic }));
		return out;
	});
</script>

<p class="brief">
	{#if parts.length}{m.tut3_brief_before({
			text: parts.join(', ')
		})}{:else}{m.tut3_brief_none()}{/if}
</p>

<style>
	.brief {
		margin: 0;
		font-size: 0.875rem;
		color: var(--muted);
		line-height: 1.45;
	}
</style>
