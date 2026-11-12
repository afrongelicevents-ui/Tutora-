<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { formatMoney } from '#lib/money.ts';
	import { page } from '$app/state';
	let { data } = $props();
	const initials = (n: string) =>
		n
			.split(/\s+/)
			.map((x) => x[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	const modes = (x: string) =>
		x === 'online' ? m.mode_online() : x === 'in_person' ? m.mode_in_person() : m.mode_both_short();
	const moreHref = $derived(
		'?' +
			[...page.url.searchParams]
				.filter(([k]) => k !== 'n')
				.concat([['n', String(data.shown + 10)]])
				.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
				.join('&')
	);
</script>

<svelte:head>
	<title>{m.find_a_tutor()} · Tutora</title>
	<meta name="description" content={m.home2_meta()} />
</svelte:head>

<section class="wrap narrow">
	<h1>{m.find_a_tutor()}</h1>
	<form method="GET" class="card stack filters" role="search">
		<label
			>{m.home2_subject()}
			<select name="subject">
				<option value="">{m.home2_all_subjects()}</option>
				{#each data.subjects as s (s)}<option
						value={s}
						selected={s.toLowerCase() === data.f.subject.toLowerCase()}>{s}</option
					>{/each}
			</select></label
		>
		<div class="two">
			<label
				>{m.find_level()}
				<input name="level" value={data.f.level} placeholder={m.find_level_ph()} /></label
			>
			<label
				>{m.find_mode()}
				<select name="mode">
					<option value="">{m.find_any()}</option>
					<option value="online" selected={data.f.mode === 'online'}>{m.mode_online()}</option>
					<option value="in_person" selected={data.f.mode === 'in_person'}
						>{m.mode_in_person()}</option
					>
				</select></label
			>
		</div>
		<div class="two">
			<label
				>{m.find_location()}
				<input name="location" value={data.f.location} placeholder={m.find_location_ph()} /></label
			>
			<label
				>{m.find_sort()}
				<select name="sort">
					<option value="">{m.find_sort_name()}</option>
					<option value="rating" selected={data.f.sort === 'rating'}>{m.find_sort_rating()}</option>
					<option value="price" selected={data.f.sort === 'price'}>{m.find_sort_price()}</option>
					<option value="newest" selected={data.f.sort === 'newest'}>{m.find_sort_newest()}</option>
				</select></label
			>
		</div>
		<button class="btn btn-block" type="submit">{m.find_show()}</button>
	</form>

	<p class="small muted" role="status">{m.find_count({ n: data.total })}</p>
	{#each data.tutors as tu (tu.slug)}
		<a class="card tutor" href="/t/{tu.slug}">
			{#if tu.hasPhoto}<img
					class="av"
					src="/t/{tu.slug}/photo?v={tu.photoVersion}"
					alt=""
					width="72"
					height="72"
					loading="lazy"
				/>{:else}<span class="av ph" aria-hidden="true">{initials(tu.name)}</span>{/if}
			<span class="body">
				<b>{tu.name}</b>
				<span class="small">{tu.subjects.join(', ')}</span>
				{#if tu.intro}<span class="small muted">{tu.intro}</span>{/if}
				<span class="small muted"
					>{[tu.town, modes(tu.lessonModes)].filter(Boolean).join(' · ')}</span
				>
				<span class="small"
					><b
						>{tu.fromPriceCents != null
							? m.find_from({ price: formatMoney(tu.fromPriceCents, tu.currency) })
							: m.find_ask_price()}</b
					>{#if tu.rating}
						· <span class="star" aria-hidden="true">★</span>
						{tu.rating.toFixed(1)}
						<span class="muted">({m.find_reviews({ n: tu.reviewCount })})</span>{/if}</span
				>
			</span>
		</a>
	{:else}
		<p class="empty">
			{data.total === 0 && data.f.subject ? m.home2_none_subject() : m.home2_none_yet()}
		</p>
	{/each}
	{#if data.shown < data.total}
		<a class="btn btn-secondary btn-block" href={moreHref}>{m.find_more()}</a>
	{/if}
</section>

<style>
	.filters label {
		display: grid;
		gap: 4px;
		font-weight: 600;
		min-width: 0;
	}
	.filters select,
	.filters input {
		min-height: 48px;
		width: 100%;
		min-width: 0;
	}
	.two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.tutor {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		text-decoration: none;
		color: inherit;
	}
	.body {
		display: grid;
		gap: 3px;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.av {
		flex: none;
		width: 72px;
		height: 72px;
		border-radius: 14px;
		object-fit: cover;
	}
	.ph {
		display: grid;
		place-items: center;
		background: var(--mint-50);
		font-family: var(--font-display);
		font-size: 1.5rem;
		color: var(--brand-700);
	}
	.star {
		color: var(--ochre-400);
	}
</style>
