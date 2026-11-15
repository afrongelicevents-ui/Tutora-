<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import LineIcon from '#lib/components/LineIcon.svelte';
	let { data } = $props();
	// the owner's own homepage photo (Owner → Homepage), else the family photo
	const photo = $derived(
		data.heroPhotoV ? `/hero-photo?v=${data.heroPhotoV}` : '/photos/family-study.webp'
	);
	const offers = [
		{ icon: 'search', tone: 'navy', t: m.home_o1_t(), b: m.home_o1_b(), href: '/tutors' },
		{ icon: 'calendar', tone: 'blue', t: m.home_o2_t(), b: m.home_o2_b(), href: null },
		{ icon: 'family', tone: 'green', t: m.home_o3_t(), b: m.home_o3_b(), href: null },
		{ icon: 'school', tone: 'amber', t: m.home_o4_t(), b: m.home_o4_b(), href: null }
	] as const;
</script>

<svelte:head>
	<title>Tutora · {m.v3_tagline()}</title>
	<meta name="description" content={m.v3_welcome_lead()} />
	<link rel="preload" as="image" href={photo} fetchpriority="high" />
</svelte:head>

<div class="home">
	<header class="top">
		<span class="brand">Tutora</span>
		<a class="signin" href="/login">{m.v3_sign_in()}</a>
	</header>

	<section class="hero">
		<img
			class="photo"
			src={photo}
			alt={m.v3_welcome_photo_alt()}
			width="612"
			height="408"
			fetchpriority="high"
		/>
		<div class="text">
			<h1>{data.heroTitle ?? m.v3_tagline()}</h1>
			<span class="underline" aria-hidden="true"></span>
			<p>{data.heroLead ?? m.v3_welcome_lead()}</p>
			<span class="pill"><LineIcon name="star" size={16} /> {m.home_pill()}</span>
		</div>
		<svg class="wave" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true"
			><path d="M0 22 C 110 44, 260 0, 400 18 L400 40 L0 40 Z" /></svg
		>
	</section>

	<div class="body">
		<div class="ctas">
			<a class="ui-btn big" href="/get-started">{m.v3_get_started()} →</a>
			<a class="ui-btn-soft big" href="/login">{m.v3_sign_in()}</a>
		</div>

		<h2 class="ui-serif">{m.home_offer_h()}</h2>
		<div class="offers">
			{#each offers as o (o.t)}
				<svelte:element this={o.href ? 'a' : 'div'} class="ui-card offer" href={o.href}>
					<span class="ui-ico {o.tone}"><LineIcon name={o.icon} size={22} /></span>
					<span><strong>{o.t}</strong><span class="small muted block">{o.b}</span></span>
				</svelte:element>
			{/each}
		</div>

		<div class="ui-card sky how">
			<span class="ui-ico blue"><LineIcon name="sun" size={22} /></span>
			<span
				><strong class="ui-serif">{m.home_how_h()}</strong><span class="small block"
					>{m.home_how_b()}</span
				></span
			>
			<a class="ui-btn-soft" href="/tutors">{m.home_browse()} →</a>
		</div>
	</div>
</div>

<style>
	.home {
		min-height: 100dvh;
		background: var(--snow);
		color: var(--navy);
	}
	.top {
		position: relative;
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 18px 22px 0;
		max-width: 1100px;
		margin: 0 auto;
	}
	.brand {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 1.9rem;
	}
	.signin {
		font-weight: 600;
		color: var(--navy);
		text-decoration: none;
		padding: 8px 14px;
		border-radius: 999px;
		background: #fff;
		border: 1px solid var(--border);
	}
	.hero {
		position: relative;
		overflow: hidden;
		margin-top: -60px;
		padding: 84px 22px 54px;
		background:
			radial-gradient(120% 90% at 100% 0%, #fdf3e2 0%, transparent 55%),
			linear-gradient(180deg, var(--ice) 0%, #f3f7fc 100%);
	}
	.photo {
		position: absolute;
		inset: 0 0 0 auto;
		width: 50%;
		height: 100%;
		object-fit: cover;
		object-position: 60% center;
		-webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 38%);
		mask-image: linear-gradient(90deg, transparent 0%, #000 38%);
	}
	.text {
		position: relative;
		max-width: 60%;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(2rem, 8vw, 3.4rem);
		line-height: 1.05;
		letter-spacing: -0.01em;
	}
	.underline {
		width: 120px;
		height: 3px;
		border-radius: 3px;
		background: #d9a441;
	}
	.hero p {
		margin: 0;
		font-size: 1rem;
		line-height: 1.45;
		opacity: 0.85;
	}
	.pill {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		border-radius: 999px;
		background: var(--navy);
		color: #fff;
		font-size: 0.875rem;
		font-weight: 600;
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
	.body {
		max-width: 1100px;
		margin: 0 auto;
		padding: 8px 22px 40px;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.ctas {
		display: grid;
		gap: 10px;
	}
	.big {
		min-height: 54px;
		justify-content: center;
		font-size: 1.05rem;
	}
	h2 {
		margin: 6px 0 0;
		font-size: 1.6rem;
	}
	.offers {
		display: grid;
		grid-template-columns: 1fr;
		gap: 12px;
	}
	.offer {
		display: flex;
		gap: 14px;
		align-items: flex-start;
		text-decoration: none;
		color: var(--navy);
	}
	.offer strong {
		font-size: 1.05rem;
	}
	.how {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 12px 14px;
		align-items: center;
	}
	.how .ui-btn-soft {
		grid-column: 1 / -1;
		justify-self: start;
	}
	@media (min-width: 600px) {
		.offers {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.ctas {
			grid-template-columns: repeat(2, minmax(0, 260px));
		}
	}
	@media (min-width: 900px) {
		.hero {
			padding: 120px max(22px, calc((100% - 1100px) / 2 + 22px)) 80px;
		}
		.photo {
			width: 48%;
		}
		.text {
			max-width: 48%;
		}
		.offers {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
		.offer {
			flex-direction: column;
		}
		.how {
			grid-template-columns: auto 1fr auto;
		}
		.how .ui-btn-soft {
			grid-column: auto;
		}
	}
</style>
