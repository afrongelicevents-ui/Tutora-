<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { formatMoney } from '#lib/money.ts';
	import { availabilitySummary } from '#lib/availability.ts';
	let { data } = $props();
	const s = $derived(data.site);
	const initial = (n: string) => n.replace(/^(Mr|Mrs|Ms|Miss|Dr)\.?\s+/i, '').charAt(0).toUpperCase();
	const levels = $derived([
		...new Set(
			s.subjects.flatMap((x) =>
				x.levels
					.split(',')
					.map((l) => l.trim())
					.filter(Boolean)
			)
		)
	]);
	const prices = $derived(s.subjects.map((x) => x.priceCents).filter((x): x is number => x !== null));
	const modes = $derived(
		s.lessonModes === 'online'
			? m.find3_online()
			: s.lessonModes === 'in_person'
				? m.find3_in_person()
				: m.find3_online_or_in_person()
	);
	const times = $derived(availabilitySummary(s.times));
</script>

<svelte:head><title>{s.name} · Tutora</title></svelte:head>

<div class="head">
	<div class="inner">
		<a class="back" href="/student/find" aria-label={m.v3_back()}>←</a>
		<span class="avatar"
			>{#if s.hasPhoto}<img src="/t/{s.slug}/photo?v={s.photoVersion}" alt="" width="84" height="84" />{:else}{initial(
					s.name ?? '?'
				)}{/if}</span
		>
		<h1>{s.name}</h1>
		<span class="meta"
			>{[s.subjects.map((x) => x.name).join(' · '), levels.slice(0, 4).join(', '), modes]
				.filter(Boolean)
				.join(' · ')}</span
		>
	</div>
</div>

<div class="screen">
	{#if s.headline}<p class="headline">{s.headline}</p>{/if}
	{#if s.bio}<p class="bio">{s.bio}</p>{/if}
	<div class="rows top">
		<div>
			<span class="muted">{m.tp3_price()}</span>
			<strong
				>{prices.length
					? prices.length > 1 && Math.min(...prices) !== Math.max(...prices)
						? m.tp3_from({ price: formatMoney(Math.min(...prices), s.currency) })
						: m.tp3_per_lesson({ price: formatMoney(prices[0], s.currency) })
					: m.find_ask_price()}</strong
			>
		</div>
		{#if times}<div><span class="muted">{m.tp3_available()}</span><strong>{times}</strong></div>{/if}
		<div><span class="muted">{m.tp3_length()}</span><strong>{m.tp3_minutes({ n: s.lessonMinutes })}</strong></div>
		{#if s.town && s.lessonModes !== 'online'}<div>
				<span class="muted">{m.tp3_area()}</span><strong>{s.town}</strong>
			</div>{/if}
		{#if s.qualifications}<div>
				<span class="muted">{m.tp3_qualifications()}</span><strong class="r">{s.qualifications}</strong>
			</div>{/if}
	</div>
	{#if s.subjects.length > 1}
		<div class="rows">
			{#each s.subjects as x (x.id)}
				<div>
					<span>{x.name}{x.levels ? ` · ${x.levels}` : ''}</span>
					<span class="muted"
						>{x.priceCents !== null ? formatMoney(x.priceCents, s.currency) : ''}</span
					>
				</div>
			{/each}
		</div>
	{/if}
	{#if s.reviews.length}
		<section class="stack-s">
			<h2 class="h3">{m.tp3_reviews({ n: s.reviews.length })}</h2>
			{#each s.reviews.slice(0, 3) as r, i (i)}
				<blockquote class="quote"><p>“{r.text}”</p><footer class="small muted">{r.displayName} · {r.rating}/5</footer></blockquote>
			{/each}
			<a href="/t/{s.slug}/reviews">{m.tp3_all_reviews()}</a>
		</section>
	{:else}
		<p class="note">{m.tp3_reviews_after()}</p>
	{/if}
	<a class="btn btn-block big" href="/student/book?tutor={s.slug}">{m.home_book()}</a>
	{#if s.offersIntro}<a class="btn btn-ghost btn-block" href="/student/book?tutor={s.slug}&intro=1"
			>{m.tp3_intro()}</a
		>{/if}
	<form method="POST" action="?/save">
		<input type="hidden" name="on" value={data.saved ? '0' : '1'} />
		<button class="btn-link" type="submit">{data.saved ? m.tp3_unsave() : m.tp3_save()}</button>
	</form>
</div>

<style>
	.head {
		background: var(--lilac);
	}
	.inner {
		max-width: 720px;
		margin: 0 auto;
		padding: 8px 22px 22px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.back {
		align-self: flex-start;
	}
	.avatar {
		width: 84px;
		height: 84px;
		border-radius: 999px;
		background: var(--ivory);
		color: var(--plum);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-display);
		font-size: 1.875rem;
		overflow: hidden;
	}
	.avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	h1 {
		margin: 0;
		font-size: 1.875rem;
	}
	.meta {
		font-size: 0.9375rem;
		color: var(--plum-2);
	}
	.headline {
		margin: 0;
		font-weight: 600;
	}
	.bio {
		margin: 0;
		font-size: 0.9375rem;
		line-height: 1.6;
		white-space: pre-line;
	}
	.r {
		text-align: right;
	}
	.big {
		min-height: 54px;
	}
	.stack-s {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	@media (min-width: 900px) {
		.inner {
			margin: 0;
			padding: 24px 40px 28px;
		}
	}
</style>
