<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { fmtDayTime } from '#lib/tz.ts';
	let { data } = $props();
	const tabs = ['', 'requested', 'proposed', 'accepted', 'declined', 'cancelled'];
	const label = (s: string) =>
		({
			'': m.find_any_status(),
			requested: m.status_pending(),
			proposed: m.status_proposed(),
			accepted: m.status_confirmed(),
			declined: m.status_declined(),
			cancelled: m.status_cancelled()
		})[s] ?? s;
</script>

<svelte:head><title>{m.on_bookings()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<h1>{m.on_bookings()}</h1>
	<nav class="tabs">
		{#each tabs as s (s)}<a href="?status={s}" aria-current={data.status === s ? 'true' : undefined}
				>{label(s)}</a
			>{/each}
	</nav>
	<ul class="list card">
		{#each data.bookings as b (b.id)}
			<li>
				<span
					><b>{b.studentName}</b> → {b.tutorName}<span class="small muted block"
						>{b.kind === 'intro' ? m.tag_intro() : m.email_lesson_word()} · {fmtDayTime(
							b.startsAt
						)}</span
					></span
				><span class="small">{label(b.status)}</span>
			</li>
		{:else}
			<li class="empty">{m.none_yet()}</li>
		{/each}
	</ul>
</section>
