<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import InstallSteps from './InstallSteps.svelte';
	/**
	 * "Install Tutora" in the account menu, for every role. /pwa.js shows the button when
	 * the phone can install, the written steps when it can't, and hides it all once the app
	 * is installed. Without JavaScript the written steps show.
	 */
</script>

<section class="ui-card ins-item" data-install-item aria-labelledby="ins-item-h">
	<img src="/icons/icon-96.png" alt="" width="44" height="44" />
	<div>
		<h2 id="ins-item-h" class="ui-serif">{m.pwa_install()}</h2>
		<p>{m.pwa_item_p()}</p>
		<button type="button" class="ui-btn sm" data-install-btn hidden>{m.pwa_install()}</button>
		<div class="help small" data-install-help>
			<p><strong>{m.pwa_android()}</strong> {m.pwa_android_steps()}</p>
			<p><strong>{m.pwa_iphone()}</strong> {m.pwa_iphone_steps()}</p>
		</div>
	</div>
</section>
<InstallSteps />

<style>
	.ins-item {
		display: flex;
		gap: 14px;
		align-items: flex-start;
	}
	:global(.ins-item[hidden]),
	:global(.ins-item [data-install-btn][hidden]),
	:global(.ins-item .help[hidden]) {
		display: none;
	}
	img {
		flex: none;
		border-radius: 12px;
	}
	h2 {
		margin: 0 0 4px;
		font-size: 1.1rem;
	}
	p {
		margin: 0 0 10px;
		line-height: 1.45;
		color: var(--muted);
	}
	.help p {
		margin: 0 0 6px;
	}
</style>
