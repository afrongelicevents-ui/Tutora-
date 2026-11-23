<script lang="ts">
	/**
	 * "Reset password" on a person's card: makes a one-time link (24 hours). The link is shown
	 * once with Copy and Share on WhatsApp; nothing changes for the person until they use it.
	 */
	import { m } from '#lib/i18n.ts';
	let {
		id,
		action = '?/resetLink',
		result = null
	}: {
		id: string;
		action?: string;
		result?: { for: string; name: string; link: string; wa: string } | null;
	} = $props();
	const mine = $derived(result && result.for === id ? result : null);
	let copied = $state(false);
	async function copy() {
		if (!mine) return;
		try {
			await navigator.clipboard.writeText(mine.link);
			copied = true;
		} catch {
			// no clipboard permission: the link is selected in the box for a manual copy
			(document.getElementById(`rl-${id}`) as HTMLInputElement | null)?.select();
		}
	}
</script>

{#if mine}
	<div class="rl" role="status" data-reset-link>
		<p class="small"><strong>{m.rl_made({ name: mine.name })}</strong> {m.rl_once()}</p>
		<input
			id="rl-{id}"
			class="rl-url"
			readonly
			value={mine.link}
			aria-label={m.rl_link_label()}
			onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
		/>
		<div class="rl-acts">
			<button type="button" class="ui-btn sm" onclick={copy}
				>{copied ? m.rl_copied() : m.rl_copy()}</button
			>
			<a class="ui-btn-soft sm" href={mine.wa} target="_blank" rel="noopener noreferrer"
				>{m.share_wa()}</a
			>
		</div>
	</div>
{:else}
	<form method="POST" {action}>
		<input type="hidden" name="id" value={id} />
		<button class="ui-btn-soft sm" type="submit">{m.rl_btn()}</button>
	</form>
{/if}

<style>
	.rl {
		display: grid;
		gap: 0.5rem;
		width: 100%;
		padding: 0.75rem;
		border-radius: 0.9rem;
		background: var(--ice);
	}
	.rl-url {
		width: 100%;
		font: inherit;
		font-size: 0.85rem;
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--border-strong);
		border-radius: 0.6rem;
		background: white;
	}
	.rl-acts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
</style>
