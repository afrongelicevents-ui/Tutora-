<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay, fmtTime, localDate } from '#lib/tz.ts';
	import ChildSwitcher from '#lib/components/parent/ChildSwitcher.svelte';
	let { data, form } = $props();
	const name = $derived(data.kids.find((k) => k.id === data.current)?.name ?? '');
	const when = (d: Date) => {
		const today = localDate(new Date());
		const yest = localDate(new Date(Date.now() - 86_400_000));
		const day = localDate(d);
		return day === today ? fmtTime(d) : day === yest ? m.par3_yesterday() : fmtDay(d);
	};
	const text = (i: (typeof data.items)[number]) => {
		const x = i.text as Record<string, string | number>;
		switch (i.kind) {
			case 'study_started':
				return m.par3_u_started({ name, subject: String(x.subject), minutes: Number(x.minutes) });
			case 'study_done':
				return m.par3_u_done({ name, subject: String(x.subject), minutes: Number(x.minutes) });
			case 'check':
				return m.par3_u_check({
					name,
					topic: String(x.topic),
					score: Number(x.score),
					max: Number(x.max)
				});
			case 'result':
				return m.par3_u_result({
					title: String(x.title),
					score: Number(x.score),
					max: Number(x.max)
				});
			case 'homework_set':
				return x.due
					? m.par3_u_hw_due({
							title: String(x.title),
							day: fmtDay(new Date(String(x.due) + 'T12:00:00Z'))
						})
					: m.par3_u_hw({ title: String(x.title) });
			case 'homework_in':
				return m.par3_u_hw_in({ name, title: String(x.title) });
			case 'lesson':
				return Number(x.future)
					? m.par3_u_lesson_next({ subject: String(x.subject), tutor: String(x.tutor) })
					: m.par3_u_lesson_past({ subject: String(x.subject), tutor: String(x.tutor) });
			case 'checkin':
				return m.par3_u_checkin({ name, mood: t(`ci_${x.mood}`) });
		}
	};
	const strong = (k: string) => k === 'study_started' || k === 'checkin';
</script>

<svelte:head><title>{m.v3_nav_updates()} · Tutora</title></svelte:head>

<div class="screen wide-2">
	<div class="full stackish">
		<h1>{m.v3_nav_updates()}</h1>
		<ChildSwitcher kids={data.kids} current={data.current} base="/parent/updates" />
	</div>
	<div>
		{#if data.current}
			<a class="weekly rows-link" href="/parent/report?child={data.current}"
				><strong>{m.par3_weekly()}</strong>
				<span class="muted small">{m.par3_weekly_sub()}</span></a
			>
		{/if}
		<div class="rows">
			{#each data.items as i, k (k)}
				<div class="item">
					<span class="muted tiny">{when(i.at)}</span>
					<span class:bold={strong(i.kind)}>{text(i)}</span>
				</div>
			{:else}
				<p class="lead">{data.current ? m.par3_no_updates({ name }) : m.par_no_children()}</p>
			{/each}
		</div>
	</div>
	<section class="side">
		<div class="section-h"><h2>{m.par3_notify()}</h2></div>
		{#if form?.saved}<p class="notice" role="status">{m.sw3_saved()}</p>{/if}
		<form method="POST" action="?/prefs">
			<label class="toggle-row"
				><span>{m.par3_n_study()}</span><input
					type="checkbox"
					name="study"
					checked={data.prefs.study}
				/></label
			>
			<label class="toggle-row"
				><span>{m.par3_n_lessons()}</span><input
					type="checkbox"
					name="lessons"
					checked={data.prefs.lessons}
				/></label
			>
			<label class="toggle-row"
				><span>{m.par3_n_homework()}</span><input
					type="checkbox"
					name="homework"
					checked={data.prefs.homework}
				/></label
			>
			<label class="toggle-row"
				><span>{m.par3_n_weekly()}</span><input
					type="checkbox"
					name="weekly"
					checked={data.prefs.weekly}
				/></label
			>
			<button class="btn btn-ghost btn-sm" type="submit">{m.sw3_save()}</button>
		</form>
		<p class="note">{m.par3_n_note()}</p>
	</section>
</div>

<style>
	h1 {
		margin: 0;
		font-size: 1.875rem;
	}
	.stackish {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.item {
		flex-direction: column;
		align-items: flex-start !important;
		gap: 2px !important;
	}
	.tiny {
		font-size: 0.75rem;
	}
	.bold {
		font-weight: 600;
	}
	.weekly {
		display: block;
		padding: 14px 0;
		border-bottom: 1px solid var(--border);
		color: var(--text);
		text-decoration: none;
	}
</style>
