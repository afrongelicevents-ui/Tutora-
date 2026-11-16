<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import ToolCard from '#lib/components/tools/ToolCard.svelte';
	import { shortcutUrl } from '#lib/tool-shortcuts.ts';
	let { data, form } = $props();
</script>

<svelte:head><title>{m.tools6_title()} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/student" aria-label={m.tools6_back()}>←</a>
	<h1>{m.tools6_title()}</h1>
	<p class="lead">{m.tl_intro_student()}</p>
	{#if form && 'saved' in form}<p class="notice" role="status">{m.saved()}</p>{/if}

	<ToolCard logo="teams" use={m.tl_meeting_use_student()} href={shortcutUrl('teams', 'student')} />
	<ToolCard logo="meet" use={m.tl_meeting_use_student()} href={shortcutUrl('meet', 'student')} />
	<ToolCard logo="zoom" use={m.tl_meeting_use_student()} href={shortcutUrl('zoom', 'student')} />
	<ToolCard logo="drive" use={m.tl_drive_use_student()} href={shortcutUrl('drive', 'student')} />

	<ToolCard
		logo="kahoot"
		use={m.tl_kahoot_use_student()}
		href={shortcutUrl('kahoot', 'student')}
		status={data.pref.kahootOn ? m.st_kahoot_on() : m.tools6_off()}
	>
		<form method="POST" action="?/kahoot">
			<input type="hidden" name="on" value={data.pref.kahootOn ? '0' : '1'} />
			{#if data.pref.kahootOn}
				<button class="disconnect" type="submit">{m.tools6_turn_off()}</button>
			{:else}
				<button class="btn btn-block" type="submit">{m.tools6_kahoot_cta_student()}</button>
			{/if}
		</form>
	</ToolCard>

	<p class="note">{m.tl_footer()}</p>
</div>
