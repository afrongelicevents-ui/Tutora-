<script lang="ts">
	/** The result of the last action: an error (from the form) or "Done" (from ?done=). */
	import { t } from '#lib/i18n.ts';
	let { error = null, done = null }: { error?: string | null; done?: string | null } = $props();
</script>

{#if error}<p class="alert" role="alert">{t(error)}</p>{/if}
{#if done && !error}<p class="notice" role="status">{t(done)}</p>{/if}
