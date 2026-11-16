<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import LineIcon from '#lib/components/LineIcon.svelte';
	import Avatar from '#lib/components/ui/Avatar.svelte';
	/**
	 * "Tutora recommended tutors" for one child (Tutora Family). On the free level: a teaser
	 * with the Family pill and Upgrade, never tutor names.
	 */
	type Rec =
		| {
				locked: false;
				hasSubjects: boolean;
				tutors: {
					slug: string;
					name: string;
					hasPhoto: boolean;
					photoVersion: number;
					subjects: string[];
					rating: number | null;
					reviewCount: number;
					verified: boolean;
					hasTimes: boolean;
					pinned: boolean;
				}[];
		  }
		| { locked: true; count: number };
	let {
		rec,
		childId,
		childName,
		canBook = false
	}: { rec: Rec; childId: string; childName: string; canBook?: boolean } = $props();
</script>

<div class="rec" data-testid="recommended" data-locked={rec.locked ? 'yes' : 'no'}>
	<div class="rec-h">
		<h3 class="sub">{m.rec_title({ name: childName })}</h3>
		<span class="fam-pill">{m.rec_family()}</span>
	</div>
	{#if rec.locked}
		<ul class="cards teaser" aria-hidden="true">
			{#each Array(Math.min(rec.count, 3)) as _, i (i)}
				<li class="card"><span class="ph-av"></span><span class="ph-l"></span></li>
			{/each}
		</ul>
		<p class="small">{m.rec_locked()}</p>
		<a class="ui-btn sm" href="/parent/plans?locked=recommend">{m.fb_upgrade()}</a>
	{:else if rec.tutors.length}
		<p class="small muted">{rec.hasSubjects ? m.rec_lead() : m.rec_lead_nosubj()}</p>
		<ul class="cards">
			{#each rec.tutors as tu (tu.slug)}
				<li class="card" data-rec-tutor={tu.slug}>
					<Avatar
						name={tu.name}
						photo={tu.hasPhoto ? `/t/${tu.slug}/photo?v=${tu.photoVersion}` : null}
						size={44}
					/>
					<div class="grow">
						<a class="name" href="/t/{tu.slug}">{tu.name}</a>
						<p class="small muted">{tu.subjects.join(' · ')}</p>
						<p class="tags">
							{#if tu.rating !== null}<span class="tag"
									><LineIcon name="star" size={14} /> {tu.rating} ({tu.reviewCount})</span
								>{/if}
							{#if tu.verified}<span class="tag ok">{m.rec_verified()}</span>{/if}
							{#if tu.hasTimes}<span class="tag">{m.rec_times()}</span>{/if}
						</p>
					</div>
					{#if canBook}<a
							class="ui-btn-soft sm"
							href="/parent/book?child={encodeURIComponent(childId)}&tutor={tu.slug}"
							>{m.pf_book()}</a
						>{/if}
				</li>
			{/each}
		</ul>
		<p class="small muted">{m.rec_why()}</p>
	{:else}
		<p class="small muted">{m.rec_none()}</p>
	{/if}
</div>

<style>
	.rec {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--ui-line, rgba(11, 37, 69, 0.1));
	}
	.rec-h {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.rec-h .sub {
		margin: 0;
	}
	.fam-pill {
		font-size: 0.75rem;
		font-weight: 700;
		padding: 2px 10px;
		border-radius: 999px;
		background: #0b2545;
		color: #f4d58d;
	}
	.cards {
		list-style: none;
		margin: 8px 0;
		padding: 0;
		display: grid;
		gap: 8px;
	}
	.card {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px;
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.7);
		border: 1px solid rgba(11, 37, 69, 0.08);
	}
	.grow {
		flex: 1;
		min-width: 0;
	}
	.name {
		font-weight: 700;
	}
	.grow p {
		margin: 2px 0 0;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.tag {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: 0.75rem;
		padding: 1px 8px;
		border-radius: 999px;
		background: #e8f0fb;
		color: #1a4f8f;
	}
	.tag.ok {
		background: #e3f4ea;
		color: #1f6b43;
	}
	.teaser .card {
		filter: blur(1.5px);
		opacity: 0.7;
	}
	.ph-av {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: #d7e3f4;
	}
	.ph-l {
		flex: 1;
		height: 12px;
		border-radius: 6px;
		background: #d7e3f4;
	}
</style>
