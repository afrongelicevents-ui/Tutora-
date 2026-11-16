<script lang="ts">
	import { photoSrc } from '#lib/photo-slots.ts';
	import { page } from '$app/state';
	import { m } from '#lib/i18n.ts';
	import { fmtDay, fmtTime } from '#lib/tz.ts';
	import LineIcon from '#lib/components/LineIcon.svelte';
	import Hero from '#lib/components/ui/Hero.svelte';
	import Avatar from '#lib/components/ui/Avatar.svelte';
	let { data } = $props();
	const guardians = $derived(data.kids.filter((k) => k.guardian));
	const readers = $derived(data.kids.filter((k) => k.readsMessages));
</script>

<svelte:head><title>{m.v3_nav_tutors()} · Tutora</title></svelte:head>

<div class="screen ui-page">
	<Hero
		title={m.pf_tutors_h()}
		lead={m.pf_tutors_lead()}
		photo={photoSrc(page.data.photos, 'parent_tutors')}
		photoAlt={m.pf_photo_helping_alt()}
		photoWidth={625}
		photoHeight={640}
	/>

	{#each data.kids as k (k.id)}
		<section class="ui-card" aria-labelledby="k-{k.id}">
			<div class="kid-h">
				<Avatar name={k.name} photo={k.photo} size={48} />
				<h2 id="k-{k.id}" class="ui-serif">{k.name}</h2>
			</div>
			<ul class="rows-list">
				{#each k.tutors as tu (tu.slug)}
					<li>
						<span class="who"
							><span class="ui-ico blue"><LineIcon name="tutors" size={18} /></span>{tu.name}</span
						>
						<span class="acts">
							<a class="small" href="/t/{tu.slug}">{m.pf_profile()}</a>
							{#if k.guardian}<a
									class="small"
									href="/parent/book?child={encodeURIComponent(k.id)}&tutor={tu.slug}"
									>{m.pf_book()}</a
								>{/if}
						</span>
					</li>
				{:else}
					<li class="muted">{m.pf_no_tutor_for({ name: k.name })}</li>
				{/each}
			</ul>
			{#if k.lessonsShared && k.upcoming.length}
				<h3 class="sub">{m.par3_upcoming()}</h3>
				<ul class="rows-list">
					{#each k.upcoming as l (l.id)}
						<li>
							<span>{l.subjectName ?? m.intro_chat()}{l.tutorName ? ` · ${l.tutorName}` : ''}</span>
							<span class="small muted">{fmtDay(l.startsAt)} {fmtTime(l.startsAt)}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{:else}
		<div class="ui-card">
			<p class="muted">{m.par_no_children()}</p>
			<a class="ui-btn" href="/parent/settings#add">{m.par_add_child_code_h()}</a>
		</div>
	{/each}

	{#if data.kids.length}
		<section class="ui-card" id="lessons" aria-labelledby="les-h">
			<div class="ui-sec-h"><h2 id="les-h">{m.pf_lessons()}</h2></div>
			<ul class="rows-list">
				{#each data.kids as k (k.id)}
					<li>
						<span>{k.name}</span>
						<a class="small" href="/parent/child/{k.id}#lessons">{m.pf_see_lessons()} ›</a>
					</li>
				{/each}
			</ul>
		</section>

		<section class="ui-card sky" id="messages" aria-labelledby="msg-h">
			<div class="ui-sec-h"><h2 id="msg-h">{m.pf_messages()}</h2></div>
			{#each readers as k (k.id)}
				<a class="row-link" href="/parent/messages?child={encodeURIComponent(k.id)}"
					><span class="ui-ico amber"><LineIcon name="chat" size={18} /></span>
					<span>{m.pf_messages_of({ name: k.name })}</span><span>›</span></a
				>
			{:else}
				<p class="small muted">{m.pf_messages_none()}</p>
			{/each}
		</section>

		<section class="ui-card cream" id="find" aria-labelledby="find-h">
			<div class="ui-sec-h"><h2 id="find-h">{m.pf_find_tutor()}</h2></div>
			<p class="small">{m.pf_find_lead()}</p>
			<div class="find">
				{#each guardians as k (k.id)}
					<a class="ui-btn" href="/parent/book?child={encodeURIComponent(k.id)}"
						><LineIcon name="search" size={18} /> {m.pf_find_for({ name: k.name })}</a
					>
				{:else}
					<p class="small muted">{m.pf_find_guardian_only()}</p>
				{/each}
				<a class="ui-btn-soft" href="/tutors">{m.pf_browse()} ›</a>
			</div>
		</section>
	{/if}
</div>

<style>
	.kid-h {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 6px;
	}
	.kid-h h2 {
		margin: 0;
		font-size: 1.375rem;
	}
	.sub {
		margin: 12px 0 0;
		font-size: 0.9375rem;
		color: var(--muted);
	}
	.rows-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.rows-list li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		padding: 10px 0;
		border-bottom: 1px solid var(--border);
		flex-wrap: wrap;
	}
	.rows-list li:last-child {
		border-bottom: none;
	}
	.who {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-weight: 600;
	}
	.who .ui-ico,
	.row-link .ui-ico {
		width: 34px;
		height: 34px;
		border-radius: 50%;
	}
	.acts {
		display: flex;
		gap: 14px;
	}
	.ui-sec-h {
		margin-bottom: 8px;
	}
	.row-link {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 0;
		color: var(--navy);
		text-decoration: none;
		font-weight: 600;
	}
	.row-link span:nth-child(2) {
		flex: 1;
	}
	.find {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 8px;
	}
</style>
