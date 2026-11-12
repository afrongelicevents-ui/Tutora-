<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import ToolCard from '#lib/components/tools/ToolCard.svelte';
	let { data, form } = $props();
	const err = $derived(
		(form && 'error' in form ? (form.error as string) : null) ?? data.flashError
	);
</script>

<svelte:head><title>{m.tools6_title()} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/student" aria-label={m.tools6_back()}>←</a>
	<h1>{m.tools6_title()}</h1>
	<p class="lead">{m.tools6_intro_student()}</p>
	{#if err}<p class="alert" role="alert">{t(err)}</p>{/if}
	{#if data.flashConnected && !err}<p class="notice" role="status">
			{m.tools6_now_connected()}
		</p>{/if}

	<ToolCard
		name="Google Meet"
		logo="meet"
		on={true}
		status={m.tools6_no_account()}
		use={m.tools6_meet_use_student()}
		access={m.tools6_links_only()}
	/>

	<ToolCard
		name="Microsoft Teams"
		logo="teams"
		on={true}
		status={m.tools6_no_account()}
		use={m.tools6_teams_use_student()}
		access={m.tools6_links_only()}
	/>

	<ToolCard
		name="Google Drive"
		logo="drive"
		on={data.drive}
		use={m.tools6_drive_use_student()}
		access={data.drive ? m.tools6_drive_access() : undefined}
	>
		{#if data.googleConnected}
			{#if data.driveEmail}<p class="note">{m.tools6_as({ email: data.driveEmail })}</p>{/if}
			<form method="POST" action="?/disconnect">
				<button class="disconnect" type="submit">{m.tools6_disconnect()}</button>
			</form>
		{:else if !data.ready}
			<p class="note">{m.tools6_not_ready()}</p>
		{:else if !data.allowed}
			<p class="note">{m.tools6_err_guardian()}</p>
		{:else}
			<a class="btn btn-block" href="/tools/connect/google">{m.tools6_connect_drive()}</a>
		{/if}
	</ToolCard>

	<ToolCard
		name="Kahoot!"
		logo="kahoot"
		on={data.pref.kahootOn}
		status={data.pref.kahootOn ? m.tools6_on() : m.tools6_off()}
		use={m.tools6_kahoot_use_student()}
		access={data.pref.kahootOn ? m.tools6_kahoot_access() : undefined}
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

	<p class="note">{m.tools6_footer()}</p>
</div>
