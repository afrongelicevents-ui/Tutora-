<script lang="ts">
	import { onMount } from 'svelte';
	import { m, t } from '#lib/i18n.ts';
	import Hero from '#lib/components/ui/Hero.svelte';
	import FamilyState from '#lib/components/family/FamilyState.svelte';
	import ProPill from '#lib/components/pro/ProPill.svelte';
	import { formatMoney } from '#lib/money.ts';
	import { PRO_FEATURES, FREE_TUTOR_FEATURES } from '#lib/pro-pricing.ts';
	let { data, form } = $props();
	const reason = $derived(data.access.pilot ? 'pilot' : data.access.state);
	let period = $state(1);
	// the live total works once the page is interactive (tests wait for this)
	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
	const chosen = $derived(data.prices.find((p) => p.period === period) ?? data.prices[0]);
</script>

<svelte:head><title>{m.pro_title()} · Tutora</title></svelte:head>

<section class="screen">
	<Hero title={m.pro_title()} lead={m.pro_lead()} />
	<div class="ui-page stack">
		{#if data.locked}
			<p class="notice" role="status">
				<ProPill />
				{m.pro_locked_banner({ feature: t(`pro_f_${data.locked}`) })}
			</p>
		{/if}
		{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
		{#if form?.trial}<p class="notice" role="status">{m.fb_trial_ok()}</p>{/if}
		{#if form?.prefsSaved}<p class="notice" role="status">{m.saved()}</p>{/if}
		<p><FamilyState {reason} until={data.access.until ?? null} /></p>
		{#if data.pilot}<p class="notice">{m.pro_pilot_on()}</p>{/if}

		<div class="pro-cols">
			<article class="ui-card stack-s">
				<h2 class="ui-serif">{m.pro_free_title()}</h2>
				<ul class="pro-list">
					{#each FREE_TUTOR_FEATURES as f (f)}<li>{t(`pro_free_${f}`)}</li>{/each}
				</ul>
			</article>
			<article class="ui-card sky stack-s">
				<h2 class="ui-serif"><ProPill /> {m.pro_pro_title()}</h2>
				<ul class="pro-list">
					{#each PRO_FEATURES as f (f)}<li>{t(`pro_f_${f}`)}</li>{/each}
				</ul>
			</article>
		</div>

		{#if data.access.active}
			<article class="ui-card stack-s">
				<h2 class="ui-serif">{m.pro_settings_title()}</h2>
				<p class="small muted">{m.pro_settings_lead()}</p>
				<p class="btn-row">
					<a class="ui-btn-soft" href="/tutor/payments#earnings-report">{m.pro_f_earnings()}</a>
					<a class="ui-btn-soft" href="/tutor/insights">{m.pro_f_insights()}</a>
				</p>
				<form method="POST" action="?/prefs" class="stack-s">
					<label class="check"
						><input type="checkbox" name="autoReminders" checked={data.prefs.autoReminders} />
						<span>{m.pro_auto_reminders()}</span></label
					>
					<p class="small muted">{m.pro_auto_reminders_hint()}</p>
					<label class="field"
						><span>{m.pro_brand_colour()}</span>
						<input
							type="color"
							name="brandColour"
							value={data.prefs.brandColour || '#0b2545'}
						/></label
					>
					<button class="ui-btn" type="submit">{m.save()}</button>
				</form>
			</article>
		{/if}

		<article class="ui-card stack-s">
			<h2 class="ui-serif">{m.pro_price_title()}</h2>
			<p class="pro-big">{m.pro_price_month()}</p>
			<p class="small">{m.pro_no_fee()}</p>
			<form method="POST" action="?/invoice" class="stack-s" data-ready={ready || undefined}>
				<fieldset class="periods">
					<legend class="small">{m.fb_period()}</legend>
					{#each data.prices as p (p.period)}
						<label class="per"
							><input type="radio" name="period" value={p.period} bind:group={period} />
							<span
								>{t(`fb_months_${p.period}`)} ·
								<strong>{formatMoney(p.totalCents)}</strong
								>{#if p.discountPct}{` · ${m.fb_discount({ pct: p.discountPct })}`}{/if}</span
							></label
						>
					{/each}
				</fieldset>
				<p class="small">{m.pro_total({ amount: formatMoney(chosen.totalCents) })}</p>
				<div class="btn-row">
					<button class="ui-btn" type="submit">{m.pro_pay_now()}</button>
					<a class="ui-btn-soft" href="/tutor/pro/billing">{m.fb_billing_link()}</a>
				</div>
			</form>
			{#if data.canStartTrial}
				<form method="POST" action="?/trial">
					<button class="ui-btn-soft" type="submit"
						>{m.fb_trial_start({ days: data.trialDays })}</button
					>
				</form>
			{/if}
		</article>
	</div>
</section>

<style>
	.pro-cols {
		display: grid;
		gap: 1rem;
	}
	@media (min-width: 700px) {
		.pro-cols {
			grid-template-columns: 1fr 1fr;
		}
	}
	.pro-list {
		margin: 0;
		padding-left: 1.2rem;
		display: grid;
		gap: 0.3rem;
	}
	.pro-big {
		font-size: 1.6rem;
		font-weight: 700;
		margin: 0;
	}
	.periods {
		border: 0;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.4rem;
	}
	.per {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.check {
		display: flex;
		gap: 0.5rem;
		align-items: flex-start;
	}
	.field {
		display: grid;
		gap: 0.25rem;
		max-width: 12rem;
	}
	.btn-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}
</style>
