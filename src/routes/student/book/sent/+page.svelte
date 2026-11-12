<script lang="ts">
	import { m } from '#lib/i18n.ts';
	let { data } = $props();
</script>

<svelte:head><title>{m.bk3_sent()} · Tutora</title></svelte:head>

<div class="screen sent">
	<span class="eyebrow ok-t">{m.bk3_sent()}</span>
	<h1>{m.bk3_waiting({ name: data.tutorName ?? '' })}</h1>
	<p class="lead">
		{m.bk3_sent_lead()}
		{#if data.family}{m.bk3_sent_family()}{/if}
	</p>
	<a class="btn btn-block" href="/student/lessons">{m.bk3_see_lessons()}</a>
</div>

<style>
	.sent {
		padding-top: 30px;
	}
	.sent .eyebrow {
		color: var(--ok);
	}
</style>
