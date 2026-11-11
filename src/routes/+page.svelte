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
	<link
		rel="preload"
		as="image"
		href={c.heroPhotoV ? `/hero-photo?v=${c.heroPhotoV}` : '/hero.webp'}
		fetchpriority="high"
	/>
</svelte:head>

<section class="hero">
	<img
		class="hero-img"
		src={c.heroPhotoV ? `/hero-photo?v=${c.heroPhotoV}` : '/hero.webp'}
		alt=""
		width="900"
		height="571"
		fetchpriority="high"
	/>
	<div class="wrap hero-text">
		<h1>{c.heroTitle || m.home2_title()}</h1>
		<p class="lead">{c.heroLead || m.home3_lead()}</p>
		<a class="btn hero-btn" href="/tutors">{m.find_a_tutor()} <span aria-hidden="true">→</span></a>
	</div>
</section>

<section class="wrap" id="how">
	<h2 class="sec">{m.home2_how()}</h2>
	<ol class="steps">
		<li>
			<span class="num">01</span><b>{m.home2_step1_t()}</b><span class="desc"
				>{m.home3_step1()}</span
			>
		</li>
		<li>
			<span class="num">02</span><b>{m.home3_step2_t()}</b><span class="desc"
				>{m.home3_step2()}</span
			>
		</li>
		<li>
			<span class="num">03</span><b>{m.home3_step3_t()}</b><span class="desc"
				>{m.home3_step3()}</span
			>
		</li>
	</ol>
</section>

{#if data.tutors.length}
	<section class="wrap">
		<div class="head">
			<h2 class="sec">{m.home3_popular()}</h2>
			<a class="more" href="/tutors">{m.home3_view_all()} <span aria-hidden="true">→</span></a>
		</div>
		<div class="cards">
			{#each data.tutors as tu (tu.slug)}
				<a class="tcard" href="/t/{tu.slug}">
					{#if tu.hasPhoto}<img
							src="/t/{tu.slug}/photo?v={tu.photoVersion}"
							alt=""
							width="240"
							height="170"
							loading="lazy"
						/>{:else}<span class="ph" aria-hidden="true">{initials(tu.name)}</span>{/if}
					<span class="tbody">
						<b class="tname">{tu.name}</b>
						<span class="tsub"
							>{[tu.subjects[0], tu.town?.split('(')[0].trim()].filter(Boolean).join(' · ')}</span
						>
						{#if tu.rating}
							<span class="trate"
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
		<h2>{m.home2_are_you_tutor()}</h2>
		<p>{c.joinLead || m.home3_join_lead()}</p>
		<a class="btn light" href="/join">{m.join_cta()} <span aria-hidden="true">→</span></a>
	</div>
</section>

<style>
	/* Measured from the approved 390 px design. */
	.hero {
		position: relative;
		overflow: hidden;
		min-height: 268px;
		padding: 58px 0 24px;
		/* soft curved bottom edge */
		clip-path: ellipse(150% 100% at 60% 0);
	}
	.hero-img {
		position: absolute;
		top: 0;
		right: 0;
		width: 64%;
		height: 100%;
		object-fit: cover;
		object-position: 72% 30%;
		/* fades softly into the cream behind the text */
		-webkit-mask-image: linear-gradient(to right, transparent 0, rgb(0 0 0 / 0.55) 22%, #000 48%);
		mask-image: linear-gradient(to right, transparent 0, rgb(0 0 0 / 0.55) 22%, #000 48%);
	}
	.hero-text {
		position: relative;
	}
	h1 {
		max-width: 205px;
		font-size: 2.1rem;
		line-height: 0.96;
		margin: 0 0 10px;
	}
	.lead {
		max-width: 165px;
		font-size: 0.8rem;
		line-height: 1.35;
		margin: 0 0 12px;
		color: var(--ink-900);
	}
	.hero-btn {
		min-height: 44px;
		padding: 0 18px;
		font-size: 0.85rem;
		box-shadow: 0 4px 12px rgb(18 61 46 / 0.18);
	}
	.sec {
		font-size: 1.55rem;
		margin: 14px 0 8px;
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
		gap: 4px;
		align-content: start;
		padding: 0 8px;
		border-left: 1px solid var(--line);
		overflow-wrap: anywhere;
		font-size: 0.66rem;
		line-height: 1.35;
	}
	.steps li:first-child {
		padding-left: 0;
		border-left: 0;
	}
	.num {
		font-family: var(--font-display);
		font-size: 1.3rem;
		color: var(--green-700);
		line-height: 1.1;
	}
	.steps b {
		font-size: 0.75rem;
		white-space: nowrap;
		color: var(--green-900);
	}
	.desc {
		color: var(--ink-600);
	}
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		margin-top: 22px;
		margin-bottom: 8px;
	}
	.head .sec {
		margin-top: 0;
	}
	.more {
		font-weight: 700;
		font-size: 0.75rem;
		text-decoration: none;
		white-space: nowrap;
	}
	/* three small cards across; with fewer tutors they keep their size, aligned left */
	.cards {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
	}
	.tcard {
		display: grid;
		grid-template-rows: auto 1fr;
		background: var(--card);
		border-radius: 12px;
		overflow: hidden;
		text-decoration: none;
		color: inherit;
		box-shadow: 0 2px 10px rgb(28 38 32 / 0.07);
	}
	.tcard img,
	.ph {
		width: 100%;
		aspect-ratio: 7 / 5;
		object-fit: cover;
		object-position: 50% 25%;
		background: #e9e6df;
	}
	.ph {
		display: grid;
		place-items: center;
		font-family: var(--font-display);
		font-size: 1.6rem;
		color: var(--green-700);
	}
	.tbody {
		display: grid;
		gap: 2px;
		align-content: start;
		padding: 7px 8px 9px;
		min-width: 0;
	}
	.tname {
		font-size: 0.72rem;
		color: var(--ink-900);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.tsub {
		font-size: 0.62rem;
		color: var(--ink-600);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.trate {
		font-size: 0.64rem;
		white-space: nowrap;
	}
	.star {
		color: var(--ochre-400);
	}
	.join {
		position: relative;
		overflow: hidden;
		margin: 20px 0 16px;
		background: var(--green-900);
		color: var(--paper-50);
		border-radius: 12px;
		padding: 12px 18px 13px;
	}
	.join::after {
		content: '';
		position: absolute;
		right: -70px;
		bottom: -110px;
		width: 230px;
		height: 230px;
		border-radius: 50%;
		background: rgb(255 255 255 / 0.06);
	}
	.join h2 {
		color: var(--paper-50);
		font-size: 1.45rem;
		margin: 0 0 2px;
	}
	.join p {
		position: relative;
		font-size: 0.72rem;
		line-height: 1.4;
		margin: 0 0 9px;
		max-width: 255px;
	}
	.light {
		position: relative;
		z-index: 1;
		min-height: 40px;
		padding: 0 26px;
		font-size: 0.85rem;
		background: var(--paper-50);
		color: var(--green-900);
		border-color: var(--paper-50);
	}
	.light:hover {
		background: var(--white);
		color: var(--green-900);
	}
</style>
