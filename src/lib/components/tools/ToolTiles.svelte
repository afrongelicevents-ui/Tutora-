<script lang="ts">
	// The four connected tools with their official logos and REAL status: Connected, Ready
	// (no account needed: students join with the tutor's link) or a Connect button.
	import { m } from '#lib/i18n.ts';
	import LineIcon from '#lib/components/LineIcon.svelte';
	import ToolLogo, { TOOL_NAME, type Tool } from './ToolLogo.svelte';
	let {
		tools
	}: {
		tools: {
			meet: boolean;
			teams: boolean;
			driveAvailable: boolean;
			drive: boolean;
			kahoot: boolean;
			driveConnectHref: string;
		};
	} = $props();
	const SHORT: Record<Tool, string> = {
		meet: 'Meet',
		teams: 'Teams',
		drive: 'Drive',
		kahoot: 'Kahoot!'
	};
	type Tile = { tool: Tool; state: 'connected' | 'ready' | 'connect' | 'soon'; href?: string };
	// "Not yet" when Tutora has no keys for that service: the same answer as on the tools pages
	const tiles = $derived<Tile[]>([
		{ tool: 'meet', state: tools.meet ? 'ready' : 'soon' },
		{ tool: 'teams', state: tools.teams ? 'ready' : 'soon' },
		tools.drive
			? { tool: 'drive', state: 'connected' }
			: tools.driveAvailable
				? { tool: 'drive', state: 'connect', href: tools.driveConnectHref }
				: { tool: 'drive', state: 'soon' },
		// Kahoot! has no account link: "on" only means quiz links are shown, so it is "Ready"
		tools.kahoot
			? { tool: 'kahoot', state: 'ready' }
			: { tool: 'kahoot', state: 'connect', href: '/student/tools#kahoot' }
	]);
</script>

<section class="tt-tools" aria-labelledby="tt-tools">
	<div class="sh">
		<h2 id="tt-tools">{m.tt_tools()}</h2>
		<a class="all" href="/student/tools">{m.tt_view_all()} <LineIcon name="chevron" size={16} /></a>
	</div>
	<ul class="tiles">
		{#each tiles as tl (tl.tool)}
			<li class="tile">
				<ToolLogo tool={tl.tool} size={40} />
				<span class="tn">{SHORT[tl.tool]}</span>
				{#if tl.state === 'connected'}
					<span class="st on">{m.tt_connected()}</span>
				{:else if tl.state === 'soon'}
					<span class="st" title={m.tools6_not_ready()}>{m.tt_soon()}</span>
				{:else if tl.state === 'ready'}
					<span class="st ready" title={m.tt_ready_hint()}>{m.tt_ready()}</span>
				{:else}
					<a
						class="st connect"
						href={tl.href}
						aria-label={`${tl.tool === 'kahoot' ? m.twofa_confirm() : m.tt_connect()} ${TOOL_NAME[tl.tool]}`}
						>{tl.tool === 'kahoot' ? m.twofa_confirm() : m.tt_connect()}</a
					>
				{/if}
			</li>
		{/each}
	</ul>
	<p class="hint">{m.tt_ready_hint()}</p>
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
	.st.on {
		background: var(--navy);
		color: #fff;
	}
	.st.ready {
		background: var(--ice);
		color: var(--navy);
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
