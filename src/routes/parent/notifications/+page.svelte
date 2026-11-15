<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay, fmtDayTime, fmtTime, localDate } from '#lib/tz.ts';
	import LineIcon, { type IconName } from '#lib/components/LineIcon.svelte';
	import Hero from '#lib/components/ui/Hero.svelte';
	import ChildSwitcher from '#lib/components/parent/ChildSwitcher.svelte';
	let { data } = $props();
	const name = $derived(data.kids.find((k) => k.id === data.current)?.name ?? '');
	const ICON: Record<string, [IconName, string]> = {
		booking: ['calendar', 'blue'],
		lesson: ['lessons', 'blue'],
		family_lesson: ['lessons', 'blue'],
		payment: ['wallet', 'green'],
		homework: ['pencil', 'amber'],
		study: ['clock', 'amber'],
		weekly: ['progress', 'green'],
		reminder: ['bell', 'blue'],
		message: ['chat', 'amber'],
		family: ['family', 'navy'],
		account: ['user', 'navy']
	};
	const icon = (k: string) => ICON[k] ?? ['bell', 'blue'];
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
</script>

<svelte:head><title>{m.notif_title()} · Tutora</title></svelte:head>

<div class="screen ui-page">
	<Hero title={m.notif_title()} lead={m.pf_notif_lead()} />

	<section aria-labelledby="n-h" class="stack-s">
		<h2 id="n-h" class="visually-hidden">{m.notif_title()}</h2>
		{#each data.list as n (n.id)}
			<article class="ui-card note-row" class:unread={n.unread}>
				<span class="ui-ico {icon(n.kind)[1]}"><LineIcon name={icon(n.kind)[0]} size={20} /></span>
				<div>
					<strong>{n.title}</strong>
					<p class="small">{n.body}</p>
					<span class="small muted"
						>{fmtDayTime(n.createdAt)}{#if n.link}
							· <a href={n.link}>{m.notif_open()}</a>{/if}</span
					>
				</div>
			</article>
		{:else}
			<div class="ui-card empty">
				<span class="ui-ico blue"><LineIcon name="bell" size={22} /></span>
				<p class="muted">{m.notif_none()}</p>
			</div>
		{/each}
		<a class="small" href="/parent/settings#notifications">{m.notif_settings()} ›</a>
	</section>

	{#if data.kids.length}
		<section class="ui-card" aria-labelledby="act-h">
			<div class="ui-sec-h"><h2 id="act-h">{m.pf_activity()}</h2></div>
			<ChildSwitcher kids={data.kids} current={data.current} base="/parent/notifications" />
			<ul class="act">
				{#each data.items as i, k (k)}
					<li>
						<span class="small muted">{when(i.at)}</span>
						<span>{text(i)}</span>
					</li>
				{:else}
					<li class="muted">{data.current ? m.par3_no_updates({ name }) : m.par_no_children()}</li>
				{/each}
			</ul>
			{#if data.current}<a
					class="ui-btn-soft"
					href="/parent/report?child={encodeURIComponent(data.current)}">{m.par3_weekly()} ›</a
				>{/if}
		</section>
	{/if}
</div>

<style>
	.stack-s {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
	.note-row {
		display: flex;
		gap: 12px;
		align-items: flex-start;
	}
	.note-row p {
		margin: 2px 0 4px;
	}
	.unread {
		border-left: 4px solid #d9a441;
	}
	.empty {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.empty p {
		margin: 0;
	}
	.act {
		list-style: none;
		margin: 10px 0;
		padding: 0;
	}
	.act li {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px 0;
		border-bottom: 1px solid var(--border);
	}
	.act li:last-child {
		border-bottom: none;
	}
	.ui-btn-soft {
		align-self: flex-start;
	}
	.ui-card {
		display: flex;
		flex-direction: column;
	}
	.note-row {
		flex-direction: row;
	}
</style>
