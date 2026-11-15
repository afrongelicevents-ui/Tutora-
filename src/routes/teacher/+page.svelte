<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	let { data } = $props();
</script>

<svelte:head><title>School+ · Tutora</title></svelte:head>

<div class="screen">
	<span class="eyebrow">School+</span>
	<h1>{m.spx_title()}</h1>
	<p class="lead">{m.spx_lead()}</p>
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
	h1 {
		margin: 0;
		font-size: 1.75rem;
	}
</style>
