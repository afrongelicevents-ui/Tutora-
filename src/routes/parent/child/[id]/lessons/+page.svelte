<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { fmtDay, fmtTime } from '#lib/tz.ts';
	let { data } = $props();
	const q = $derived(`child=${encodeURIComponent(data.childId)}`);
</script>

<svelte:head><title>{m.pfl_title({ name: data.firstName })} · Tutora</title></svelte:head>

<div class="screen ui-page">
	<a class="back" href="/parent/child/{data.childId}" aria-label={m.v3_back()}>←</a>
	<h1 class="ui-serif">{m.pfl_title({ name: data.firstName })}</h1>
	{#if !data.shared}
		<p class="muted">{m.pf_not_shared({ name: data.firstName })}</p>
	{:else}
		<section class="ui-card" aria-labelledby="up-h">
			<div class="ui-sec-h">
				<h2 id="up-h">{m.pfl_upcoming()}</h2>
				{#if data.guardian}<a href="/parent/book?{q}">{m.pf_book()} ›</a>{/if}
			</div>
			<ul class="rows-list" data-testid="all-upcoming">
				{#each data.upcoming as l (l.id)}
					<li>
						<span>{l.subjectName ?? m.intro_chat()}{l.tutorName ? ` · ${l.tutorName}` : ''}</span>
						<span class="small muted"
							>{fmtDay(l.startsAt)}
							{fmtTime(l.startsAt)}{#if data.guardian && l.tutorSlug}
								· <a href="/parent/payments?{q}&tutor={encodeURIComponent(l.tutorSlug)}"
									>{m.pay_tutor()}</a
								>{/if}</span
						>
					</li>
				{:else}
					<li class="muted">{m.pf_none_booked()}</li>
				{/each}
			</ul>
		</section>
		<section class="ui-card" aria-labelledby="past-h">
			<div class="ui-sec-h"><h2 id="past-h">{m.pfl_past()}</h2></div>
			<ul class="rows-list" data-testid="all-past">
				{#each data.past as l (l.id)}
					<li>
						<span
							>{l.subjectName ?? m.intro_chat()}{l.tutorName ? ` · ${l.tutorName}` : ''}
							<span class="small muted">{fmtDay(l.startsAt)} {fmtTime(l.startsAt)}</span></span
						>
						<span
							class="ui-pill {l.attendance === 'completed'
								? 'ok'
								: l.attendance === 'absent'
									? 'warn'
									: ''}"
							>{l.attendance === 'completed'
								? m.ml_happened()
								: l.attendance === 'absent'
									? m.ml_missed()
									: m.ml_not_marked()}</span
						>
					</li>
				{:else}
					<li class="muted">{m.pfl_none()}</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
