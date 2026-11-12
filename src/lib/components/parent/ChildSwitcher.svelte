<script lang="ts">
	import { m } from '#lib/i18n.ts';
	let {
		kids,
		current,
		base
	}: {
		kids: { id: string; name: string; level: string | null; status: string }[];
		current: string | null;
		base: string;
	} = $props();
</script>

{#if kids.length}
	<nav class="chips" aria-label={m.par3_children()}>
		{#each kids.filter((k) => k.status === 'active') as k (k.id)}
			<a
				class="chip"
				href="{base}?child={encodeURIComponent(k.id)}"
				aria-current={k.id === current ? 'true' : undefined}
				>{k.name}{k.level ? ` · ${k.level}` : ''}</a
			>
		{/each}
		{#each kids.filter((k) => k.status !== 'active') as k (k.id)}
			<span class="chip add" title={m.par_pending_short()}>{k.name} · {m.par3_waiting()}</span>
		{/each}
		<a class="chip add" href="/parent/children#add">{m.par_add_code()}</a>
	</nav>
{/if}
