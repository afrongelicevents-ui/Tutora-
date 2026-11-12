<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import ToolCard from '#lib/components/tools/ToolCard.svelte';
	let { data, form } = $props();
	const c = $derived(data.conn);
	const err = $derived(
		(form && 'error' in form ? (form.error as string) : null) ?? data.flashError
	);
	const tools = $derived([
		{ v: 'room', label: m.tools6_room(), ok: true },
		{ v: 'meet', label: 'Google Meet', ok: c.meet },
		{ v: 'teams', label: 'Microsoft Teams', ok: c.teams }
	]);
</script>

<svelte:head><title>{m.tools6_title()} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/tutor/more" aria-label={m.tools6_back()}>←</a>
	<h1>{m.tools6_title()}</h1>
	<p class="lead">{m.tools6_intro_tutor()}</p>
	{#if err}<p class="alert" role="alert">{t(err)}</p>{/if}
	{#if data.flashConnected && !err}<p class="notice" role="status">
			{m.tools6_now_connected()}
		</p>{/if}
	{#if form && 'saved' in form}<p class="notice" role="status">{m.saved()}</p>{/if}

	<ToolCard
		name="Google Meet"
		logo="meet"
		on={c.meet}
		use={m.tools6_meet_use_tutor()}
		access={c.meet ? m.tools6_meet_access_tutor() : undefined}
	>
		{#if c.google}
			<p class="note">{m.tools6_as({ email: c.google.email ?? 'Google' })}</p>
			{#if !c.meet}<p class="note">{m.tools6_meet_missing()}</p>
				<a class="btn btn-block" href="/tools/connect/google">{m.tools6_reconnect_google()}</a>{/if}
			<form method="POST" action="?/disconnect">
				<input type="hidden" name="provider" value="google" />
				<button class="disconnect" type="submit">{m.tools6_disconnect_google()}</button>
			</form>
		{:else if data.ready.google}
			<a class="btn btn-block" href="/tools/connect/google">{m.tools6_connect_google()}</a>
		{:else}
			<p class="note">{m.tools6_not_ready()}</p>
		{/if}
	</ToolCard>

	<ToolCard
		name="Microsoft Teams"
		logo="teams"
		on={c.teams}
		use={m.tools6_teams_use_tutor()}
		access={c.teams ? m.tools6_teams_access_tutor() : undefined}
	>
		<p class="note">{m.tools6_teams_work_school()}</p>
		{#if c.microsoft}
			<p class="note">{m.tools6_as({ email: c.microsoft.email ?? 'Microsoft' })}</p>
			<form method="POST" action="?/disconnect">
				<input type="hidden" name="provider" value="microsoft" />
				<button class="disconnect" type="submit">{m.tools6_disconnect()}</button>
			</form>
			<p class="note">{m.tools6_ms_remove_note()}</p>
		{:else if data.ready.microsoft}
			<a class="btn btn-block" href="/tools/connect/microsoft">{m.tools6_connect_microsoft()}</a>
		{:else}
			<p class="note">{m.tools6_not_ready()}</p>
		{/if}
	</ToolCard>

	<ToolCard
		name="Google Drive"
		logo="drive"
		on={c.drive}
		use={m.tools6_drive_use_tutor()}
		access={c.drive ? m.tools6_drive_access() : undefined}
	>
		{#if c.google}
			{#if !c.drive}<a class="btn btn-block" href="/tools/connect/google"
					>{m.tools6_reconnect_google()}</a
				>{/if}
			<form method="POST" action="?/disconnect">
				<input type="hidden" name="provider" value="google" />
				<button class="disconnect" type="submit">{m.tools6_disconnect_google()}</button>
			</form>
		{:else if data.ready.google}
			<a class="btn btn-block" href="/tools/connect/google">{m.tools6_connect_drive()}</a>
		{:else}
			<p class="note">{m.tools6_not_ready()}</p>
		{/if}
	</ToolCard>

	<ToolCard
		name="Kahoot!"
		logo="kahoot"
		on={data.pref.kahootOn}
		status={data.pref.kahootOn ? m.tools6_on() : m.tools6_off()}
		use={m.tools6_kahoot_use_tutor()}
		access={data.pref.kahootOn ? m.tools6_kahoot_access() : undefined}
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

	<section class="how">
		<div class="section-h"><h2>{m.tools6_how_title()}</h2></div>
		<form method="POST" action="?/meeting" class="stack">
			<fieldset class="chips">
				<legend class="small muted">{m.tools6_how_lead()}</legend>
				{#each tools as o (o.v)}
					<label class="chip" class:dim={!o.ok}>
						<input
							type="radio"
							name="tool"
							value={o.v}
							checked={data.pref.meetingTool === o.v}
							disabled={!o.ok}
						/>
						{o.label}
					</label>
				{/each}
			</fieldset>
			{#if !c.meet || !c.teams}<p class="note">{m.tools6_how_connect_first()}</p>{/if}
			<button class="btn btn-ghost btn-sm" type="submit">{m.tools6_save()}</button>
		</form>
		<p class="note">{m.tools6_how_fallback()}</p>
	</section>

	<p class="note">{m.tools6_footer()}</p>
</div>

<style>
	.how {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 8px;
	}
	fieldset {
		border: none;
		padding: 0;
		margin: 0;
	}
	legend {
		margin-bottom: 8px;
	}
	.dim {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: 10px;
		align-items: flex-start;
	}
</style>
