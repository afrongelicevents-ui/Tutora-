<script lang="ts">
	/** The small "Pro" label next to a Tutora Pro feature. */
	import { m } from '#lib/i18n.ts';
</script>

<span class="ui-pill pro-pill">{m.pro_pill()}</span>

<style>
	.pro-pill {
		background: linear-gradient(135deg, #0b2545, #1f5fa8);
		color: #fff;
		font-weight: 700;
		letter-spacing: 0.02em;
	}
</style>
