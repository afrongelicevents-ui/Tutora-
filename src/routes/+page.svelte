<script lang="ts">
	import { m } from '#lib/i18n.ts';
	let { data } = $props();
	const photo = $derived(data.heroPhotoV ? `/hero-photo?v=${data.heroPhotoV}` : '/hero.webp');
</script>

<svelte:head>
	<title>Tutora · {m.v3_tagline()}</title>
	<meta name="description" content={m.v3_welcome_lead()} />
	<link rel="preload" as="image" href={photo} fetchpriority="high" />
</svelte:head>

<div class="welcome">
	<div class="photo">
		<img src={photo} alt={m.v3_welcome_photo_alt()} width="900" height="571" fetchpriority="high" />
		<div class="fade" aria-hidden="true"></div>
	</div>
	<div class="brand">Tutora</div>
	<div class="text">
		<h1>{m.v3_tagline()}</h1>
		<p>{m.v3_welcome_lead()}</p>
		<a class="btn btn-block light" href="/get-started">{m.v3_get_started()}</a>
		<a class="btn btn-block outline" href="/login">{m.v3_sign_in()}</a>
	</div>
</div>

<style>
	.welcome {
		position: relative;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		background: var(--plum);
		color: var(--ivory);
		overflow: hidden;
	}
	.photo {
		position: absolute;
		inset: 0 0 auto 0;
		height: 62dvh;
		min-height: 400px;
	}
	.photo img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 30% center;
	}
	/* the only gradient in Tutora: the welcome photo fading into plum */
	.fade {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			180deg,
			rgba(59, 19, 64, 0.15) 0%,
			rgba(59, 19, 64, 0.55) 55%,
			#3b1340 100%
		);
	}
	.brand {
		position: relative;
		padding: 22px 24px 0;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 2.125rem;
	}
	.text {
		position: relative;
		margin-top: auto;
		padding: 0 24px 30px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		max-width: 520px;
	}
	h1 {
		margin: 0;
		font-size: 2.5rem;
		line-height: 1.05;
		color: var(--ivory);
	}
	p {
		margin: 0;
		font-size: 1rem;
		line-height: 1.5;
		color: #e6d8ea;
	}
	.light {
		margin-top: 8px;
		background: var(--ivory);
		border-color: var(--ivory);
		color: var(--plum);
		min-height: 54px;
	}
	.light:hover {
		background: #fff;
		color: var(--plum);
	}
	.outline {
		background: transparent;
		color: var(--ivory);
		border: 1.5px solid rgba(251, 247, 243, 0.5);
	}
	.outline:hover {
		background: rgba(251, 247, 243, 0.08);
		color: var(--ivory);
	}
	@media (min-width: 900px) {
		.welcome {
			display: grid;
			grid-template-columns: 1.1fr 1fr;
		}
		.photo {
			position: relative;
			height: 100dvh;
			grid-row: 1 / span 2;
		}
		.fade {
			background: linear-gradient(90deg, rgba(59, 19, 64, 0) 60%, #3b1340 100%);
		}
		.brand {
			grid-column: 2;
			padding: 40px 56px 0;
		}
		.text {
			grid-column: 2;
			padding: 0 56px 64px;
			align-self: end;
		}
		h1 {
			font-size: 3.25rem;
		}
	}
</style>
