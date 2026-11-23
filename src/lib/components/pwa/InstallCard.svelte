<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import InstallSteps from './InstallSteps.svelte';
	/**
	 * "Install Tutora" on the person's home page. Hidden until /pwa.js knows this phone can
	 * install; shown once, then never again on this phone (closing or installing remembers it).
	 */
</script>

<aside class="ins-card" data-install-card hidden aria-labelledby="ins-card-h">
	<img src="/icons/icon-96.png" alt="" width="48" height="48" />
	<div class="ins-text">
		<h2 id="ins-card-h" class="ui-serif">{m.pwa_card_h()}</h2>
		<p>{m.pwa_card_p()}</p>
		<button type="button" class="ui-btn sm" data-install-btn>{m.pwa_install()}</button>
	</div>
	<button type="button" class="ins-x" data-install-close aria-label={m.pwa_not_now()}>×</button>
</aside>
<InstallSteps />

<style>
	.ins-card {
		position: relative;
		display: flex;
		gap: 14px;
		align-items: flex-start;
		margin: 0 0 18px;
		padding: 16px 44px 16px 16px;
		border-radius: 20px;
		background: rgba(255, 255, 255, 0.78);
		border: 1px solid rgba(255, 255, 255, 0.95);
		box-shadow: 0 10px 30px rgba(11, 37, 69, 0.1);
		backdrop-filter: blur(12px);
	}
	.ins-card[hidden] {
		display: none;
	}
	img {
		flex: none;
		border-radius: 12px;
	}
	h2 {
		margin: 2px 0 4px;
		font-size: 1.05rem;
		color: var(--navy);
	}
	p {
		margin: 0 0 10px;
		font-size: 0.9rem;
		line-height: 1.45;
		color: var(--muted);
	}
	.ins-x {
		position: absolute;
		top: 8px;
		right: 8px;
		width: 34px;
		height: 34px;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: var(--muted);
		font-size: 1.4rem;
		line-height: 1;
		cursor: pointer;
	}
	.ins-x:hover {
		background: var(--ice);
	}
</style>
