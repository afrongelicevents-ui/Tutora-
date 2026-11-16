<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import ToolCard from '#lib/components/tools/ToolCard.svelte';
	import { shortcutUrl } from '#lib/tool-shortcuts.ts';
	let { data, form } = $props();
</script>

<svelte:head><title>{m.tools6_title()} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/tutor/more" aria-label={m.tools6_back()}>←</a>
	<h1>{m.tools6_title()}</h1>
	<p class="lead">{m.tl_intro_tutor()}</p>
	{#if form && 'saved' in form}<p class="notice" role="status">{m.saved()}</p>{/if}

	<ToolCard logo="teams" use={m.tl_meeting_use_tutor()} href={shortcutUrl('teams', 'tutor')} />
	<ToolCard logo="meet" use={m.tl_meeting_use_tutor()} href={shortcutUrl('meet', 'tutor')} />
	<ToolCard logo="zoom" use={m.tl_meeting_use_tutor()} href={shortcutUrl('zoom', 'tutor')} />
	<p class="note tip">
		{m.tl_where_links()} <a href="/tutor/students">{m.tl_students_link()}</a>
		· {m.ml_tip()}
	</p>

	<ToolCard logo="drive" use={m.tl_drive_use_tutor()} href={shortcutUrl('drive', 'tutor')} />

	<ToolCard
		logo="kahoot"
		use={m.tl_kahoot_use_tutor()}
		href={shortcutUrl('kahoot', 'tutor')}
		status={data.pref.kahootOn ? m.tools6_on() : m.tools6_off()}
	>
		<form method="POST" action="?/kahoot">
			<input type="hidden" name="on" value={data.pref.kahootOn ? '0' : '1'} />
			{#if data.pref.kahootOn}
				<button class="disconnect" type="submit">{m.tools6_turn_off()}</button>
			{:else}
				<button class="btn btn-block" type="submit">{m.tools6_kahoot_cta_tutor()}</button>
			{/if}
		</form>
		{#if data.pref.kahootOn}
			<a class="btn btn-ghost btn-block" href="/tutor/tools/kahoot"
				>{m.tools6_kahoot_import_link()}</a
			>
			<p class="note">{m.tools6_kahoot_no_api()}</p>
		{/if}
	</ToolCard>

	<p class="note">{m.tl_footer()}</p>
</div>

<style>
	.tip {
		margin: -4px 0 4px;
	}
</style>
