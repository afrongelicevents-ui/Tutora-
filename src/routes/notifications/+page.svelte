<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { fmtDayTime } from '#lib/tz.ts';
	let { data } = $props();
</script>

<svelte:head><title>{m.notif_title()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<h1>{m.notif_title()}</h1>
	{#each data.list as n (n.id)}
		<div class="card" class:unread={n.unread}>
			<b>{n.title}</b>
			<p class="small">{n.body}</p>
			<p class="small muted">
				{fmtDayTime(n.createdAt)}{#if n.link}
					· <a href={n.link}>{m.notif_open()}</a>{/if}
			</p>
		</div>
	{:else}
		<p class="empty">{m.notif_none()}</p>
	{/each}
	<p><a href="/account">{m.notif_settings()}</a></p>
</section>

<style>
	.unread {
		border-left: 4px solid var(--rose-400);
	}
</style>
