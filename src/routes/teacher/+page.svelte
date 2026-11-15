<script lang="ts">
	import Hero from '#lib/components/ui/Hero.svelte';
	import { m, t } from '#lib/i18n.ts';
	let { data } = $props();
</script>

<svelte:head><title>School+ · Tutora</title></svelte:head>

<div class="screen tskin ui-page tpage">
	<Hero dark title={m.spx_title()} lead={m.spx_lead()}>
		{#snippet badge()}<span class="ui-pill gold">School+</span>{/snippet}
	</Hero>
	<ul class="rows card">
		{#each data.items as p (p.id)}
			<li>
				<a class="row" href="/teacher/p/{p.id}"
					><span class="grow"
						><strong>{p.child} · {p.subject}</strong><span class="small muted block"
							>{p.tutor} · {p.school}</span
						></span
					><span class="pill p-info">{t(`sp3_status_${p.status}`)}</span></a
				>
			</li>
		{:else}
			<li class="empty">{m.spx_none()}</li>
		{/each}
	</ul>
</div>

<style>
	.tpage {
		max-width: 760px;
		margin-inline: auto;
	}
</style>
