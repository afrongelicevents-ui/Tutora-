<script lang="ts">
	import BookingForm from '#lib/components/booking/BookingForm.svelte';
	import { m } from '#lib/i18n.ts';
	let { data, form } = $props();
	const kidQ = $derived(`child=${encodeURIComponent(data.kid.id)}`);
</script>

<svelte:head><title>{m.book_lesson()} · Tutora</title></svelte:head>

<div class="screen">
	{#if data.mode === 'pick'}
		<a class="back" href="/parent/children" aria-label={m.v3_back()}>←</a>
		<h1>{m.par3_book_for({ name: data.kid.name })}</h1>
		{#if data.mine.length}
			<div class="rows top">
				{#each data.mine as tu (tu.slug)}<a href="?{kidQ}&tutor={tu.slug}"
						><span>{tu.name}</span><span class="go">›</span></a
					>{/each}
			</div>
		{/if}
		<form method="GET" class="stack">
			<input type="hidden" name="child" value={data.kid.id} />
			<label class="field"
				><span class="label">{m.find3_search_label()}</span><input
					name="q"
					type="search"
					value={data.q}
					placeholder={m.find3_search_ph()}
				/></label
			>
			<button class="btn btn-ghost" type="submit">{m.find3_apply()}</button>
		</form>
		{#if data.q}
			<div class="rows">
				{#each data.found as tu (tu.slug)}<a href="?{kidQ}&tutor={tu.slug}"
						><span>{tu.name} <span class="muted small">· {tu.subjects.join(', ')}</span></span><span
							class="go">›</span
						></a
					>{:else}<p class="lead">{m.find3_none_match()}</p>{/each}
			</div>
		{/if}
	{:else}
		<BookingForm
			site={data.site}
			intro={data.intro}
			days={data.days}
			groups={data.groups}
			preselect={null}
			error={form?.error ?? null}
			back="/parent/book?{kidQ}"
			forName={data.kid.name}
		/>
	{/if}
</div>

<style>
	h1 {
		margin: 0;
		font-size: 1.75rem;
	}
	.rows a {
		text-decoration: none;
	}
</style>
