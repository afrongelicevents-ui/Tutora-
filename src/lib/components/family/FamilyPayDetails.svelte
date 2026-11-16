<script lang="ts">
	import { m } from '#lib/i18n.ts';
	/** Tutora's own payment details, or "coming soon" before the owner fills them in. */
	type Details = {
		ecocashNumber: string | null;
		ecocashName: string | null;
		innbucksNumber: string | null;
		innbucksName: string | null;
		bankName: string | null;
		bankAccountName: string | null;
		bankAccountNumber: string | null;
		bankBranch: string | null;
		notes: string | null;
	} | null;
	let { details }: { details: Details } = $props();
</script>

<section class="ui-card cream stack-s" aria-labelledby="fam-pay-h">
	<h2 id="fam-pay-h" class="ui-serif">{m.fb_details_title()}</h2>
	{#if !details}
		<p class="small">{m.fb_details_soon()}</p>
	{:else}
		<dl class="fam-dl">
			{#if details.ecocashNumber}
				<dt>{m.fb_ecocash()}</dt>
				<dd>
					<strong>{details.ecocashNumber}</strong>{details.ecocashName
						? ` · ${details.ecocashName}`
						: ''}
				</dd>
			{/if}
			{#if details.innbucksNumber}
				<dt>{m.fb_innbucks()}</dt>
				<dd>
					<strong>{details.innbucksNumber}</strong>{details.innbucksName
						? ` · ${details.innbucksName}`
						: ''}
				</dd>
			{/if}
			{#if details.bankAccountNumber}
				<dt>{m.fb_bank()}</dt>
				<dd>
					{[details.bankName, details.bankAccountName].filter(Boolean).join(' · ')}<br /><strong
						>{details.bankAccountNumber}</strong
					>{details.bankBranch ? ` · ${m.fb_branch()} ${details.bankBranch}` : ''}
				</dd>
			{/if}
		</dl>
		{#if details.notes}<p class="small muted">{details.notes}</p>{/if}
	{/if}
</section>

<style>
	.fam-dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.4rem 1rem;
		margin: 0;
	}
	.fam-dl dt {
		font-weight: 600;
	}
	.fam-dl dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
</style>
