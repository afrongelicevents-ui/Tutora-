<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import Thread from '#lib/components/messages/Thread.svelte';
	let { data, form } = $props();
</script>

<svelte:head><title>{m.msg_with({ name: data.otherName })} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/student/messages">← {m.msg_back()}</a>
	<h1>{data.otherName}</h1>
	<Thread
		messages={data.messages}
		meId={data.meId}
		names={data.names}
		note={data.parentsCanRead ? m.msg_parent_note() : ''}
		error={form && 'error' in form ? (form.error as string) : null}
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
	h1 {
		margin: 0;
	}
</style>
