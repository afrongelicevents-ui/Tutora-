<script lang="ts">
	/**
	 * "Share on WhatsApp" for an invoice or receipt: opens WhatsApp with a short summary and a
	 * link to the page in Tutora (which needs a login). No PDF and nothing private beyond the
	 * summary goes into the message.
	 */
	import { page } from '$app/state';
	import { m } from '#lib/i18n.ts';
	let { text, path, to = null }: { text: string; path: string; to?: string | null } = $props();
	const href = $derived(
		`https://wa.me/${to ?? ''}?text=${encodeURIComponent(`${text}\n${page.url.origin}${path}`)}`
	);
</script>

<a class="ui-btn-soft sm wa" {href} target="_blank" rel="noopener noreferrer" data-share-wa
	>{m.share_wa()}</a
>
