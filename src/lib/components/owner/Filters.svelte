<script lang="ts">
	/**
	 * Search box and filter chips (with counts) for an owner list. Both are plain links and a
	 * GET form, so they work without JavaScript; the page number starts again at 1.
	 */
	import { page } from '$app/state';
	import { m } from '#lib/i18n.ts';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	let {
		chips = [],
		name = 'status',
		search = false,
		placeholder = '',
		label = ''
	}: {
		chips?: { value: string; label: string; count?: number }[];
		/** the address parameter the chips set */
		name?: string;
		search?: boolean;
		placeholder?: string;
		/** what the chips are, for screen readers */
		label?: string;
	} = $props();
	const current = $derived(page.url.searchParams.get(name) ?? '');
	const q = $derived(page.url.searchParams.get('q') ?? '');
	function hrefFor(value: string) {
		const u = new SvelteURLSearchParams(page.url.search);
		u.delete('page');
		if (value) u.set(name, value);
		else u.delete(name);
		const s = u.toString();
		return s ? `?${s}` : page.url.pathname;
	}
	// other filters stay when searching
	const keep = $derived(
		[...page.url.searchParams.entries()].filter(([k]) => k !== 'q' && k !== 'page' && k !== 'done')
	);
</script>

<div class="oa-bar">
	{#if search}
		<form method="GET" class="oa-search" role="search">
			{#each keep as [k, v] (k)}<input type="hidden" name={k} value={v} />{/each}
			<input
				type="search"
				name="q"
				value={q}
				{placeholder}
				aria-label={placeholder || m.owner_search()}
				maxlength="60"
			/>
			<button class="ui-btn" type="submit">{m.owner_search_btn()}</button>
		</form>
	{/if}
	{#if chips.length}
		<nav class="oa-chips" aria-label={label || m.ow_filter()}>
			{#each chips as c (c.value)}
				<a
					class="oa-chip"
					href={hrefFor(c.value)}
					aria-current={current === c.value ? 'page' : undefined}
					>{c.label}{#if c.count !== undefined}<span class="c">{c.count}</span>{/if}</a
				>
			{/each}
		</nav>
	{/if}
</div>
