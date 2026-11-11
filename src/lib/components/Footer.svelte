<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { formatZwPhone } from '#lib/whatsapp.ts';

	let { whatsapp }: { whatsapp: string | null } = $props();
</script>

<footer>
	<div class="wrap">
		<p class="small muted">
			<a href="/privacy">{m.footer_privacy()}</a> ·
			<a href="/terms">{m.footer_terms()}</a> ·
			<a href="/contact">{m.footer_contact()}</a>{#if whatsapp}
				· WhatsApp {formatZwPhone(whatsapp)}{/if}
		</p>
	</div>
</footer>

<style>
	footer {
		border-top: 1px solid var(--line);
		padding: 24px 0 96px;
	}
	footer a {
		display: inline-block;
		padding: 12px 0;
	}
</style>
