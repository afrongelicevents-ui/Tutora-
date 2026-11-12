<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay, fmtDayTime, fmtTime, localDate } from '#lib/tz.ts';
	import { waLink } from '#lib/whatsapp.ts';
	let { data, form } = $props();
	const isToday = (d: Date) => localDate(d) === localDate(data.now);
	const waOf = (slug: string | null) => data.tutors.find((x) => x.slug === slug)?.whatsapp ?? null;
	const status = (s: string) =>
		({
			requested: m.status_pending(),
			proposed: m.status_proposed(),
			declined: m.status_declined()
		})[s] ?? s;
	const how = (l: (typeof data.upcoming)[number]) =>
		l.mode === 'in_person'
			? `${m.sh_in_person()}${l.address ? `, ${l.address}` : ''}`
			: `${m.find3_online()} · ${l.meeting === 'meet' ? m.sh_on_meet() : l.meeting === 'teams' ? m.sh_on_teams() : m.sh_on_room()}`;
</script>

<svelte:head><title>{m.ls3_title()} · Tutora</title></svelte:head>

<div class="screen">
	<h1>{m.ls3_title()}</h1>
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if form?.done}<p class="notice" role="status">{t(`sdone_${form.done}`)}</p>{/if}

	{#each data.requests as r (r.id)}
		<div class="card lesson" id="requests">
			<div class="top">
				<strong
					>{r.kind === 'intro' ? m.intro_chat() : r.subjectName}{r.tutorName
						? ` ${m.ls3_with({ name: r.tutorName })}`
						: ''}</strong
				>
				<span
					class="pill {r.status === 'declined'
						? 'p-no'
						: r.status === 'proposed'
							? 'p-info'
							: 'p-wait'}">{status(r.status)}</span
				>
			</div>
			<span class="muted small"
				>{fmtDayTime(r.startsAt)} · {r.mode === 'online'
					? m.find3_online()
					: m.sh_in_person()}</span
			>
			{#if r.tutorMessage}<p class="small quote">“{r.tutorMessage}”</p>{/if}
			{#if r.status === 'proposed' && r.proposedStartsAt}
				<p class="small">{m.tutor_suggests({ when: fmtDayTime(r.proposedStartsAt) })}</p>
				<div class="row">
					<form method="POST" action="?/respond">
						<input type="hidden" name="id" value={r.id} /><input
							type="hidden"
							name="answer"
							value="yes"
						/>
						<button class="btn btn-sm" type="submit">{m.accept_new_time()}</button>
					</form>
					<form method="POST" action="?/respond">
						<input type="hidden" name="id" value={r.id} /><input
							type="hidden"
							name="answer"
							value="no"
						/>
						<button class="btn btn-ghost btn-sm" type="submit">{m.no_thanks()}</button>
					</form>
				</div>
			{:else if r.status === 'requested'}
				<form method="POST" action="?/withdraw">
					<input type="hidden" name="id" value={r.id} />
					<button class="btn-link small" type="submit">{m.withdraw_request()}</button>
				</form>
			{:else}
				<a class="small" href="/student/find">{m.choose_another_time()}</a>
			{/if}
		</div>
	{/each}

	{#each data.upcoming as l (l.id)}
		<div class="card lesson">
			<div class="top">
				<strong
					>{l.subjectName ?? m.intro_chat()}{l.tutorName
						? ` ${m.ls3_with({ name: l.tutorName })}`
						: ''}</strong
				>
				<span class="pill p-ok">{l.kind === 'intro' ? m.tag_intro() : m.status_confirmed()}</span>
			</div>
			<span class="muted small"
				>{isToday(l.startsAt) ? m.sh_today() : fmtDay(l.startsAt)} · {fmtTime(l.startsAt)} · {how(
					l
				)}</span
			>
			<a class="btn btn-block" href="/student/lessons/{l.id}">{m.ls3_open()}</a>
			{#if !l.canCancel}
				<span class="note"
					>{m.cancel_too_late({ hours: l.cancelHours })}{#if waOf(l.tutorSlug)}
						<a href={waLink(waOf(l.tutorSlug)!)} target="_blank" rel="noopener noreferrer"
							>WhatsApp</a
						>{/if}</span
				>
			{/if}
		</div>
	{:else}
		{#if !data.requests.length}
			<div class="empty-state">
				<p class="lead">{m.no_lessons_yet()}</p>
				<a class="btn" href="/student/find">{m.find_a_tutor()}</a>
			</div>
		{/if}
	{/each}

	{#each data.packages as p (p.id)}
		<div class="rows top">
			<div>
				<span><strong>{p.name}</strong>{p.tutorName ? ` · ${p.tutorName}` : ''}</span>
				<span class="pill p-ok"
					>{m.left_of({ left: p.lessonsTotal - p.lessonsUsed, total: p.lessonsTotal })}</span
				>
			</div>
		</div>
	{/each}

	<p class="note">{m.ls3_how_note()}</p>

	{#if data.past.length}
		<section>
			<div class="section-h"><h2>{m.past_lessons()}</h2></div>
			<div class="rows">
				{#each data.past.slice(0, 12) as l (l.id)}
					<a href="/student/lessons/{l.id}"
						><span>{l.subjectName ?? m.intro_chat()}{l.tutorName ? ` · ${l.tutorName}` : ''}</span
						><span class="muted small">{fmtDay(l.startsAt)}</span></a
					>
				{/each}
			</div>
		</section>
	{/if}

	{#if data.tutors.length}
		<section>
			<div class="section-h"><h2>{m.my_tutors()}</h2></div>
			<div class="rows">
				{#each data.tutors as tu (tu.slug)}
					<div>
						{#if tu.active}<a href="/student/tutor/{tu.slug}">{tu.name ?? m.tutor_word()}</a
							>{:else}<span
								>{tu.name ?? m.tutor_word()}
								<span class="small muted">({m.tutor_unavailable()})</span></span
							>{/if}
						{#if tu.reviewable}<a class="small" href="/student/review?tutor={tu.slug}"
								>{m.leave_review()}</a
							>{/if}
					</div>
				{/each}
			</div>
		</section>
	{/if}
	{#if data.favourites.length}
		<section>
			<div class="section-h"><h2>{m.fav_title()}</h2></div>
			<div class="rows">
				{#each data.favourites as f (f.slug)}<a href="/student/tutor/{f.slug}"
						><span>{f.name}</span><span class="go" aria-hidden="true">›</span></a
					>{/each}
			</div>
		</section>
	{/if}
</div>

<style>
	.lesson {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.top {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		align-items: flex-start;
	}
	.top strong {
		font-size: 1rem;
	}
	.rows a {
		text-decoration: none;
	}
	.empty-state {
		display: flex;
		flex-direction: column;
		gap: 12px;
		align-items: flex-start;
	}
</style>
