<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { formatMoney } from '#lib/money.ts';
	import type { PublicSite } from '#lib/server/settings.ts';
	let { site }: { site: Omit<PublicSite, 'tutorId'> } = $props();
</script>

{#each site.subjects as s (s.id)}
	<a class="card subject" href="/student/book?tutor={site.slug}&subject={s.id}">
		<span
			><b>{s.name}</b>{#if s.levels}<span class="small muted block">{s.levels}</span>{/if}</span
		>
		<span class="price"
			>{s.priceCents != null
				? m.per_lesson({ price: formatMoney(s.priceCents, site.currency) })
				: m.ask_for_price()}</span
		>
	</a>
{/each}
