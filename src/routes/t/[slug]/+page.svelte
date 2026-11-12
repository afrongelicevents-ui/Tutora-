<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { waLink, formatZwPhone } from '#lib/whatsapp.ts';
	import SubjectList from '#lib/components/SubjectList.svelte';
	import ReviewList from '#lib/components/ReviewList.svelte';
	import Results from '#lib/components/Results.svelte';
	import { minutesToHHMM } from '#lib/tz.ts';
	const weekdayName = (d: number) =>
		new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' }).format(
			new Date(Date.UTC(2026, 10, 15 + d))
		);
	let { data } = $props();
	const site = $derived(data.site);
	const initials = (n: string) =>
		n
			.split(/\s+/)
			.map((x) => x[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	const bookPath = $derived(`/student/book?tutor=${site.slug}`);
	const bookHref = $derived(
		data.user ? bookPath : `/signup?tutor=${site.slug}&next=${encodeURIComponent(bookPath)}`
	);
	const where = $derived(
		site.lessonModes === 'online'
			? m.where_online()
			: site.lessonModes === 'in_person'
				? m.where_in_person({ town: site.town ?? '' })
				: m.where_both({ town: site.town ?? '' })
	);
</script>

<svelte:head>
	<title>{site.name ? `${site.name} · Tutora` : 'Tutora'}</title>
	<meta name="description" content={site.headline ?? m.home_meta()} />
</svelte:head>

<section class="wrap narrow">
	{#if data.preview}<p class="notice">{m.owner_preview_note()}</p>{/if}
	{#if !site.has.anything}
		<div class="card stack">
			<h1>{m.coming_soon_title()}</h1>
			<p class="muted">{m.coming_soon_lead()}</p>
			{#if site.whatsapp}<a
					class="btn btn-block"
					href={waLink(site.whatsapp, m.whatsapp_prefill())}
					target="_blank"
					rel="noopener noreferrer">{m.message_whatsapp()}</a
				>{/if}
			<a class="btn btn-secondary btn-block" href="/login">{m.nav_login()}</a>
		</div>
	{:else}
		{#if site.name}
			<div class="hero">
				{#if site.hasPhoto}
					<img
						class="avatar"
						src="/t/{site.slug}/photo?v={site.photoVersion}"
						alt={site.name}
						width="88"
						height="88"
					/>
				{:else}
					<div class="avatar" aria-hidden="true">{initials(site.name)}</div>
				{/if}
				<div>
					<p class="hero-name">{site.name}</p>
					{#if site.town}<p class="small muted">{site.town}</p>{/if}
					{#if site.yearsTeaching}<span class="pill p-ok"
							>{m.years_teaching({ n: site.yearsTeaching })}</span
						>{/if}
					{#if site.rating}<p class="small">
							<span class="star" aria-hidden="true">★</span>
							<b>{site.rating.toFixed(1)}</b>
							<span class="muted">({m.find_reviews({ n: site.reviews.length })})</span>
						</p>{/if}
				</div>
			</div>
		{/if}
		<h1>{site.headline ?? m.home_title_default()}</h1>
		<p class="muted">{where}</p>
		{#if site.has.subjects}
			<div class="stack">
				<a class="btn btn-block" href={bookHref}>{m.home_book()}</a>
				{#if site.offersIntro}<a
						class="btn btn-secondary btn-block"
						href={data.user
							? `${bookPath}&intro=1`
							: `/signup?tutor=${site.slug}&next=${encodeURIComponent(`${bookPath}&intro=1`)}`}
						>{m.home_intro_chat()}</a
					>{/if}
				{#if data.canSave}
					<form method="POST" action="?/{data.saved ? 'unsave' : 'save'}">
						<button class="btn-link" type="submit"
							>{data.saved ? m.fav_saved() : m.fav_save()}</button
						>
					</form>
				{/if}
			</div>
		{/if}

		{#if site.has.results}<div style="margin-top:20px"><Results results={site.results} /></div>{/if}

		{#if site.has.subjects}
			<h2>{m.subjects_h()}</h2>
			<SubjectList {site} />
		{/if}

		{#if site.has.about}
			<h2>{m.about_h()}</h2>
			<p>{(site.bio ?? '').slice(0, 280)}{(site.bio ?? '').length > 280 ? '…' : ''}</p>
			<a href="/t/{site.slug}/about">{m.read_more()}</a>
		{/if}

		{#if site.times.length}
			<h2>{m.prof_times()}</h2>
			<ul class="list card times">
				{#each [1, 2, 3, 4, 5, 6, 0] as d (d)}
					{@const w = site.times.filter((x) => x.weekday === d)}
					{#if w.length}<li>
							<span>{weekdayName(d)}</span><span class="small"
								>{w
									.map((x) => `${minutesToHHMM(x.startMinute)}–${minutesToHHMM(x.endMinute)}`)
									.join(', ')}</span
							>
						</li>{/if}
				{/each}
			</ul>
			<p class="small muted">{m.prof_times_note()}</p>
		{/if}

		{#if site.has.reviews}
			<h2>{m.reviews_h()}</h2>
			<ReviewList reviews={site.reviews.slice(0, 3)} />
			{#if site.reviews.length > 3}<a href="/t/{site.slug}/reviews"
					>{m.all_reviews({ n: site.reviews.length })}</a
				>{/if}
		{/if}

		{#if site.whatsapp || site.phone || site.email}
			<h2>{m.contact_h()}</h2>
			<div class="card stack">
				{#if site.whatsapp}<a
						class="btn btn-block"
						href={waLink(site.whatsapp, m.whatsapp_prefill())}
						target="_blank"
						rel="noopener noreferrer">{m.message_whatsapp()}</a
					>{/if}
				{#if site.phone}<a
						class="btn btn-secondary btn-block"
						href="tel:{site.phone.replace(/[^+\d]/g, '')}"
						>{m.call({ phone: formatZwPhone(site.phone) })}</a
					>{/if}
				{#if site.email}<a class="btn btn-secondary btn-block" href="mailto:{site.email}"
						>{site.email}</a
					>{/if}
			</div>
		{/if}
	{/if}
</section>

<style>
	.times {
		padding: 4px 16px;
	}
	.star {
		color: var(--rose-400);
	}
</style>
