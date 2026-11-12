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

<section class="hero wrap">
	<div class="hero-text">
		<h1>{c.heroTitle || m.home2_title()}</h1>
		<p class="lead">{c.heroLead || m.home3_lead()}</p>
		<a class="btn hero-btn" href="/tutors">{m.find_a_tutor()} <span aria-hidden="true">→</span></a>
	</div>
	<figure class="hero-photo">
		<img
			src={c.heroPhotoV ? `/hero-photo?v=${c.heroPhotoV}` : '/hero.webp'}
			alt=""
			width="900"
			height="571"
			fetchpriority="high"
		/>
	</figure>
</section>

<section class="wrap block" id="how">
	<h2 class="sec">{m.home2_how()}</h2>
	<ol class="steps">
		<li>
			<span class="num">01</span>
			<div>
				<h3>{m.home2_step1_t()}</h3>
				<p>{m.home3_step1()}</p>
			</div>
		</li>
		<li>
			<span class="num">02</span>
			<div>
				<h3>{m.home3_step2_t()}</h3>
				<p>{m.home3_step2()}</p>
			</div>
		</li>
		<li>
			<span class="num">03</span>
			<div>
				<h3>{m.home3_step3_t()}</h3>
				<p>{m.home3_step3()}</p>
			</div>
		</li>
	</ol>
</section>

{#if data.tutors.length}
	<section class="wrap block">
		<div class="head">
			<h2 class="sec">{m.home3_popular()}</h2>
			<a class="more" href="/tutors">{m.home3_view_all()} <span aria-hidden="true">→</span></a>
		</div>
		<ul class="cards">
			{#each data.tutors as tu (tu.slug)}
				<li>
					<a class="tcard" href="/t/{tu.slug}">
						{#if tu.hasPhoto}<img
								class="photo"
								src="/t/{tu.slug}/photo?v={tu.photoVersion}"
								alt=""
								width="240"
								height="240"
								loading="lazy"
							/>{:else}<span class="photo ph" aria-hidden="true">{initials(tu.name)}</span>{/if}
						<span class="tbody">
							<span class="tname">{tu.name}</span>
							{#if tu.subjects[0]}<span class="tsub">{tu.subjects[0]}</span>{/if}
							{#if tu.town}<span class="tsub">{tu.town.split('(')[0].trim()}</span>{/if}
							{#if tu.rating}
								<span class="trate"
									><span class="star" aria-hidden="true">★</span>
									{tu.rating.toFixed(1)}
									<span class="muted">· {m.find_reviews({ n: tu.reviewCount })}</span></span
								>
							{/if}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<section class="wrap block">
	<div class="join">
		<div>
			<h2>{m.home2_are_you_tutor()}</h2>
			<p>{c.joinLead || m.home3_join_lead()}</p>
		</div>
		<a class="btn light" href="/join">{m.join_cta()}</a>
	</div>
</section>

<style>
	/* Mobile first. One column on phones; two-column hero and wider grids from 760 px. */
	.hero {
		display: grid;
		gap: 24px;
		padding-top: 16px;
		padding-bottom: 8px;
	}
	h1 {
		font-size: 2.25rem;
		line-height: 1.08;
		letter-spacing: -0.01em;
		margin: 0 0 12px;
		max-width: 14ch;
		text-wrap: balance;
	}
	.lead {
		font-size: 1.0625rem;
		line-height: 1.5;
		color: var(--ink-600);
		margin: 0 0 24px;
		max-width: 30ch;
		text-wrap: balance;
	}
	.hero-photo {
		margin: 0;
	}
	.hero-photo img {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 3 / 2;
		object-fit: cover;
		object-position: 40% 40%;
		border-radius: 4px;
	}

	.block {
		margin-top: 48px;
	}
	.sec {
		font-size: 1.625rem;
		line-height: 1.15;
		margin: 0;
	}

	.steps {
		list-style: none;
		margin: 20px 0 0;
		padding: 0;
		display: grid;
	}
	.steps li {
		display: grid;
		grid-template-columns: 44px 1fr;
		gap: 4px;
		padding: 16px 0;
		border-top: 1px solid var(--line);
	}
	.steps li:last-child {
		border-bottom: 1px solid var(--line);
	}
	.num {
		font-family: var(--font-display);
		font-size: 1.25rem;
		line-height: 1.3;
		color: var(--brand-700);
	}
	.steps h3 {
		font-family: var(--font);
		font-size: 1rem;
		font-weight: 700;
		margin: 0 0 2px;
		color: var(--ink-900);
	}
	.steps p {
		margin: 0;
		font-size: 0.9375rem;
		line-height: 1.45;
		color: var(--ink-600);
	}

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}
	.more {
		font-weight: 700;
		font-size: 0.9375rem;
		color: var(--brand-700);
		text-decoration: none;
		white-space: nowrap;
		padding: 10px 0;
	}
	.more:hover {
		text-decoration: underline;
	}
	/* phones: a simple list; each tutor is one row, so one tutor looks as intended as many */
	.cards {
		list-style: none;
		margin: 16px 0 0;
		padding: 0;
		display: grid;
		gap: 12px;
	}
	.cards li {
		display: grid;
	}
	.tcard {
		display: grid;
		grid-template-columns: 88px 1fr;
		gap: 16px;
		align-items: center;
		padding: 12px;
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		text-decoration: none;
		color: inherit;
	}
	.tcard:hover {
		border-color: var(--ochre-400);
	}
	.photo {
		display: block;
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		object-position: 50% 25%;
		border-radius: 4px;
		background: var(--mint-50);
	}
	.ph {
		display: grid;
		place-items: center;
		font-family: var(--font-display);
		font-size: 1.75rem;
		color: var(--brand-700);
	}
	.tbody {
		display: grid;
		gap: 2px;
		min-width: 0;
	}
	.tname {
		font-family: var(--font-display);
		font-size: 1.1875rem;
		line-height: 1.2;
		color: var(--ink-900);
		margin-bottom: 2px;
	}
	.tsub {
		font-size: 0.9375rem;
		color: var(--ink-600);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.trate {
		font-size: 0.875rem;
		margin-top: 2px;
		color: var(--ink-900);
	}
	.star {
		color: var(--ochre-400);
	}

	.join {
		display: grid;
		gap: 20px;
		background: var(--brand-900);
		color: var(--paper-50);
		border-radius: var(--radius);
		padding: 32px 24px;
		margin-bottom: 40px;
	}
	.join h2 {
		color: var(--paper-50);
		font-size: 1.625rem;
		line-height: 1.15;
		margin: 0 0 8px;
	}
	.join p {
		margin: 0;
		font-size: 1rem;
		line-height: 1.55;
		color: #dfe9e2;
		max-width: 46ch;
	}
	.light {
		justify-self: start;
		background: var(--paper-50);
		color: var(--brand-900);
		border-color: var(--paper-50);
	}
	.light:hover {
		background: var(--white);
		color: var(--brand-900);
		border-color: var(--white);
	}

	@media (min-width: 760px) {
		.hero {
			grid-template-columns: 5fr 6fr;
			align-items: center;
			gap: 48px;
			padding-top: 48px;
			padding-bottom: 16px;
		}
		h1 {
			font-size: 3.25rem;
			max-width: 11ch;
		}
		.lead {
			font-size: 1.1875rem;
		}
		.hero-photo img {
			aspect-ratio: 4 / 3;
		}
		.block {
			margin-top: 80px;
		}
		.sec {
			font-size: 2.125rem;
		}
		.steps {
			grid-template-columns: repeat(3, 1fr);
			gap: 32px;
			margin-top: 28px;
		}
		.steps li,
		.steps li:last-child {
			display: block;
			padding: 20px 0 0;
			border-top: 1px solid var(--line);
			border-bottom: 0;
		}
		.num {
			display: block;
			margin-bottom: 8px;
		}
		/* fixed-width columns: one tutor keeps the same card size, aligned left */
		.cards {
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 20px;
			margin-top: 24px;
		}
		.tcard {
			grid-template-columns: 1fr;
			grid-template-rows: auto 1fr;
			align-items: start;
			gap: 14px;
			padding: 0 0 16px;
			overflow: hidden;
		}
		.tcard .photo {
			border-radius: 0;
			aspect-ratio: 4 / 3;
		}
		.tbody {
			padding: 0 16px;
		}
		.join {
			grid-template-columns: 1fr auto;
			align-items: center;
			gap: 32px;
			padding: 48px;
			margin-bottom: 64px;
		}
		.join h2 {
			font-size: 2.125rem;
		}
	}
</style>
