<script lang="ts">
	import Field from '#lib/components/Field.svelte';
	import { m } from '#lib/i18n.ts';
	let { data, form } = $props();
	const e = $derived(
		((form && 'errors' in form ? form.errors : {}) ?? {}) as Record<string, string>
	);
</script>

<svelte:head><title>{m.children_title()} · Tutora</title></svelte:head>

<section class="wrap narrow stack">
	<h1>{m.children_title()}</h1>
	<p class="small muted">{m.children_lead()}</p>
	{#each data.children as c (c.id)}
		<div class="card row">
			<span class="grow"
				><b>{c.name}</b><span class="small muted block"
					>{[c.level, c.schoolYear].filter(Boolean).join(' · ')}</span
				></span
			>
			<form method="POST" action="?/remove">
				<input type="hidden" name="id" value={c.id} />
				<button class="btn btn-secondary btn-sm" type="submit">{m.remove()}</button>
			</form>
		</div>
	{:else}
		<p class="empty">{m.children_none()}</p>
	{/each}
	<form method="POST" action="?/add" class="card stack" novalidate>
		<h2 class="h3">{m.children_add()}</h2>
		<Field name="name" label={m.children_name()} error={e.name} required />
		<Field name="level" label={m.find_level()} hint={m.find_level_ph()} error={e.level} />
		<Field
			name="schoolYear"
			label={m.children_year()}
			hint={m.children_year_ph()}
			error={e.schoolYear}
		/>
		<button class="btn btn-block" type="submit">{m.children_add()}</button>
	</form>
	<a href="/student">{m.back()}</a>
</section>
