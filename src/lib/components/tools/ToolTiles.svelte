<script lang="ts">
	// Shortcuts to the tools students already use: each tile just opens the app or website.
	// Nothing is connected or synced (no accounts, no API keys).
	import { m } from '#lib/i18n.ts';
	import LineIcon from '#lib/components/LineIcon.svelte';
	import ToolLogo, { TOOL_NAME, type Tool } from './ToolLogo.svelte';
	import { shortcutUrl } from '#lib/tool-shortcuts.ts';
	const SHORT: Record<Tool, string> = {
		meet: 'Meet',
		teams: 'Teams',
		drive: 'Drive',
		kahoot: 'Kahoot!',
		zoom: 'Zoom'
	};
	const TILES: Tool[] = ['teams', 'meet', 'drive', 'kahoot'];
</script>

<section class="tt-tools" aria-labelledby="tt-tools">
	<div class="sh">
		<h2 id="tt-tools">{m.tt_tools()}</h2>
		<a class="all" href="/student/tools">{m.tt_view_all()} <LineIcon name="chevron" size={16} /></a>
	</div>
	<ul class="tiles">
		{#each TILES as tool (tool)}
			<li class="tile">
				<ToolLogo {tool} size={40} />
				<span class="tn">{SHORT[tool]}</span>
				<a
					class="st connect"
					href={shortcutUrl(tool, 'student')}
					target="_blank"
					rel="noopener noreferrer"
					aria-label={m.tl_open({ tool: TOOL_NAME[tool] })}>{m.tl_open_short()}</a
				>
			</li>
		{/each}
	</ul>
	<p class="hint">{m.tl_tiles_hint()}</p>
</section>

<style>
	.tt-tools {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.sh {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.sh h2 {
		margin: 0;
		font-size: 1.5rem;
		color: var(--navy);
	}
	.all {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--navy);
		font-weight: 600;
		text-decoration: none;
		padding: 8px 0;
	}
	.tiles {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 8px;
	}
	.tile {
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 18px;
		padding: 12px 4px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		text-align: center;
		min-width: 0;
	}
	.tn {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--navy);
		line-height: 1.2;
	}
	.st {
		font-size: 0.75rem;
		font-weight: 700;
		border-radius: 99px;
		padding: 6px 8px;
		width: 100%;
		max-width: 92px;
		box-sizing: border-box;
	}
	.st.connect {
		border: 1.5px solid var(--navy);
		color: var(--navy);
		text-decoration: none;
		min-height: 32px;
		display: grid;
		place-items: center;
	}
	.hint {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--muted);
	}
</style>
