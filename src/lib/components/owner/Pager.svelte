<script lang="ts">
	/** "1–25 of 140 · Previous · Next" for a paged owner list (25 a page). */
	import { page as here } from '$app/state';
	import { m } from '#lib/i18n.ts';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	let { page, total, per = 25 }: { page: number; total: number; per?: number } = $props();
	const pages = $derived(Math.max(1, Math.ceil(total / per)));
	function hrefFor(p: number) {
		const u = new SvelteURLSearchParams(here.url.search);
		u.delete('done');
		if (p > 1) u.set('page', String(p));
		else u.delete('page');
		const s = u.toString();
		return s ? `?${s}` : here.url.pathname;
	}
</script>

{#if total > per}
	<nav class="oa-pager" aria-label={m.ow_pages()}>
		<span
			>{m.ow_showing({
				from: (page - 1) * per + 1,
				to: Math.min(total, page * per),
				total
			})}</span
		>
		<span class="oa-acts">
			{#if page > 1}<a href={hrefFor(page - 1)} rel="prev">‹ {m.ow_prev()}</a>{/if}
			{#if page < pages}<a href={hrefFor(page + 1)} rel="next">{m.ow_next()} ›</a>{/if}
		</span>
	</nav>
{/if}
