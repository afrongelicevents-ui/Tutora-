<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDayTime } from '#lib/tz.ts';
	import { T_MESSAGES } from '#lib/t-keys.gen.ts';
	let { data } = $props();
	const known = new Set<string>(Object.keys(T_MESSAGES));
	/** In plain words ("Tutor approved"); an older or unknown entry falls back to its code. */
	const what = (action: string) =>
		known.has(`audit_${action}`) ? t(`audit_${action}`) : action.replace(/_/g, ' ');
</script>

<svelte:head><title>{m.on_audit()} · Tutora</title></svelte:head>

<section class="wrap narrow look">
	<h1>{m.on_audit()}</h1>
	<p class="small muted">{m.oa_lead()}</p>
	<ul class="list card">
		{#each data.log as a (a.id)}
			<li>
				<span
					><b>{what(a.action)}</b>{#if a.detail}<span class="small block">{a.detail}</span
						>{/if}<span class="small muted block">{a.actor ?? '—'} · {fmtDayTime(a.createdAt)}</span
					></span
				>
			</li>
		{:else}
			<li class="empty">{m.none_yet()}</li>
		{/each}
	</ul>
</section>
