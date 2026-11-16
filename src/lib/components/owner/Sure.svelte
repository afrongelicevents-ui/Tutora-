<script lang="ts">
	/**
	 * "Are you sure?" before an action that is hard to undo: a button opens a short
	 * explanation and an "I'm sure" tick; the server refuses the action without the tick.
	 */
	import type { Snippet } from 'svelte';
	import { m } from '#lib/i18n.ts';
	let {
		label,
		action,
		fields = {},
		lead = '',
		sure,
		button = '',
		open = false,
		warn = true,
		enctype,
		children
	}: {
		/** the button that opens the step */
		label: string;
		/** the form action, e.g. "?/status" */
		action: string;
		/** hidden fields */
		fields?: Record<string, string>;
		/** what will happen, in plain words */
		lead?: string;
		/** the tick's text */
		sure: string;
		/** the final button (default: the same as label) */
		button?: string;
		open?: boolean;
		warn?: boolean;
		enctype?: 'multipart/form-data';
		/** extra inputs (e.g. a reason) */
		children?: Snippet;
	} = $props();
</script>

<details class="oa-sure" class:warn {open}>
	<summary>{label}</summary>
	<form method="POST" {action} {enctype} class="box">
		{#each Object.entries(fields) as [k, v] (k)}<input type="hidden" name={k} value={v} />{/each}
		<p class="q">{m.ow_are_you_sure()}</p>
		{#if lead}<p class="small">{lead}</p>{/if}
		{#if children}{@render children()}{/if}
		<label class="check"><input type="checkbox" name="sure" /> <span>{sure}</span></label>
		<div class="oa-acts">
			<button class="ui-btn sm" class:warn type="submit">{button || label}</button>
		</div>
	</form>
</details>
