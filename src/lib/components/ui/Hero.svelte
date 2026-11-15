<script lang="ts">
	import type { Snippet } from 'svelte';
	/**
	 * Page header in the shared style (any area): soft light-blue/cream wave, serif title
	 * with a gold underline, optional lead text, optional badge (snippet), optional photo on
	 * the right (pass a real, compressed photo URL or nothing: never stock or made-up images),
	 * `dark` for the navy version. Bleeds to the screen edges on phones inside `.screen`.
	 * Example: <Hero title="Progress" lead="…" photo={url} />
	 */
	let {
		title,
		lead = '',
		photo = null,
		photoAlt = '',
		photoWidth = 612,
		photoHeight = 408,
		/** the first thing on the page: load it at once (else lazily) */
		eager = true,
		dark = false,
		badge,
		children
	}: {
		title: string;
		lead?: string;
		photo?: string | null;
		/** plain-words description of the photo ('' when it is only decoration) */
		photoAlt?: string;
		photoWidth?: number;
		photoHeight?: number;
		eager?: boolean;
		/** the navy version (School+ active) */
		dark?: boolean;
		badge?: Snippet;
		children?: Snippet;
	} = $props();
</script>

<header class="phero" class:dark class:has-photo={!!photo}>
	{#if photo}<img
			class="photo"
			src={photo}
			alt={photoAlt}
			width={photoWidth}
			height={photoHeight}
			loading={eager ? 'eager' : 'lazy'}
			fetchpriority={eager ? 'high' : 'auto'}
			decoding="async"
		/>{/if}
	<div class="text">
		{#if badge}<div class="badge">{@render badge()}</div>{/if}
		<h1>{title}</h1>
		<span class="underline" aria-hidden="true"></span>
		{#if lead}<p>{lead}</p>{/if}
		{@render children?.()}
	</div>
	<svg class="wave" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true"
		><path d="M0 22 C 110 44, 260 0, 400 18 L400 40 L0 40 Z" /></svg
	>
</header>

<style>
	.phero {
		position: relative;
		overflow: hidden;
		/* bleeds to the screen edges on phones (.screen has 18px / 22px padding) */
		margin: -18px -22px 0;
		padding: 22px 22px 40px;
		background:
			radial-gradient(120% 90% at 100% 0%, #fdf3e2 0%, transparent 55%),
			linear-gradient(180deg, var(--ice) 0%, #f3f7fc 100%);
		color: var(--navy);
	}
	.phero.dark {
		background: linear-gradient(135deg, var(--navy) 0%, #12365f 100%);
		color: #fff;
	}
	.phero.dark h1 {
		color: #fff;
	}
	.phero.dark .photo {
		opacity: 0.85;
	}
	.photo {
		position: absolute;
		inset: 0 0 0 auto;
		width: 52%;
		height: 100%;
		object-fit: cover;
		-webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 35%);
		mask-image: linear-gradient(90deg, transparent 0%, #000 35%);
	}
	.text {
		position: relative;
		max-width: 60ch;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.has-photo .text {
		max-width: 58%;
	}
	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.75rem, 6vw, 2.4rem);
		line-height: 1.1;
		letter-spacing: -0.01em;
	}
	.underline {
		width: 120px;
		height: 3px;
		border-radius: 3px;
		background: #d9a441;
	}
	p {
		margin: 0;
		font-size: 1rem;
		line-height: 1.45;
		color: inherit;
		opacity: 0.85;
	}
	.badge {
		align-self: flex-start;
	}
	.wave {
		position: absolute;
		left: 0;
		right: 0;
		bottom: -1px;
		width: 100%;
		height: 34px;
	}
	.wave path {
		fill: var(--snow);
	}
	@media (min-width: 900px) {
		.phero {
			margin: 0 0 var(--space-2);
			border-radius: var(--radius-lg);
			padding: 32px 32px 52px;
		}
	}
</style>
