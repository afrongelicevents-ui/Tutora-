<script lang="ts">
	import { m } from '#lib/i18n.ts';
	/** Owner: the Tutora Pro pilot switch and the one-time trial length (?/proSettings). */
	let {
		settings,
		saved = false
	}: { settings: { proPilotFreeTrial: boolean; proTrialDays: number }; saved?: boolean } = $props();
</script>

<section class="ui-card stack-s" aria-labelledby="opset-h">
	<h2 id="opset-h" class="ui-serif">{m.pro_o_settings()}</h2>
	{#if saved}<p class="notice" role="status">{m.fb_o_saved()}</p>{/if}
	<p class="small muted">{m.pro_o_settings_lead()}</p>
	<form method="POST" action="?/proSettings" class="stack-s">
		<label class="check"
			><input type="checkbox" name="proPilotFreeTrial" checked={settings.proPilotFreeTrial} />
			<span>{m.pro_o_pilot()}</span></label
		>
		<label class="field"
			><span>{m.pro_o_trial_days()}</span><input
				name="proTrialDays"
				type="number"
				min="0"
				max="90"
				value={settings.proTrialDays}
			/></label
		>
		<button class="ui-btn" type="submit">{m.save()}</button>
	</form>
</section>

<style>
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
</style>
