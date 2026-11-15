<script lang="ts">
	import LineIcon from '#lib/components/LineIcon.svelte';
	import { m } from '#lib/i18n.ts';
	import { fmtDayTime } from '#lib/tz.ts';
	let { data } = $props();
</script>

<svelte:head><title>{m.notif_title()} · Tutora</title></svelte:head>

<section class="wrap narrow look">
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
		<div class="ui-card sky look-empty">
			<span class="ui-ico blue"><LineIcon name="bell" size={22} /></span>
			<p class="empty">{m.notif_none()}</p>
		</div>
	{/each}
	<p><a href="/account">{m.notif_settings()}</a></p>
</section>

<style>
	.unread {
		border-left: 4px solid var(--ochre-400);
	}
</style>
