<script lang="ts" module>
	/** Initials on a coloured circle (one of a few calm blues, picked from the name). */
	const COLOURS = ['#1a5fae', '#0b2545', '#2f6f9f', '#3d86d8', '#1f4e8a', '#285f86'];
	export function avatarColour(name: string) {
		let h = 0;
		for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
		return COLOURS[h % COLOURS.length];
	}
	export function initialsOf(name: string) {
		return name
			.replace(/\./g, '')
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0]!.toUpperCase())
			.join('');
	}
</script>

<script lang="ts">
	// The profile header: large photo, name, grade, bio, then streak / badges / subjects.
	// Used for the student's own profile and (read-only) for a buddy's profile.
	import type { Snippet } from 'svelte';
	import { m, t } from '#lib/i18n.ts';
	let {
		photoUrl = null,
		displayName,
		grade = null,
		bio = null,
		bioNote = '',
		streak,
		badges,
		subjects,
		favourite = null,
		children
	}: {
		photoUrl?: string | null;
		displayName: string;
		grade?: string | null;
		bio?: string | null;
		/** shown to the owner of the profile only: "waiting for a check" etc. */
		bioNote?: string;
		streak: number;
		badges: string[];
		subjects: string[];
		favourite?: string | null;
		children?: Snippet;
	} = $props();
</script>

<section class="pc">
	<div class="top">
		{#if photoUrl}
			<img class="photo" src={photoUrl} alt="" width="112" height="112" />
		{:else}
			<span class="photo initials" style="background:{avatarColour(displayName)}" aria-hidden="true"
				>{initialsOf(displayName)}</span
			>
		{/if}
		<h1>{displayName}</h1>
		{#if grade}<p class="grade">{grade}</p>{/if}
		{#if bio}<p class="bio">{bio}</p>{/if}
		{#if bioNote}<p class="note">{bioNote}</p>{/if}
		{@render children?.()}
	</div>

	<div class="stats">
		<div><strong>{streak}</strong><span>{m.pf_streak()}</span></div>
		<div><strong>{badges.length}</strong><span>{m.pf_badges()}</span></div>
		<div><strong>{subjects.length}</strong><span>{m.pf_subjects()}</span></div>
	</div>

	{#if badges.length}
		<ul class="chips badges" aria-label={m.pf_badges()}>
			{#each badges as b (b)}<li>{t(`badge_${b}`)}</li>{/each}
		</ul>
	{/if}
	{#if subjects.length}
		<ul class="chips subjects" aria-label={m.pf_subjects()}>
			{#each subjects as s (s)}
				<li class:fav={favourite && s.toLowerCase() === favourite.toLowerCase()}>
					{s}{#if favourite && s.toLowerCase() === favourite.toLowerCase()}<span class="sr-only">
							({m.pf_favourite()})</span
						><span aria-hidden="true"> ★</span>{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.pc {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.top {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 4px;
	}
	.photo {
		width: 112px;
		height: 112px;
		border-radius: 50%;
		object-fit: cover;
		box-shadow:
			0 0 0 4px #fff,
			0 0 0 6px var(--ocean),
			0 10px 24px rgb(11 37 69 / 0.16);
		margin-bottom: 10px;
	}
	.initials {
		display: grid;
		place-items: center;
		color: #fff;
		font: 600 2.5rem var(--font-display);
	}
	h1 {
		margin: 0;
		font-size: 1.75rem;
		line-height: 1.15;
		color: var(--navy);
	}
	.grade {
		margin: 0;
		color: var(--muted);
		font-weight: 600;
	}
	.bio {
		margin: 8px 0 0;
		max-width: 34ch;
		color: var(--text);
		line-height: 1.5;
	}
	.note {
		margin: 4px 0 0;
		font-size: 0.8125rem;
		color: var(--warn);
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 18px;
		padding: 12px 6px;
	}
	.stats div {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}
	.stats div + div {
		border-left: 1px solid var(--border);
	}
	.stats strong {
		font-size: 1.5rem;
		color: var(--navy);
		line-height: 1.1;
	}
	.stats span {
		font-size: 0.75rem;
		color: var(--muted);
	}
	.chips {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		justify-content: center;
	}
	.chips li {
		padding: 6px 12px;
		border-radius: 99px;
		font-size: 0.8125rem;
		font-weight: 600;
	}
	.badges li {
		background: #fdf3e1;
		color: #6b4600;
	}
	.subjects li {
		background: var(--ice);
		color: var(--navy);
	}
	.subjects li.fav {
		background: var(--navy);
		color: #fff;
	}
</style>
