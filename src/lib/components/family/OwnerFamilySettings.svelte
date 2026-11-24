<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { DEFAULT_TERMS, termLines, type SchoolTerm } from '#lib/terms.ts';
	/** Owner: how families pay Tutora, discounts and the pilot free trial (?/familySettings). */
	type S = {
		ecocashNumber: string | null;
		ecocashName: string | null;
		innbucksNumber: string | null;
		innbucksName: string | null;
		bankName: string | null;
		bankAccountName: string | null;
		bankAccountNumber: string | null;
		bankBranch: string | null;
		notes: string | null;
		discount3mPct: number;
		discount6mPct: number;
		termDates?: SchoolTerm[] | null;
		pilotFreeTrial: boolean;
		trialDays: number;
	};
	let {
		settings,
		saved = false,
		action = '?/familySettings'
	}: { settings: S; saved?: boolean; action?: string } = $props();
</script>

<section class="ui-card stack-s" aria-labelledby="ofset-h">
	<h2 id="ofset-h" class="ui-serif">{m.fb_o_settings()}</h2>
	{#if saved}<p class="notice" role="status">{m.fb_o_saved()}</p>{/if}
	<form method="POST" {action} class="stack-s ofset">
		<label class="check"
			><input type="checkbox" name="pilotFreeTrial" checked={settings.pilotFreeTrial} />
			<span>{m.fb_o_pilot()}</span></label
		>
		<div class="ui-grid2">
			<label
				><span>{m.fb_ecocash()} · {m.fb_acc_number()}</span><input
					name="ecocashNumber"
					value={settings.ecocashNumber ?? ''}
				/></label
			>
			<label
				><span>{m.fb_ecocash()} · {m.fb_acc_name()}</span><input
					name="ecocashName"
					value={settings.ecocashName ?? ''}
				/></label
			>
			<label
				><span>{m.fb_innbucks()} · {m.fb_acc_number()}</span><input
					name="innbucksNumber"
					value={settings.innbucksNumber ?? ''}
				/></label
			>
			<label
				><span>{m.fb_innbucks()} · {m.fb_acc_name()}</span><input
					name="innbucksName"
					value={settings.innbucksName ?? ''}
				/></label
			>
			<label
				><span>{m.fb_o_bank_name()}</span><input
					name="bankName"
					value={settings.bankName ?? ''}
				/></label
			>
			<label
				><span>{m.fb_bank()} · {m.fb_acc_name()}</span><input
					name="bankAccountName"
					value={settings.bankAccountName ?? ''}
				/></label
			>
			<label
				><span>{m.fb_bank()} · {m.fb_acc_number()}</span><input
					name="bankAccountNumber"
					value={settings.bankAccountNumber ?? ''}
				/></label
			>
			<label
				><span>{m.fb_branch()}</span><input
					name="bankBranch"
					value={settings.bankBranch ?? ''}
				/></label
			>
			<label
				><span>{m.fb_o_d3()}</span><input
					name="discount3mPct"
					type="number"
					min="0"
					max="50"
					value={settings.discount3mPct}
				/></label
			>
			<label
				><span>{m.fb_o_d6()}</span><input
					name="discount6mPct"
					type="number"
					min="0"
					max="50"
					value={settings.discount6mPct}
				/></label
			>
			<label class="ofset-terms"
				><span>{m.fb_o_terms()}</span><textarea name="termLines" rows="5"
					>{termLines(settings.termDates?.length ? settings.termDates : DEFAULT_TERMS)}</textarea
				><span class="small muted">{m.fb_o_terms_hint()}</span></label
			>
			<label
				><span>{m.fb_o_trial_days()}</span><input
					name="trialDays"
					type="number"
					min="0"
					max="90"
					value={settings.trialDays}
				/></label
			>
		</div>
		<label
			><span>{m.fb_o_notes()}</span><textarea name="notes" rows="2" maxlength="400"
				>{settings.notes ?? ''}</textarea
			></label
		>
		<button class="ui-btn" type="submit">{m.fb_o_save()}</button>
	</form>
</section>

<style>
	.ofset label:not(.check) {
		display: grid;
		gap: 0.25rem;
	}
</style>
