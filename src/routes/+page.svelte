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
	const modes = (x: string) =>
		x === 'online' ? m.mode_online() : x === 'in_person' ? m.mode_in_person() : m.mode_both_short();
</script>

<svelte:head>
	<title>Tutora · {m.home2_title()}</title>
	<meta name="description" content={m.home2_meta()} />
</svelte:head>

<section class="hero">
	<div class="wrap narrow">
		<h1>{m.home2_title()}</h1>
		<p class="lead">{m.home2_lead()}</p>
		<div class="stack">
			<a class="btn btn-block" href="#find">{m.find_a_tutor()}</a>
			<a class="btn btn-secondary btn-block" href="/join">{m.home2_are_you_tutor()}</a>
		</div>
	</div>
</section>

<section class="wrap narrow">
	<h2>{m.home2_how()}</h2>
	<ol class="steps">
		<li><b>{m.home2_step1_t()}</b><span class="small muted block">{m.home2_step1()}</span></li>
		<li><b>{m.home2_step2_t()}</b><span class="small muted block">{m.home2_step2()}</span></li>
		<li><b>{m.home2_step3_t()}</b><span class="small muted block">{m.home2_step3()}</span></li>
	</ol>

	<h2 id="find">{m.find_a_tutor()}</h2>
	{#if data.subjects.length}
		<form method="GET" action="/#find" class="row filter" role="search">
			<label class="sr-only" for="subject">{m.home2_subject()}</label>
			<select id="subject" name="subject" class="grow">
				<option value="">{m.home2_all_subjects()}</option>
				{#each data.subjects as s (s)}<option
						value={s}
						selected={s.toLowerCase() === data.subject.toLowerCase()}>{s}</option
					>{/each}
			</select>
			<button class="btn btn-sm" type="submit">{m.home2_show()}</button>
		</form>
	{/if}
	{#each data.tutors as tu (tu.slug)}
		<a class="card tutor" href="/t/{tu.slug}">
			{#if tu.hasPhoto}<img
					class="avatar-img"
					src="/t/{tu.slug}/photo?v={tu.photoVersion}"
					alt=""
					width="64"
					height="64"
					loading="lazy"
				/>{:else}<span class="avatar" aria-hidden="true">{initials(tu.name)}</span>{/if}
			<span class="grow">
				<b>{tu.name}</b>
				{#if tu.headline}<span class="small block">{tu.headline}</span>{/if}
				<span class="small muted block"
					>{[tu.subjects.slice(0, 4).join(', '), modes(tu.lessonModes), tu.town]
						.filter(Boolean)
						.join(' · ')}</span
				>
			</span>
		</a>
	{:else}
		<p class="empty">{data.subject ? m.home2_none_subject() : m.home2_none_yet()}</p>
	{/each}

	<div class="band join">
		<div class="band-label">{m.home2_are_you_tutor()}</div>
		<p class="band-big">{m.home2_join_lead()}</p>
		<a class="btn btn-secondary" href="/join">{m.join_cta()}</a>
	</div>
</section>

<style>
	.hero {
		background: var(--mint-50);
		padding: 32px 0 28px;
		margin-bottom: 8px;
	}
	.lead {
		font-size: 18px;
	}
	.steps {
		padding-left: 20px;
		display: grid;
		gap: 12px;
	}
	.filter {
		margin-bottom: 12px;
		gap: 8px;
	}
	.filter select {
		min-height: 48px;
		min-width: 0;
	}
	.tutor {
		display: flex;
		gap: 12px;
		align-items: center;
		text-decoration: none;
		color: inherit;
	}
	.tutor .grow {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.avatar,
	.avatar-img {
		flex: none;
		width: 64px;
		height: 64px;
		border-radius: 50%;
		object-fit: cover;
	}
	.avatar {
		display: grid;
		place-items: center;
		background: var(--mint-100, #d7efe6);
		font-weight: 700;
	}
	.join {
		margin-top: 24px;
	}
</style>
