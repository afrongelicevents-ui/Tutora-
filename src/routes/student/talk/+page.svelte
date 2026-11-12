<script lang="ts">
	import { m } from '#lib/i18n.ts';
	let { data, form } = $props();
	const names = $derived(
		data.family.length <= 1
			? (data.family[0] ?? '')
			: `${data.family.slice(0, -1).join(', ')} ${m.and_word()} ${data.family.at(-1)}`
	);
</script>

<svelte:head><title>{m.tk_title()} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/student/progress#checkin">← {m.v3_nav_progress()}</a>
	<h1>{m.tk_title()}</h1>
	<p class="lead">{m.tk_lead()}</p>
	<div class="softcard opts">
		{#each data.tutors as t (t.id)}
			<a class="btn" href="/student/messages/{t.id}">{m.tk_tutor({ name: t.name })}</a>
		{/each}
		{#if data.family.length}
			{#if form?.asked}
				<p class="notice" role="status">{m.tk_parent_sent({ names })}</p>
			{:else}
				<form method="POST" action="?/parent">
					<button class="btn btn-secondary" type="submit">{m.tk_parent({ names })}</button>
				</form>
			{/if}
		{:else}
			<p class="small muted">
				{m.tk_parent_none()} <a href="/student/family">{m.me_family()} →</a>
			</p>
		{/if}
	</div>
	<p class="safe">{m.tk_safe()}</p>
</div>

<style>
	.back {
		align-self: flex-start;
		color: var(--ocean);
		font-weight: 600;
		text-decoration: none;
		padding: 8px 0;
	}
	.opts {
		gap: 10px;
	}
	.opts .btn,
	.opts form .btn {
		width: 100%;
	}
	.safe {
		margin: 0;
		color: var(--text);
		line-height: 1.5;
	}
</style>
