<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	let { data } = $props();
	const hwLabel = (s: string) =>
		s === 'done'
			? m.hws_done()
			: s === 'late'
				? m.hws_late()
				: s === 'missing'
					? m.hws_missing()
					: s === 'in'
						? m.handed_in_pill()
						: s === 'in_late'
							? m.hws_handed_late()
							: m.hws_waiting();
	const hwPill = (s: string) =>
		s === 'done' || s === 'in'
			? 'p-ok'
			: s === 'missing'
				? 'p-no'
				: s === 'waiting'
					? 'p-info'
					: 'p-wait';
</script>

<svelte:head><title>{m.pfh_title({ name: data.firstName })} · Tutora</title></svelte:head>

<div class="screen ui-page">
	<a class="back" href="/parent/child/{data.childId}" aria-label={m.v3_back()}>←</a>
	<h1 class="ui-serif">{m.pfh_title({ name: data.firstName })}</h1>
	<section class="ui-card" aria-label={m.pf_homework()}>
		{#if !data.shared}
			<p class="muted">{m.pf_not_shared({ name: data.firstName })}</p>
		{:else}
			<ul class="rows-list" data-testid="all-homework">
				{#each data.homework as h (h.id)}
					<li>
						<span
							>{h.title}<span class="small muted hw-due"
								>{h.dueOn
									? `${fmtDay(new Date(h.dueOn + 'T12:00:00Z'))}${h.dueTime ? ` · ${h.dueTime}` : ''}`
									: m.pf_no_due()}</span
							></span
						>
						<span class="pill {hwPill(h.status)}">{hwLabel(h.status)}</span>
					</li>
				{:else}
					<li class="muted">{m.pf_hw_none({ name: data.firstName })}</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<style>
	.hw-due {
		display: block;
	}
</style>
