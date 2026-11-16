<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import FamilyLocked from '#lib/components/family/FamilyLocked.svelte';
	import FamilyState from '#lib/components/family/FamilyState.svelte';
	let { data, form } = $props();
</script>

<svelte:head><title>{m.fb_plans_title()} · Tutora</title></svelte:head>

<section class="screen ui-page">
	<h1 class="ui-serif">{m.fb_plans_title()}</h1>
	{#if data.locked}
		<FamilyLocked feature={data.locked} href="/parent/checkout" />
	{/if}
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if form?.trial}<p class="notice" role="status">{m.fb_trial_ok()}</p>{/if}
	<p class="fam-lead">{m.fb_plans_lead()}</p>
	<p><FamilyState reason={data.access.reason} until={data.access.until} /></p>
	{#if data.pilot}<p class="notice">{m.fb_pilot_on()}</p>{/if}

	<div class="ui-grid2">
		<article class="ui-card stack-s">
			<h2 class="ui-serif">{m.fb_free_title()}</h2>
			<ul class="fam-list">
				<li>{m.fb_free_1()}</li>
				<li>{m.fb_free_2()}</li>
				<li>{m.fb_free_3()}</li>
			</ul>
		</article>
		<article class="ui-card sky stack-s">
			<h2 class="ui-serif">{m.fb_family_title()}</h2>
			<ul class="fam-list">
				<li>{m.fb_family_1()}</li>
				<li>{m.fb_family_2()}</li>
				<li>{m.fb_family_3()}</li>
				<li>{m.fb_family_4()}</li>
			</ul>
		</article>
	</div>

	<article class="ui-card stack-s">
		<h2 class="ui-serif">{m.fb_price_title()}</h2>
		<ul class="fam-list">
			<li>{m.fb_price_1()}</li>
			<li>{m.fb_price_2()}</li>
			<li>{m.fb_price_3()}</li>
		</ul>
		<p class="small muted">{m.fb_price_eg()}</p>
		{#if data.discounts.discount3mPct || data.discounts.discount6mPct}
			<p class="small">
				{#if data.discounts.discount3mPct}{m.fb_months_3()}: {m.fb_discount({
						pct: data.discounts.discount3mPct
					})}{/if}
				{#if data.discounts.discount6mPct}
					· {m.fb_months_6()}: {m.fb_discount({ pct: data.discounts.discount6mPct })}{/if}
			</p>
		{/if}
	</article>

	<div class="fam-actions">
		{#if data.pilot}
			<a class="ui-btn-soft" href="/parent/billing">{m.fb_billing_link()}</a>
		{:else}
			{#if data.canStartTrial}
				<form method="POST" action="?/trial">
					<button class="ui-btn-soft" type="submit"
						>{m.fb_trial_start({ days: data.trialDays })}</button
					>
				</form>
			{/if}
			<a class="ui-btn" href="/parent/checkout">{m.fb_go_checkout()}</a>
			<a class="ui-btn-soft" href="/parent/billing">{m.fb_billing_link()}</a>
		{/if}
	</div>
</section>

<style>
	.fam-lead {
		font-size: 1.05rem;
	}
	.fam-list {
		margin: 0;
		padding-left: 1.2rem;
		display: grid;
		gap: 0.3rem;
	}
	.fam-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}
</style>
