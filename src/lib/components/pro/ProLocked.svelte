<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import LineIcon from '#lib/components/LineIcon.svelte';
	import ProPill from './ProPill.svelte';
	/** A Tutora Pro feature on the Free plan: what it does, with the Upgrade button. */
	let { feature, compact = false }: { feature: string; compact?: boolean } = $props();
</script>

<div class="ui-card sky pro-lock" class:compact role="status">
	<span class="ui-ico navy" aria-hidden="true"><LineIcon name="star" size={20} /></span>
	<div class="stack-s">
		<p class="pro-h"><ProPill /> <strong>{t(`pro_f_${feature}`)}</strong></p>
		{#if !compact}<p class="small">{m.pro_locked_body()}</p>{/if}
		<p><a class="ui-btn" href="/tutor/pro?locked={feature}">{m.pro_upgrade()}</a></p>
	</div>
</div>

<style>
	.pro-lock {
		display: flex;
		gap: 0.9rem;
		align-items: flex-start;
	}
	.pro-lock p {
		margin: 0;
	}
	.pro-h {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}
</style>
