<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import ConversationList from '#lib/components/messages/ConversationList.svelte';
	let { data } = $props();
</script>

<svelte:head><title>{m.msg_title()} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/tutor">← Tutora</a>
	<h1>{m.msg_title()}</h1>
	<ConversationList
		items={data.convs}
		hrefFor={(id) => `/tutor/messages/${id}`}
		empty={m.tt_messages_none()}
	/>
	{#if data.start.length}
		<ul class="chips">
			{#each data.start as t (t.id)}
				<li>
					<a class="btn btn-secondary" href="/tutor/messages/{t.id}">{m.msg_open()} {t.name}</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.back {
		align-self: flex-start;
		color: var(--ocean);
		font-weight: 600;
		text-decoration: none;
		padding: 8px 0;
	}
	.chips {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
</style>
