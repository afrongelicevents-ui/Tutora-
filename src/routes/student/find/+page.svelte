<script lang="ts">
	import { page } from '$app/state';
	import { m, t } from '#lib/i18n.ts';
	import { SERVICES } from '#lib/services.ts';
	import { formatMoney } from '#lib/money.ts';
	let { data } = $props();
	const initial = (n: string) =>
		n
			.replace(/^(Mr|Mrs|Ms|Miss|Dr)\.?\s+/i, '')
			.charAt(0)
			.toUpperCase();
	const withParam = (k: string, v: string) => {
		const u = new URL(page.url.href);
		if (v) u.searchParams.set(k, v);
		else u.searchParams.delete(k);
		u.searchParams.delete('n');
		return u.pathname + u.search;
	};
	const filtered = $derived(
		!!(data.f.level || data.f.mode || data.f.location || data.f.max || data.f.service)
	);
	const active = $derived(
		[data.f.level, data.f.mode, data.f.location, data.f.max, data.f.service].filter(Boolean).length
	);
	let sheet = $state<HTMLDialogElement | null>(null);
	const modeText = (mo: string, town: string | null) =>
		mo === 'online'
			? m.find3_online()
			: mo === 'in_person'
				? town
					? m.find3_in_town({ town })
					: m.find3_in_person()
				: town
					? m.find3_online_or_town({ town })
					: m.find3_online_or_in_person();
</script>

<svelte:head><title>{m.find_a_tutor()} · Tutora</title></svelte:head>

<div class="screen">
	<h1>{m.find_a_tutor()}</h1>
	<form method="GET" class="search" role="search">
		<label class="sr-only" for="q">{m.find3_search_label()}</label>
		<input id="q" name="q" type="search" placeholder={m.find3_search_ph()} value={data.f.q} />
		{#if data.f.subject}<input type="hidden" name="subject" value={data.f.subject} />{/if}
		{#if data.f.level}<input type="hidden" name="level" value={data.f.level} />{/if}
		{#if data.f.mode}<input type="hidden" name="mode" value={data.f.mode} />{/if}
		{#if data.f.location}<input type="hidden" name="location" value={data.f.location} />{/if}
		{#if data.f.max}<input type="hidden" name="max" value={data.f.max} />{/if}
		{#if data.f.service}<input type="hidden" name="service" value={data.f.service} />{/if}
	</form>

	{#if data.subjects.length}
		<div class="chips" aria-label={m.find3_subjects()}>
			{#each data.subjects as s (s)}
				<a
					class="chip"
					href={withParam('subject', data.f.subject.toLowerCase() === s.toLowerCase() ? '' : s)}
					aria-current={data.f.subject.toLowerCase() === s.toLowerCase() ? 'true' : undefined}
					>{s}</a
				>
			{/each}
		</div>
	{/if}

	<div class="frow">
		<button class="btn btn-secondary fbtn" type="button" onclick={() => sheet?.showModal()}
			>{m.find3_filters_btn()}{#if active}<span class="count">{active}</span>{/if}</button
		>
		{#if data.f.service}<a class="chip on" href={withParam('service', '')}
				>{t(`th_${data.f.service}`)}&nbsp;<span aria-hidden="true">×</span><span class="sr-only"
					>{m.find3_clear()}</span
				></a
			>{/if}
	</div>
	{#if data.serviceFallback}<p class="note">
			{m.find3_service_none({ service: t(`th_${data.f.service}`) })}
		</p>{/if}

	<dialog class="sheet" bind:this={sheet} aria-label={m.find3_filters()}>
		<button class="close" type="button" onclick={() => sheet?.close()} aria-label={m.find3_close()}
			>×</button
		>
		<form method="GET" class="stack">
			<h2 class="h3">{m.find3_filters()}</h2>
			<input type="hidden" name="q" value={data.f.q} />
			<input type="hidden" name="subject" value={data.f.subject} />
			<label class="field"
				><span class="label">{m.find3_service()}</span>
				<select name="service">
					<option value="">{m.find3_any()}</option>
					{#each SERVICES as sv (sv)}<option value={sv} selected={data.f.service === sv}
							>{t(`th_${sv}`)}</option
						>{/each}
				</select></label
			>
			<label class="field"
				><span class="label">{m.find3_level()}</span>
				<input name="level" value={data.f.level} placeholder={m.find3_level_ph()} /></label
			>
			<label class="field"
				><span class="label">{m.find3_max_price()}</span>
				<input
					name="max"
					type="number"
					min="1"
					step="1"
					inputmode="numeric"
					value={data.f.max}
				/></label
			>
			<fieldset class="field">
				<legend class="label">{m.find3_how()}</legend>
				<div class="chips">
					<label class="chip"
						><input
							type="radio"
							name="mode"
							value=""
							checked={!data.f.mode}
						/>{m.find3_any()}</label
					>
					<label class="chip"
						><input
							type="radio"
							name="mode"
							value="online"
							checked={data.f.mode === 'online'}
						/>{m.find3_online()}</label
					>
					<label class="chip"
						><input
							type="radio"
							name="mode"
							value="in_person"
							checked={data.f.mode === 'in_person'}
						/>{m.find3_in_person()}</label
					>
				</div>
			</fieldset>
			<label class="field"
				><span class="label">{m.find3_location()}</span>
				<input name="location" value={data.f.location} placeholder={m.find3_location_ph()} /></label
			>
			<div class="row">
				<button class="btn grow" type="submit">{m.find3_apply()}</button>
				<a class="btn btn-secondary grow" href="/student/find">{m.find3_clear()}</a>
			</div>
		</form>
	</dialog>

	{#if data.tutors.length}
		<p class="note">{m.find3_count({ n: data.total })}</p>
		{#each data.tutors as tu (tu.slug)}
			<a class="tutorcard" href="/student/tutor/{tu.slug}">
				<span class="avatar-l"
					>{#if tu.hasPhoto}<img
							src="/t/{tu.slug}/photo?v={tu.photoVersion}"
							alt=""
							width="58"
							height="58"
							loading="lazy"
						/>{:else}{initial(tu.name)}{/if}</span
				>
				<span class="info">
					<strong>{tu.name}</strong>
					<span class="muted"
						>{tu.subjects.slice(0, 3).join(', ')}{tu.levels.length
							? ` · ${tu.levels.slice(0, 3).join(', ')}`
							: ''}</span
					>
					<span
						>{tu.fromPriceCents !== null
							? m.find3_price({ price: formatMoney(tu.fromPriceCents, tu.currency) })
							: m.find_ask_price()} · {modeText(tu.lessonModes, tu.town)}</span
					>
				</span>
				<span class="go" aria-hidden="true">›</span>
			</a>
		{/each}
		{#if data.shown < data.total}
			<a class="btn btn-ghost" href={withParam('n', String(data.shown + 10))}>{m.find3_more()}</a>
		{/if}
	{:else}
		<div class="empty-state">
			<h2 class="h3">
				{data.f.q || data.f.subject || filtered ? m.find3_none_match() : m.find3_none_yet()}
			</h2>
			<p class="lead">
				{data.f.q || data.f.subject || filtered
					? m.find3_none_match_lead()
					: m.find3_none_yet_lead()}
			</p>
			{#if data.f.q || data.f.subject || filtered}<a class="btn btn-ghost" href="/student/find"
					>{m.find3_clear()}</a
				>{/if}
		</div>
	{/if}
</div>

<style>
	.search input {
		width: 100%;
		min-height: 52px;
		padding: 0 18px;
		border: 1.5px solid var(--border);
		border-radius: 999px;
		background: #fff;
		font: inherit;
	}
	.frow {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	.fbtn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.count {
		background: var(--navy);
		color: #fff;
		border-radius: 99px;
		min-width: 22px;
		height: 22px;
		display: grid;
		place-items: center;
		font-size: 0.75rem;
	}
	.chip.on {
		background: var(--navy);
		color: #fff;
	}
	/* filters open as a sheet from the bottom of the screen */
	.sheet {
		position: fixed;
		inset: auto 0 0 0;
		margin: 0 auto;
		width: 100%;
		max-width: 560px;
		max-height: 88vh;
		overflow-y: auto;
		border: 0;
		border-radius: 24px 24px 0 0;
		padding: 22px 20px calc(24px + env(safe-area-inset-bottom));
		background: #fff;
		box-shadow: 0 -10px 40px rgb(11 37 69 / 0.2);
	}
	.sheet::backdrop {
		background: rgb(11 37 69 / 0.4);
	}
	.close {
		position: absolute;
		top: 12px;
		right: 12px;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		border: 1px solid var(--border);
		background: #fff;
		font-size: 1.25rem;
		color: var(--navy);
		cursor: pointer;
	}
	.sheet select {
		width: 100%;
	}
	fieldset {
		border: none;
		padding: 0;
		margin: 0;
	}
	.go {
		color: var(--navy);
		font-size: 1.25rem;
	}
	.empty-state {
		padding: 24px 0;
		border-top: 1px solid var(--border);
	}
</style>
