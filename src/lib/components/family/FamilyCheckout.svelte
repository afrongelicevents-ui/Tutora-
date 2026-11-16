<script lang="ts">
	import { onMount } from 'svelte';
	import { m, t } from '#lib/i18n.ts';
	import { quote, PERIODS, dollars } from '#lib/family-pricing.ts';
	import { shortName } from '#lib/names.ts';
	/** Choose children and period; the total updates as you choose (and works without JS). */
	type Child = { id: string; name: string; covered: boolean; elsewhere: boolean };
	let {
		children,
		discounts,
		self = false,
		preselect = null,
		error = null
	}: {
		children: Child[];
		discounts: { discount3mPct: number; discount6mPct: number };
		/** an adult student paying for themselves: no child list */
		self?: boolean;
		/** adding one child: tick that child and the ones already on Tutora Family */
		preselect?: string | null;
		error?: string | null;
	} = $props();
	// svelte-ignore state_referenced_locally
	let chosen = $state<string[]>(
		children
			.filter((c) => !c.elsewhere && (!preselect || c.covered || c.id === preselect))
			.map((c) => c.id)
	);
	let period = $state(1);
	const n = $derived(self ? 1 : chosen.length);
	const q = $derived(quote(n, period, discounts));
	// set once the page is live (the total follows the choices from then on)
	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
	const pct = (p: number) =>
		p === 6 ? discounts.discount6mPct : p === 3 ? discounts.discount3mPct : 0;
</script>

<form method="POST" action="?/invoice" class="stack fam-co" data-ready={ready || undefined}>
	{#if error}<p class="alert" role="alert">{t(error)}</p>{/if}
	{#if !self}
		<div class="ui-card">
			<fieldset class="stack-s">
				<legend class="ui-serif">{m.fb_children()}</legend>
				{#each children as c (c.id)}
					<label class="check">
						<input
							type="checkbox"
							name="child"
							value={c.id}
							bind:group={chosen}
							disabled={c.elsewhere}
						/>
						<span
							>{shortName(c.name)}
							{#if c.elsewhere}<br /><span class="small muted">{m.fb_child_elsewhere()}</span
								>{:else if c.covered}<br /><span class="small muted">{m.fb_child_on_family()}</span
								>{/if}</span
						>
					</label>
				{/each}
			</fieldset>
		</div>
	{/if}
	<div class="ui-card">
		<fieldset class="stack-s">
			<legend class="ui-serif">{m.fb_period()}</legend>
			{#each PERIODS as p (p)}
				<label class="check">
					<input type="radio" name="period" value={p} bind:group={period} />
					<span
						>{t(`fb_months_${p}`)}
						{#if pct(p)}<span class="ui-pill gold">{m.fb_discount({ pct: pct(p) })}</span
							>{/if}</span
					>
				</label>
			{/each}
		</fieldset>
	</div>
	<div class="ui-card fam-total" aria-live="polite">
		<span>{m.fb_total()}</span>
		<strong class="ui-serif">{dollars(q.totalCents)}</strong>
		{#if q.discountPct}<s class="muted small">{dollars(q.grossCents)}</s>{/if}
	</div>
	<button class="ui-btn" type="submit" disabled={n === 0}>{m.fb_make_invoice()}</button>
</form>

<style>
	.fam-co fieldset {
		border: 0;
		margin: 0;
	}
	.fam-co legend {
		font-size: 1.1rem;
		padding: 0;
		margin-bottom: 0.4rem;
	}
	.fam-total {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
	}
	.fam-total strong {
		font-size: 1.6rem;
	}
</style>
