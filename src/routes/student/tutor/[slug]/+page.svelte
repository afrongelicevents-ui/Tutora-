<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtMonth } from '#lib/tz.ts';
	import { formatMoney } from '#lib/money.ts';
	import { availabilitySummary } from '#lib/availability.ts';
	let { data } = $props();
	const s = $derived(data.site);
	const initial = (n: string) =>
		n
			.replace(/^(Mr|Mrs|Ms|Miss|Dr)\.?\s+/i, '')
			.charAt(0)
			.toUpperCase();
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
	const prices = $derived(
		s.subjects.map((x) => x.priceCents).filter((x): x is number => x !== null)
	);
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
			>{#if s.hasPhoto}<img
					src="/t/{s.slug}/photo?v={s.photoVersion}"
					alt=""
					width="84"
					height="84"
				/>{:else}{initial(s.name ?? '?')}{/if}</span
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
	{#if data.together}
		{@const g = data.together}
		<section class="us" aria-labelledby="us-h">
			<h2 id="us-h" class="h3">{m.tg_title({ name: s.name ?? '' })}</h2>
			{#if g.since}<p class="small muted">
					{m.tg_since({ date: fmtMonth(new Date(g.since)) })}{g.months
						? ` · ${m.tg_months({ n: g.months })}`
						: ''}
				</p>{/if}
			<div class="us-grid">
				<div><strong>{g.lessonsDone}</strong><span>{m.tg_lessons()}</span></div>
				<div>
					<strong>{g.paidLessons}{g.chargedLessons ? ` / ${g.chargedLessons}` : ''}</strong><span
						>{m.tg_paid()}</span
					>
				</div>
				<div>
					<strong>{g.homework.handed} / {g.homework.set}</strong><span>{m.tg_homework()}</span>
				</div>
				<div><strong>{g.topics}</strong><span>{m.tg_topics()}</span></div>
			</div>
			{#if g.marks && g.marks.first !== null && g.marks.latest !== null}
				<p class="marks">
					{m.tg_marks({ first: g.marks.first, latest: g.marks.latest })}
					{#if g.marks.latest > g.marks.first}<span class="up">{m.tg_up()}</span>{/if}
				</p>
			{:else if g.results}
				<p class="small muted">{m.tg_marks_soon()}</p>
			{/if}
			{#if g.upcoming}<p class="small">{m.tg_upcoming({ n: g.upcoming })}</p>{/if}
		</section>
	{/if}
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
		{#if times}<div>
				<span class="muted">{m.tp3_available()}</span><strong>{times}</strong>
			</div>{/if}
		<div>
			<span class="muted">{m.tp3_length()}</span><strong
				>{m.tp3_minutes({ n: s.lessonMinutes })}</strong
			>
		</div>
		{#if s.town && s.lessonModes !== 'online'}<div>
				<span class="muted">{m.tp3_area()}</span><strong>{s.town}</strong>
			</div>{/if}
		{#if s.qualifications}<div>
				<span class="muted">{m.tp3_qualifications()}</span><strong class="r"
					>{s.qualifications}</strong
				>
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
	{#if data.services.length}
		<section class="stack-s">
			<h2 class="h3">{m.th_title()}</h2>
			<ul class="svc">
				{#each data.services as sv (sv)}<li>{t(`th_${sv}`)}</li>{/each}
			</ul>
		</section>
	{/if}
	{#if s.reviews.length}
		<section class="stack-s">
			<h2 class="h3">{m.tp3_reviews({ n: s.reviews.length })}</h2>
			{#each s.reviews.slice(0, 3) as r, i (i)}
				<blockquote class="quote">
					<p>“{r.text}”</p>
					<footer class="small muted">{r.displayName} · {r.rating}/5</footer>
				</blockquote>
			{/each}
			<a href="/t/{s.slug}/reviews">{m.tp3_all_reviews()}</a>
		</section>
	{:else}
		<p class="note">{m.tp3_reviews_after()}</p>
	{/if}
	<div class="acts">
		{#if data.messageId}<a class="btn btn-secondary" href="/student/messages/{data.messageId}"
				>{m.msg_open()}</a
			>{/if}
		<a class="btn" href="/student/book?tutor={s.slug}"
			>{data.together ? m.tg_book_again() : m.home_book()}</a
		>
	</div>
	{#if s.offersIntro}<a class="btn btn-ghost btn-block" href="/student/book?tutor={s.slug}&intro=1"
			>{m.tp3_intro()}</a
		>{/if}
	<form method="POST" action="?/save">
		<input type="hidden" name="on" value={data.saved ? '0' : '1'} />
		<button class="btn-link" type="submit">{data.saved ? m.tp3_unsave() : m.tp3_save()}</button>
	</form>
</div>

<style>
	.us {
		display: flex;
		flex-direction: column;
		gap: 8px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 20px;
		padding: 16px;
	}
	.us h2 {
		margin: 0;
	}
	.us p {
		margin: 0;
	}
	.us-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		text-align: center;
	}
	.us-grid div {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 0 4px;
	}
	.us-grid div + div {
		border-left: 1px solid var(--border);
	}
	.us-grid strong {
		font-size: 1.25rem;
		color: var(--navy);
	}
	.us-grid span {
		font-size: 0.6875rem;
		color: var(--muted);
		line-height: 1.25;
	}
	.marks {
		font-weight: 600;
		color: var(--navy);
	}
	.up {
		color: var(--ok);
		margin-left: 4px;
	}
	.svc {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.svc li {
		background: var(--ice);
		color: var(--navy);
		border-radius: 99px;
		padding: 6px 12px;
		font-size: 0.8125rem;
		font-weight: 600;
	}
	.acts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
		gap: 10px;
	}
	.head {
		background: var(--ice);
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
		background: var(--snow);
		color: var(--navy);
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
		color: var(--ocean);
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
