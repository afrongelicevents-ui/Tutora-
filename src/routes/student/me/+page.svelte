<script lang="ts">
	// The student's own profile. Photo and name first, then bio, stats, buddies, Edit profile.
	import { m } from '#lib/i18n.ts';
	import ProfileCard, {
		avatarColour,
		initialsOf
	} from '#lib/components/profile/ProfileCard.svelte';
	let { data } = $props();
	const p = $derived(data.profile);
	const photo = $derived(p.photoVersion ? `/profile-photo/${data.id}?v=${p.photoVersion}` : null);
	const bioNote = $derived(
		p.bio && p.bioStatus === 'pending'
			? m.pf_bio_pending()
			: p.bio && p.bioStatus === 'rejected'
				? m.pf_bio_rejected()
				: ''
	);
</script>

<svelte:head><title>{m.pf_title()} · Tutora</title></svelte:head>

<div class="me">
	<ProfileCard
		photoUrl={photo}
		displayName={p.displayName}
		grade={p.grade}
		bio={p.bio}
		{bioNote}
		streak={p.streak}
		badges={p.badges}
		subjects={p.subjects}
		favourite={p.favouriteSubject}
	>
		{#if p.photoStatus === 'pending' && p.photoVersion}<p class="note">{m.pf_photo_pending()}</p>
		{:else if p.photoStatus === 'rejected'}<p class="note">{m.pf_photo_rejected()}</p>{/if}
		{#if !p.bio}<p class="muted small">{m.pf_no_bio()}</p>{/if}
	</ProfileCard>

	{#if !p.badges.length}<p class="muted small center">{m.pf_no_badges()}</p>{/if}

	<section class="panel">
		<h2>{m.pf_goal()}</h2>
		<p>{p.goals ?? m.pf_no_goal()}</p>
	</section>

	<section class="panel">
		<div class="panel-h">
			<h2>{m.pf_buddies()}</h2>
			<a href="/student/buddies">{m.pf_buddies_all()} <span aria-hidden="true">→</span></a>
		</div>
		{#if data.buddies.length}
			<ul class="buddies">
				{#each data.buddies as b (b.id)}
					<li>
						<a href="/student/buddies/{b.id}">
							{#if b.photoVersion}<img
									src="/profile-photo/{b.id}?v={b.photoVersion}"
									alt=""
									width="56"
									height="56"
								/>{:else}<span class="ini" style="background:{avatarColour(b.displayName)}"
									>{initialsOf(b.displayName)}</span
								>{/if}
							<span class="bn">{b.displayName}</span>
							<span class="muted small">{m.bd_streak({ n: b.streak })}</span>
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted">{m.pf_buddies_none()}</p>
			<a class="btn btn-secondary" href="/student/buddies">{m.bd_add()}</a>
		{/if}
		{#if data.pendingCount}<p class="small muted">{m.bd_pending()}: {data.pendingCount}</p>{/if}
	</section>

	<section class="panel private">
		<h2>{m.pf_private()}</h2>
		<ul>
			{#if p.age !== null}<li>{m.pf_age({ n: p.age })}</li>{/if}
			{#if p.school}<li>{p.school}</li>{/if}
		</ul>
	</section>

	<a class="btn edit" href="/student/me/edit">{m.pf_edit()}</a>

	<nav class="rows-nav">
		<a href="/student/family"
			><span
				><strong>{m.pf_family()}</strong><span class="muted small">{m.pf_family_sub()}</span></span
			><span aria-hidden="true">›</span></a
		>
		<a href="/account"
			><span
				><strong>{m.pf_settings()}</strong><span class="muted small">{m.pf_settings_sub()}</span
				></span
			><span aria-hidden="true">›</span></a
		>
	</nav>
</div>

<style>
	.me {
		max-width: 640px;
		margin: 0 auto;
		width: 100%;
		padding: 20px 18px 32px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.note {
		margin: 4px 0 0;
		font-size: 0.8125rem;
		color: var(--warn);
	}
	.center {
		text-align: center;
		margin: -6px 0 0;
	}
	.panel {
		padding: 16px;
		border-radius: 18px;
		background: #fff;
		border: 1px solid var(--border);
	}
	.panel h2 {
		margin: 0 0 6px;
		font-family: var(--font);
		font-size: 1rem;
		font-weight: 700;
		color: var(--navy);
	}
	.panel p {
		margin: 0;
	}
	.panel-h {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 8px;
	}
	.panel-h a {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--ocean);
		text-decoration: none;
		padding: 8px 0;
	}
	.panel .btn {
		margin-top: 10px;
	}
	.buddies {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
	}
	.buddies a {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		text-decoration: none;
		color: var(--text);
		text-align: center;
	}
	.buddies img,
	.ini {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		object-fit: cover;
	}
	.ini {
		display: grid;
		place-items: center;
		color: #fff;
		font: 600 1.25rem var(--font-display);
	}
	.bn {
		font-weight: 600;
		font-size: 0.875rem;
	}
	.private {
		background: var(--snow);
		border-style: dashed;
	}
	.private h2 {
		font-size: 0.8125rem;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.private ul {
		margin: 0;
		padding-left: 18px;
	}
	.edit {
		align-self: center;
		min-width: 180px;
	}
	.rows-nav {
		display: flex;
		flex-direction: column;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 18px;
	}
	.rows-nav a {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		min-height: 60px;
		padding: 8px 16px;
		color: var(--text);
		text-decoration: none;
	}
	.rows-nav a + a {
		border-top: 1px solid var(--border);
	}
	.rows-nav a > span:first-child {
		display: flex;
		flex-direction: column;
	}
</style>
