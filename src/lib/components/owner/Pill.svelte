<script lang="ts">
	/** A status pill: ok (green), wait (amber), no (red) or info (blue). */
	let { tone = 'info', text }: { tone?: 'ok' | 'wait' | 'no' | 'info'; text: string } = $props();
</script>

<span class="oa-pill {tone === 'info' ? '' : tone}">{text}</span>
