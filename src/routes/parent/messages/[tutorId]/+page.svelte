<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import Thread from '#lib/components/messages/Thread.svelte';
	let { data } = $props();
</script>

<svelte:head><title>{m.msg_with({ name: data.otherName })} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/parent/messages?child={data.child}">← {m.msg_back()}</a>
	<h1>{m.msg_with({ name: data.otherName })}</h1>
	<Thread
		messages={data.messages}
		meId={data.meId}
		names={data.names}
		readOnly
		note={m.msg_read_only()}
	/>
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
