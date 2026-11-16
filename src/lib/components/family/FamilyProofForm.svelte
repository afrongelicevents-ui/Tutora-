<script lang="ts">
	import { m } from '#lib/i18n.ts';
	/** Proof of payment for one Tutora invoice (works without JavaScript). */
	let { invoiceId, action = '?/proof' }: { invoiceId: number; action?: string } = $props();
	const methods = ['ecocash', 'innbucks', 'bank', 'cash', 'other'] as const;
	const label = (k: string) =>
		({
			ecocash: m.fb_m_ecocash(),
			innbucks: m.fb_m_innbucks(),
			bank: m.fb_m_bank(),
			cash: m.fb_m_cash(),
			other: m.fb_m_other()
		})[k] ?? k;
</script>

<form method="POST" {action} enctype="multipart/form-data" class="stack-s fam-proof">
	<input type="hidden" name="invoice" value={invoiceId} />
	<label class="field"
		><span>{m.fb_method()}</span>
		<select name="method">
			{#each methods as k (k)}<option value={k}>{label(k)}</option>{/each}
		</select></label
	>
	<label class="field"
		><span>{m.fb_reference()}</span><input
			name="reference"
			maxlength="80"
			autocomplete="off"
		/></label
	>
	<label class="field"
		><span>{m.fb_proof()}</span><input
			type="file"
			name="proof"
			accept="image/*,application/pdf"
			required
		/></label
	>
	<button class="ui-btn" type="submit">{m.fb_send_proof()}</button>
</form>

<style>
	.fam-proof .field {
		display: grid;
		gap: 0.25rem;
	}
</style>
