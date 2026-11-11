<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { fmtDayTime } from '#lib/tz.ts';
	let { data } = $props();
</script>

<svelte:head><title>{m.on_audit()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<h1>{m.on_audit()}</h1>
	<p class="small muted">{m.oa_lead()}</p>
	<ul class="list card">
		{#each data.log as a (a.id)}
			<li>
				<span
					><b>{a.action.replace(/_/g, ' ')}</b>{#if a.detail}<span class="small block"
							>{a.detail}</span
						>{/if}<span class="small muted block">{a.actor ?? '—'} · {fmtDayTime(a.createdAt)}</span
					></span
				>
			</li>
		{:else}
			<li class="empty">{m.none_yet()}</li>
		{/each}
	</ul>
</section>
