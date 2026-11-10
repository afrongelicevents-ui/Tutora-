<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { waLink } from '#lib/whatsapp.ts';

	let { phone }: { phone: string } = $props();
</script>

<a
	class="wa"
	href={waLink(phone, m.whatsapp_prefill())}
	target="_blank"
	rel="noopener noreferrer"
	aria-label={m.whatsapp_label()}
>
	<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<path
			d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"
			stroke="currentColor"
			stroke-width="2"
			stroke-linejoin="round"
		/>
	</svg>
	<span>{m.whatsapp_button()}</span>
</a>

<style>
	.wa {
		position: fixed;
		right: 16px;
		bottom: max(20px, env(safe-area-inset-bottom));
		z-index: 10;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 52px;
		padding: 0 20px 0 16px;
		border-radius: 999px;
		background: var(--green-700);
		color: var(--paper-50);
		font-weight: 700;
		text-decoration: none;
		box-shadow: 0 4px 12px rgb(0 0 0 / 0.2);
	}
	.wa:hover {
		background: var(--green-900);
		color: var(--paper-50);
	}
</style>
