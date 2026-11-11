<script lang="ts">
	// defaultValue (not value): on pages that load JavaScript, starting it up must never
	// wipe what someone already typed on a slow connection.
	import { t } from '#lib/i18n.ts';
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends HTMLInputAttributes {
		name: string;
		label: string;
		hint?: string;
		error?: string;
	}
	let { name, label, hint, error, id = `f-${name}`, value, ...rest }: Props = $props();
	const hintId = $derived(hint ? `${id}-hint` : undefined);
	const errId = $derived(error ? `${id}-err` : undefined);
</script>

<div class="field">
	<label for={id}>{label}</label>
	{#if hint}<span class="hint" id={hintId}>{hint}</span>{/if}
	<input
		{id}
		{name}
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={[hintId, errId].filter(Boolean).join(' ') || undefined}
		{...rest}
		defaultValue={value as string | undefined}
	/>
	{#if error}<span class="error" id={errId}>{t(error)}</span>{/if}
</div>
