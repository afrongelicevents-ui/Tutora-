<script lang="ts">
	import Head from '#lib/components/owner/Head.svelte';
	import Flash from '#lib/components/owner/Flash.svelte';
	import Sure from '#lib/components/owner/Sure.svelte';
	import Pill from '#lib/components/owner/Pill.svelte';
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	import { shrink } from '#lib/shrink.ts';
	import { PHOTO_SLOTS, photoSrc } from '#lib/photo-slots.ts';
	let { data, form } = $props();
	// the slot the last (refused) form was for: it stays open
	const formSlot = $derived(form && 'slot' in form ? form.slot : null);
	// what the owner typed stays after a refused try
	const formCredit = $derived(form && 'credit' in form ? form.credit : null);
	const versions = $derived(
		Object.fromEntries(Object.entries(data.chosen).map(([k, v]) => [k, v.version]))
	);
</script>

<svelte:head><title>{m.ow_photos()} · {m.ow_label()} · Tutora</title></svelte:head>

<div class="oa">
	<Head title={m.ow_photos()} lead={m.ow_photos_lead()} icon="sun" tone="blue" />
	<Flash error={form?.error} done={data.done} />

	<ul class="oa-cards two">
		{#each PHOTO_SLOTS as s (s.key)}
			{@const mine = data.chosen[s.key]}
			<li class="ui-card oa-card" id="slot-{s.key}" data-slot={s.key}>
				<div class="slot">
					<img
						src={photoSrc(versions, s.key)}
						alt={m.ow_photo_now({ place: t(`ow_slot_${s.key}`) })}
						width={s.w}
						height={s.h}
						loading="lazy"
					/>
					<div class="grow">
						<span class="name">{t(`ow_slot_${s.key}`)}</span>
						<p class="meta">{t(`ow_slot_${s.key}_where`)}</p>
						{#if mine}
							<Pill tone="ok" text={m.ow_photo_yours()} />
							<p class="meta">
								{m.ow_photo_set({ date: fmtDay(mine.setAt) })}{#if mine.credit}
									· {m.ow_photo_credit_is({ credit: mine.credit })}{/if}
							</p>
						{:else}
							<Pill text={m.ow_photo_standard()} />
						{/if}
					</div>
				</div>
				<details open={formSlot === s.key}>
					<summary class="ui-btn-soft sm">{m.ow_photo_replace()}</summary>
					<form method="POST" action="?/replace" enctype="multipart/form-data" class="oa-form box">
						<input type="hidden" name="slot" value={s.key} />
						<label for="file-{s.key}">{m.ow_photo_file()}</label>
						<input
							id="file-{s.key}"
							name="photo"
							type="file"
							accept="image/jpeg,image/png,image/webp"
							required
							use:shrink={{ max: 900, quality: 0.6 }}
						/>
						<p class="small muted">{m.ow_photo_file_hint()}</p>
						<label for="credit-{s.key}">{m.ow_photo_credit()}</label>
						<input
							id="credit-{s.key}"
							name="credit"
							maxlength="120"
							placeholder={m.ow_photo_credit_ph()}
							value={(formSlot === s.key ? formCredit : null) ?? mine?.credit ?? ''}
						/>
						<label class="check"
							><input type="checkbox" name="rights" /> <span>{m.ow_photo_rights()}</span></label
						>
						<button class="ui-btn" type="submit">{m.ow_photo_save()}</button>
					</form>
				</details>
				{#if mine}
					<Sure
						label={m.ow_photo_back()}
						action="?/remove"
						fields={{ slot: s.key }}
						lead={m.ow_photo_back_lead()}
						sure={m.ow_photo_back_sure()}
						open={formSlot === s.key && form?.error === 'err_tick_sure'}
					/>
				{/if}
			</li>
		{/each}
	</ul>
</div>

<style>
	.slot {
		display: flex;
		gap: 14px;
		align-items: flex-start;
	}
	.slot img {
		width: 112px;
		height: 112px;
		object-fit: cover;
		border-radius: 16px;
		flex-shrink: 0;
		background: var(--ice);
	}
	.name {
		display: block;
		margin-bottom: 2px;
		font-family: var(--font-display);
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--navy);
	}
	.slot .grow {
		display: flex;
		flex-direction: column;
		gap: 6px;
		align-items: flex-start;
	}
	details > summary {
		list-style: none;
		cursor: pointer;
	}
	details > summary::-webkit-details-marker {
		display: none;
	}
	details[open] > summary {
		margin-bottom: 10px;
	}
	.box {
		padding: 14px;
		border-radius: 14px;
		background: var(--snow);
		border: 1px solid var(--border);
	}
</style>
