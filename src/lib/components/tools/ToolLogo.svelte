<script lang="ts" module>
	/**
	 * The official logos of the connected tools, as published by each company (Google
	 * Workspace product logos, Microsoft Fluent brand icons, the Kahoot! press kit). Stored
	 * unchanged except for lossless SVG clean-up, in /static/brand. Never recolour, stretch or
	 * crop them: they are always shown whole (object-fit: contain) with clear space around.
	 */
	export type Tool = 'meet' | 'teams' | 'drive' | 'kahoot';
	export const TOOL_NAME: Record<Tool, string> = {
		meet: 'Google Meet',
		teams: 'Microsoft Teams',
		drive: 'Google Drive',
		kahoot: 'Kahoot!'
	};
	const FILE: Record<Tool, string> = {
		meet: '/brand/google-meet.svg',
		teams: '/brand/microsoft-teams.svg',
		drive: '/brand/google-drive.svg',
		kahoot: '/brand/kahoot.svg'
	};
</script>

<script lang="ts">
	let {
		tool,
		size = 32,
		label = false,
		chip = false
	}: {
		tool: Tool;
		size?: number;
		/** show the tool's name next to the logo */
		label?: boolean;
		/** on a white rounded tile (for dark backgrounds) */
		chip?: boolean;
	} = $props();
</script>

<span class="tl" class:chip style="--s:{size}px">
	<img
		src={FILE[tool]}
		alt={label ? '' : TOOL_NAME[tool]}
		width={size}
		height={size}
		loading="lazy"
		decoding="async"
	/>{#if label}<span class="name">{TOOL_NAME[tool]}</span>{/if}
</span>

<style>
	.tl {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		vertical-align: middle;
	}
	img {
		width: var(--s);
		height: var(--s);
		/* the logo's own clear space: never cropped or stretched */
		padding: calc(var(--s) * 0.12);
		box-sizing: content-box;
		object-fit: contain;
		flex: none;
	}
	.chip img {
		background: #fff;
		border-radius: 10px;
	}
	.name {
		font-weight: 600;
	}
</style>
