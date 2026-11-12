<script lang="ts">
	import { page } from '$app/state';
	import { m } from '#lib/i18n.ts';
	let { data } = $props();
	const connected = $derived(page.url.searchParams.get('connected'));
	const pending = $derived(page.url.searchParams.get('pending'));
	const first = (n: string) => n.trim().split(/\s+/)[0];
</script>

<svelte:head><title>{m.v3_nav_overview()} · Tutora</title></svelte:head>

<div class="screen">
	<h1>{m.par_hello({ name: data.name })}</h1>
	{#if connected}<p class="notice" role="status">{m.par_connected({ name: connected })}</p>{/if}
	{#if pending}<p class="notice" role="status">{m.par_pending({ name: pending })}</p>{/if}
	{#if data.waitingCode}
		<div class="softcard">
			<span>{m.par_code_waiting({ name: data.waitingCode.firstName })}</span>
			<a class="btn" href="/code/connect">{m.par_code_finish()}</a>
		</div>
	{/if}
	{#if data.kids.length}
		<div class="chips">
			{#each data.kids as k (k.id)}
				<span class="chip">{first(k.name)}{k.level ? ` · ${k.level}` : ''}</span>
			{/each}
			<a class="chip add" href="/parent/children">{m.par_add_code()}</a>
		</div>
	{:else}
		<div class="empty stack">
			<h2 class="h3">{m.par_no_children()}</h2>
			<p class="lead">{m.par_no_children_lead()}</p>
			<a class="btn" href="/parent/children">{m.par_add_child_code_h()}</a>
		</div>
	{/if}
</div>
