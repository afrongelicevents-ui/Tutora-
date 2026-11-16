<script lang="ts">
	import Head from '#lib/components/owner/Head.svelte';
	import LineIcon from '#lib/components/LineIcon.svelte';
	import { ownerArea } from '#lib/nav.ts';
	import { m } from '#lib/i18n.ts';
	let { data } = $props();
	const c = $derived(data.counts);
	const groups = ownerArea().groups!.filter((g) => g.title);
	// what waits behind a link (only real counts)
	const badge = $derived<Record<string, number>>({
		'/owner/tutors': c.tutorsPending,
		'/owner/bookings': c.bookingsWaiting,
		'/owner/payments': c.paymentsStale,
		'/owner/school-plus': c.schoolPlusWaiting,
		'/owner/reports': c.reviewsReported + c.supportOpen,
		'/owner/moderation': c.checksWaiting + c.buddyReports
	});
	const TONES = ['blue', 'green', 'amber', 'navy'] as const;
</script>

<svelte:head><title>{m.ow_nav_more()} · {m.ow_label()} · Tutora</title></svelte:head>

<div class="oa">
	<Head title={m.ow_more_title()} lead={m.ow_more_lead()} icon="more" tone="navy" />
	{#each groups as g, gi (g.title)}
		<section class="oa-sec" aria-label={g.title}>
			<h2>{g.title}</h2>
			<div class="oa-hub">
				{#each g.items as item (item.href)}
					<a href={item.href}
						><span class="ui-ico {TONES[gi % 4]}" aria-hidden="true"
							><LineIcon name={item.icon ?? 'more'} size={20} /></span
						><span class="grow">{item.label}</span>{#if badge[item.href]}<span class="badge"
								>{badge[item.href]}</span
							>{/if}</a
					>
				{/each}
			</div>
		</section>
	{/each}
	<form method="POST" action="/logout">
		<button class="ui-btn-soft" type="submit">{m.nav_logout()}</button>
	</form>
</div>
