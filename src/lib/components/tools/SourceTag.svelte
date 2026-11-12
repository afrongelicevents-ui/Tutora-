<script lang="ts">
	// Where a file or link comes from: the official logo for Drive and Kahoot!, then the label.
	import ToolLogo from './ToolLogo.svelte';
	let { kind, label }: { kind: string; label: string } = $props();
</script>

<span class="srctag"
	>{#if kind === 'drive' || kind === 'kahoot'}<ToolLogo tool={kind} size={16} />{/if}{label}</span
>

<style>
	.srctag {
		display: inline-flex;
		align-items: center;
		gap: 2px;
	}
</style>
