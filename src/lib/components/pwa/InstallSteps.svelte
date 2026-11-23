<script lang="ts">
	import { m } from '#lib/i18n.ts';
	/** iPhone / iPad: there is no install prompt, so show the two taps in a small sheet. */
</script>

<dialog class="ins-sheet" data-install-ios aria-labelledby="ins-ios-h">
	<h2 id="ins-ios-h" class="ui-serif">{m.pwa_ios_h()}</h2>
	<ol>
		<li>
			<span class="ins-ico" aria-hidden="true">
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><path d="M12 3v12" /><path d="m8 7 4-4 4 4" /><path
						d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"
					/></svg
				>
			</span>
			{m.pwa_ios_1()}
		</li>
		<li>
			<span class="ins-ico" aria-hidden="true">
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8v8" /><path
						d="M8 12h8"
					/></svg
				>
			</span>
			{m.pwa_ios_2()}
		</li>
	</ol>
	<button type="button" class="ui-btn sm" data-install-ios-close>{m.pwa_ok()}</button>
</dialog>

<style>
	.ins-sheet {
		width: min(400px, calc(100% - 32px));
		border: 0;
		border-radius: 22px;
		padding: 24px 22px;
		color: var(--navy);
		background: #fff;
		box-shadow: 0 24px 60px rgba(11, 37, 69, 0.25);
	}
	.ins-sheet::backdrop {
		background: rgba(11, 37, 69, 0.45);
	}
	h2 {
		margin: 0 0 12px;
		font-size: 1.25rem;
	}
	ol {
		margin: 0 0 18px;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 12px;
	}
	li {
		display: flex;
		align-items: center;
		gap: 12px;
		line-height: 1.4;
	}
	.ins-ico {
		flex: none;
		width: 38px;
		height: 38px;
		display: grid;
		place-items: center;
		border-radius: 12px;
		background: var(--ice);
		color: var(--ocean);
	}
</style>
