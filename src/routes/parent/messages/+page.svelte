<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import ConversationList from '#lib/components/messages/ConversationList.svelte';
	let { data } = $props();
</script>

<svelte:head><title>{m.msg_parent_link()} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/parent">← {m.v3_nav_home()}</a>
	<h1>{m.msg_parent_link()}</h1>
	<p class="muted">{m.msg_read_only()}</p>
	{#if data.allowed && data.convs}
		<ConversationList
			items={data.convs.map((c) => ({ ...c, unread: 0 }))}
			hrefFor={(id) => `/parent/messages/${id}?child=${data.current}`}
			empty={m.msg_none()}
		/>
	{:else}
		<p class="muted">{m.msg_none()}</p>
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
</style>
