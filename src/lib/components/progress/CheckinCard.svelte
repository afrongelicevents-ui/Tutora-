<script lang="ts">
	// A learning check-in ("How is learning going today?"). The student decides whether their
	// family sees it. Posts to the page's own ?/checkin and ?/share actions.
	import { m, t } from '#lib/i18n.ts';
	import { CHECKIN_MOODS } from '#lib/checkin-moods.ts';
	let {
		family,
		checkin,
		checkinId,
		form
	}: {
		/** labels of active family members (who would see a shared check-in) */
		family: string[];
		checkin: { mood: string; shared: boolean } | null;
		checkinId: number | null;
		form: { checked?: unknown; shared?: unknown } | null | undefined;
	} = $props();

	const names = $derived(
		family.length <= 1
			? (family[0] ?? '')
			: `${family.slice(0, -1).join(', ')} ${m.and_word()} ${family.at(-1)}`
	);
	const picked = $derived((form?.checked as string | undefined) ?? checkin?.mood ?? null);
	const shared = $derived(form?.checked ? !!form.shared : !!checkin?.shared);
</script>

<section class="softcard checkin" id="checkin">
	<strong>{m.sh_checkin_q()}</strong>
	<form method="POST" action="?/checkin" class="stack-s">
		{#if family.length}
			<label class="share"
				><input type="checkbox" name="share" checked={picked ? shared : false} />
				{m.sh_share_with({ names })}</label
			>
		{/if}
		<div class="chips">
			{#each CHECKIN_MOODS as mood (mood)}
				<button class="chip" type="submit" name="mood" value={mood} aria-pressed={picked === mood}
					>{t(`ci_${mood}`)}</button
				>
			{/each}
		</div>
	</form>
	{#if picked}
		<span class="small ocean-t" role="status">
			{#if !family.length}{m.sh_checkin_saved()} {m.sh_no_family_note()}
			{:else if shared}{m.sh_shared_with({ names })}
			{:else}{m.sh_kept_private()}{/if}
		</span>
		{#if family.length && checkinId}
			<form method="POST" action="?/share">
				<input type="hidden" name="id" value={checkinId} />
				<input type="hidden" name="shared" value={shared ? '' : 'on'} />
				<button class="btn-link small" type="submit"
					>{shared ? m.sh_make_private() : m.sh_share_it({ names })}</button
				>
			</form>
		{/if}
	{/if}
</section>

<style>
	.checkin {
		gap: 12px;
	}
	.stack-s {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.share {
		display: flex;
		gap: 10px;
		align-items: center;
		font-size: 0.875rem;
		min-height: 44px;
	}
	.share input {
		width: 20px;
		height: 20px;
		accent-color: var(--ocean);
	}
	.ocean-t {
		color: var(--ocean);
	}
</style>
