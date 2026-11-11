<script lang="ts">
	import { m } from '#lib/i18n.ts';
	let { data } = $props();
	const initials = (n: string) =>
		n
			.split(/\s+/)
			.map((x) => x[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	const c = $derived(data.content);
</script>

<svelte:head>
	<title>Tutora · {m.home2_title()}</title>
	<meta name="description" content={m.home2_meta()} />
	{#if c.heroPhotoV}<link
			rel="preload"
			as="image"
			href="/hero-photo?v={c.heroPhotoV}"
			fetchpriority="high"
		/>{/if}
</svelte:head>

<section class="hero" class:has-photo={!!c.heroPhotoV}>
	{#if c.heroPhotoV}
		<img
			class="hero-img"
			src="/hero-photo?v={c.heroPhotoV}"
			alt=""
			width="480"
			height="600"
			fetchpriority="high"
		/>
	{/if}
	<div class="wrap hero-text">
		<h1>{c.heroTitle || m.home2_title()}</h1>
		<p class="lead">{c.heroLead || m.home3_lead()}</p>
		<a class="btn pill" href="/tutors">{m.find_a_tutor()} <span aria-hidden="true">→</span></a>
	</div>
</section>

<section class="wrap" id="how">
	<h2 class="big">{m.home2_how()}</h2>
	<ol class="steps">
		<li>
			<span class="num">01</span><b>{m.home2_step1_t()}</b><span class="small muted"
				>{m.home3_step1()}</span
			>
		</li>
		<li>
			<span class="num">02</span><b>{m.home3_step2_t()}</b><span class="small muted"
				>{m.home3_step2()}</span
			>
		</li>
		<li>
			<span class="num">03</span><b>{m.home3_step3_t()}</b><span class="small muted"
				>{m.home3_step3()}</span
			>
		</li>
	</ol>
</section>

{#if data.tutors.length}
	<section class="wrap">
		<div class="row head">
			<h2 class="big grow">{m.home3_popular()}</h2>
			<a class="more" href="/tutors">{m.home3_view_all()} <span aria-hidden="true">→</span></a>
		</div>
		<div class="cards">
			{#each data.tutors as tu (tu.slug)}
				<a class="tcard" href="/t/{tu.slug}">
					{#if tu.hasPhoto}<img
							src="/t/{tu.slug}/photo?v={tu.photoVersion}"
							alt=""
							width="240"
							height="200"
							loading="lazy"
						/>{:else}<span class="ph" aria-hidden="true">{initials(tu.name)}</span>{/if}
					<span class="tbody">
						<b>{tu.name}</b>
						<span class="small muted"
							>{[tu.subjects[0], tu.town?.split('(')[0].trim()].filter(Boolean).join(' · ')}</span
						>
						{#if tu.rating}
							<span class="small"
								><span class="star" aria-hidden="true">★</span>
								<b>{tu.rating.toFixed(1)}</b>
								{#if tu.lessonCount}<span class="muted"
										>({m.home3_lessons({ n: tu.lessonCount })})</span
									>{/if}</span
							>
						{/if}
					</span>
				</a>
			{/each}
		</div>
	</section>
{/if}

<section class="wrap">
	<div class="join">
		<h2 class="big">{m.home2_are_you_tutor()}</h2>
		<p>{c.joinLead || m.home3_join_lead()}</p>
		<a class="btn pill light" href="/join">{m.join_cta()} <span aria-hidden="true">→</span></a>
	</div>
</section>

<style>
	.hero {
		position: relative;
		overflow: hidden;
		padding: 28px 0 32px;
		margin-bottom: 8px;
		border-radius: 0 0 40% 0 / 0 0 24px 0;
	}
	.hero.has-photo {
		min-height: 520px;
	}
	.hero-img {
		position: absolute;
		top: 0;
		right: 0;
		width: 62%;
		height: 100%;
		object-fit: cover;
		object-position: 60% 30%;
		-webkit-mask-image: linear-gradient(to right, transparent 0, #000 35%);
		mask-image: linear-gradient(to right, transparent 0, #000 35%);
	}
	.hero-text {
		position: relative;
	}
	.has-photo .hero-text h1,
	.has-photo .hero-text .lead {
		max-width: 62%;
	}
	h1 {
		font-size: clamp(2.4rem, 11vw, 3.6rem);
		line-height: 1.05;
		margin: 24px 0 16px;
	}
	.lead {
		font-size: 1.15rem;
		margin: 0 0 24px;
	}
	.pill {
		border-radius: 999px;
		padding: 0 28px;
		min-height: 56px;
		font-size: 1.1rem;
		line-height: 1.2;
		padding-top: 2px;
	}
	.big {
		font-size: clamp(1.9rem, 8vw, 2.4rem);
		margin-top: 28px;
	}
	.steps {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.steps li {
		display: grid;
		gap: 6px;
		align-content: start;
		padding: 0 10px;
		border-left: 1px solid var(--line);
		overflow-wrap: anywhere;
	}
	.steps li:first-child {
		padding-left: 0;
		border-left: 0;
	}
	.num {
		font-family: var(--font-display);
		font-size: 1.9rem;
		color: var(--green-700);
		line-height: 1;
	}
	.head {
		align-items: baseline;
	}
	.more {
		font-weight: 700;
		text-decoration: none;
		white-space: nowrap;
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
	}
	.tcard {
		display: grid;
		grid-template-rows: auto 1fr;
		background: var(--card);
		border-radius: 16px;
		overflow: hidden;
		text-decoration: none;
		color: inherit;
		box-shadow: 0 2px 10px rgb(28 38 32 / 0.06);
	}
	.tcard img,
	.ph {
		width: 100%;
		aspect-ratio: 6 / 5;
		object-fit: cover;
		background: var(--mint-50);
	}
	.ph {
		display: grid;
		place-items: center;
		font-family: var(--font-display);
		font-size: 2rem;
		color: var(--green-700);
	}
	.tbody {
		display: grid;
		gap: 4px;
		align-content: start;
		padding: 10px 10px 12px;
		font-size: 0.95rem;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.star {
		color: var(--ochre-400);
	}
	.join {
		margin: 32px 0 8px;
		background: var(--green-900);
		color: var(--paper-50);
		border-radius: 20px;
		padding: 28px 24px;
		background-image: radial-gradient(
			circle at 110% 120%,
			rgb(255 255 255 / 0.07) 0 45%,
			transparent 46%
		);
	}
	.join h2 {
		color: var(--paper-50);
		margin-top: 0;
	}
	.join p {
		font-size: 1.1rem;
	}
	.light {
		background: var(--paper-50);
		color: var(--green-900);
		border-color: var(--paper-50);
	}
	.light:hover {
		background: var(--white);
		color: var(--green-900);
	}
</style>
