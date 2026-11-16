<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import LineIcon from '#lib/components/LineIcon.svelte';
	/** A small card for a Tutora Family feature on the free level, with the upgrade button. */
	let {
		feature = null,
		href = '/parent/plans',
		askParent = false
	}: { feature?: string | null; href?: string | null; askParent?: boolean } = $props();
</script>

<div class="ui-card sky fam-lock" role="status">
	<span class="ui-ico navy" aria-hidden="true"><LineIcon name="star" size={20} /></span>
	<div class="stack-s">
		<h2 class="ui-serif">
			{feature ? m.fb_locked_banner({ feature: t(`fb_f_${feature}`) }) : m.fb_locked_title()}
		</h2>
		<p class="small">{m.fb_locked_body()}</p>
		{#if askParent}
			<p class="small"><strong>{m.fb_ask_parent()}</strong></p>
		{:else if href}
			<p><a class="ui-btn" {href}>{m.fb_upgrade()}</a></p>
		{/if}
	</div>
</div>

<style>
	.fam-lock {
		display: flex;
		gap: 0.9rem;
		align-items: flex-start;
	}
	.fam-lock h2 {
		margin: 0;
		font-size: 1.15rem;
	}
	.fam-lock p {
		margin: 0;
	}
</style>
