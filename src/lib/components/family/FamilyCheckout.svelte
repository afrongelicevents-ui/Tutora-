<script lang="ts">
	import { onMount } from 'svelte';
	import { m, t } from '#lib/i18n.ts';
	import { termQuote, dollars } from '#lib/family-pricing.ts';
	import { shortName } from '#lib/names.ts';
	/** Choose children; paid per school term. The total updates as you choose (works without JS). */
	type Child = { id: string; name: string; covered: boolean; elsewhere: boolean };
	type Term = { name: string; start: string; end: string; fraction: number };
	let {
		children,
		term,
		self = false,
		preselect = null,
		error = null
	}: {
		children: Child[];
		/** the school term this payment is for */
		term: Term;
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
	const n = $derived(self ? 1 : chosen.length);
	const q = $derived(termQuote(n, term.fraction));
	const fmt = (d: string) =>
		new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
	// set once the page is live (the total follows the choices from then on)
	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
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
	<div class="ui-card stack-s">
		<h3 class="ui-serif fam-term">{m.fb_term_title()}</h3>
		{#if term.name}<p>
				{m.fb_term_dates({ name: term.name, start: fmt(term.start), end: fmt(term.end) })}
			</p>{/if}
		<p class="small muted">
			{term.fraction < 1
				? m.fb_term_part({ pct: Math.round(term.fraction * 100) })
				: m.fb_term_full()}
		</p>
		<input type="hidden" name="period" value="3" />
	</div>
	<div class="ui-card fam-total" aria-live="polite">
		<span>{m.fb_total()}</span>
		<strong class="ui-serif">{dollars(q.totalCents)}</strong>
		{#if q.totalCents < q.fullCents}<s class="muted small">{dollars(q.fullCents)}</s>{/if}
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
	.fam-term {
		font-size: 1.1rem;
		margin: 0;
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
