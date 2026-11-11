<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay, fmtDayTime, fmtTime, localDate } from '#lib/tz.ts';
	import { waLink } from '#lib/whatsapp.ts';
	import { formatMoney } from '#lib/money.ts';
	let { data, form } = $props();
	const isToday = (d: Date) => localDate(d) === localDate(data.now);
	const next = $derived(data.upcoming[0]);
	const waOf = (slug: string | null) => data.tutors.find((t) => t.slug === slug)?.whatsapp ?? null;
	const bookHref = $derived(
		data.tutors.filter((t) => t.active).length === 1
			? `/student/book?tutor=${data.tutors.find((t) => t.active)!.slug}`
			: '/student/book'
	);
	const status = (s: string) =>
		({
			requested: m.status_requested(),
			proposed: m.status_proposed(),
			declined: m.status_declined()
		})[s] ?? s;
</script>

<svelte:head><title>{m.student_title()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<h1>{m.hello({ name: data.name.split(' ')[0] })}</h1>
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if form?.done}<p class="notice" role="status">{t(`sdone_${form.done}`)}</p>{/if}

	{#if data.attention.length}
		<div class="card attention">
			<h2 class="h3">{m.att_title()}</h2>
			<ul class="plain">
				{#each data.attention as a, i (i)}
					<li>
						<a href={a.link}
							>{a.kind === 'owe'
								? m.att_owe({
										amount: formatMoney(
											Number(a.text.values.amount),
											String(a.text.values.currency) as 'USD'
										),
										name: String(a.text.values.name)
									})
								: t(a.text.key, a.text.values)}</a
						>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if next}
		<div class="band">
			<div class="band-label">{m.next_lesson()}</div>
			<p class="band-big">
				{next.subjectName ?? m.intro_chat()} · {isToday(next.startsAt)
					? m.today_word()
					: fmtDay(next.startsAt)}
				{fmtTime(next.startsAt)}
			</p>
			<p class="small">
				{next.mode === 'online' ? m.online_room() : m.mode_in_person()}{#if next.tutorName}
					· {m.with_tutor({ name: next.tutorName })}{/if}
			</p>
			{#if next.roomOpen}<a class="btn btn-secondary" href="/room/{next.id}">{m.room_join()}</a
				>{:else if next.mode === 'online'}<p class="small">{m.room_opens_soon()}</p>{/if}
		</div>
	{/if}

	{#each data.packages as p (p.id)}
		<div class="card row">
			<span class="grow"
				><b>{p.name}</b><span class="small muted block"
					>{m.package_balance()}{#if p.tutorName}
						· {p.tutorName}{/if}</span
				></span
			><span class="pill p-ok"
				>{m.left_of({ left: p.lessonsTotal - p.lessonsUsed, total: p.lessonsTotal })}</span
			>
		</div>
	{/each}

	{#if data.requests.length}
		<h2 id="requests">{m.my_requests()}</h2>
		{#each data.requests as r (r.id)}
			<div class="card">
				<div class="row">
					<b class="grow"
						>{r.kind === 'intro' ? m.intro_chat() : r.subjectName} · {fmtDayTime(r.startsAt)}</b
					><span
						class="pill {r.status === 'declined'
							? 'p-no'
							: r.status === 'proposed'
								? 'p-info'
								: 'p-wait'}">{status(r.status)}</span
					>
				</div>
				{#if r.tutorName}<p class="small muted">{m.with_tutor({ name: r.tutorName })}</p>{/if}
				{#if r.tutorMessage}<p class="small quote">“{r.tutorMessage}”</p>{/if}
				{#if r.status === 'proposed' && r.proposedStartsAt}
					<p class="small">{m.tutor_suggests({ when: fmtDayTime(r.proposedStartsAt) })}</p>
					<div class="row">
						<form method="POST" action="?/respond">
							<input type="hidden" name="id" value={r.id} /><input
								type="hidden"
								name="answer"
								value="yes"
							/><button class="btn btn-sm" type="submit">{m.accept_new_time()}</button>
						</form>
						<form method="POST" action="?/respond">
							<input type="hidden" name="id" value={r.id} /><input
								type="hidden"
								name="answer"
								value="no"
							/><button class="btn btn-secondary btn-sm" type="submit">{m.no_thanks()}</button>
						</form>
					</div>
				{:else if r.status === 'requested'}
					<form method="POST" action="?/withdraw">
						<input type="hidden" name="id" value={r.id} /><button class="btn-link" type="submit"
							>{m.withdraw_request()}</button
						>
					</form>
				{:else}
					<a class="small" href={bookHref}>{m.choose_another_time()}</a>
				{/if}
			</div>
		{/each}
	{/if}

	<h2>{m.upcoming_lessons()}</h2>
	{#each data.upcoming as l (l.id)}
		<div class="card">
			<div class="row">
				<a class="grow" href="/student/lessons/{l.id}"><b>{l.subjectName ?? m.intro_chat()}</b></a
				><span class="pill {l.kind === 'intro' ? 'p-info' : 'p-ok'}"
					>{l.kind === 'intro' ? m.tag_intro() : m.status_confirmed()}</span
				>
			</div>
			<p class="small muted">
				{isToday(l.startsAt) ? m.today_word() : fmtDay(l.startsAt)} · {fmtTime(
					l.startsAt
				)}–{fmtTime(l.endsAt)} · {l.mode === 'online'
					? m.mode_online()
					: m.mode_in_person()}{#if l.tutorName}
					· {l.tutorName}{/if}
			</p>
			<div class="row">
				{#if l.roomOpen}<a class="btn btn-sm" href="/room/{l.id}">{m.room_join()}</a>{/if}
				<a class="btn btn-secondary btn-sm" href="/lessons/{l.id}/ics">{m.add_to_calendar()}</a>
				{#if l.canCancel}
					<form method="POST" action="?/cancel">
						<input type="hidden" name="id" value={l.id} /><button
							class="btn btn-warn btn-sm"
							type="submit">{m.cancel()}</button
						>
					</form>
				{:else}
					<span class="small muted"
						>{m.cancel_too_late({ hours: l.cancelHours })}{#if waOf(l.tutorSlug)}
							<a href={waLink(waOf(l.tutorSlug)!)} target="_blank" rel="noopener noreferrer"
								>WhatsApp</a
							>{/if}</span
					>
				{/if}
			</div>
		</div>
	{:else}
		<p class="empty">{m.no_lessons_yet()}</p>
	{/each}
	<a class="btn btn-block" href={bookHref}>{m.book_lesson()}</a>

	{#if data.past.length}
		<h2>{m.past_lessons()}</h2>
		<ul class="list card">
			{#each data.past.slice(0, 10) as l (l.id)}<li>
					<span>{l.subjectName ?? m.intro_chat()}</span><span class="small muted"
						>{fmtDay(l.startsAt)}</span
					>
				</li>{/each}
		</ul>
	{/if}
	<h2>{m.my_tutors()}</h2>
	{#each data.tutors as tu (tu.slug)}
		<div class="card row">
			<span class="grow"
				>{#if tu.active}<a href="/t/{tu.slug}">{tu.name ?? m.tutor_word()}</a>{:else}{tu.name ??
						m.tutor_word()}
					<span class="small muted">({m.tutor_unavailable()})</span>{/if}</span
			>
			{#if tu.reviewable}<a class="btn btn-secondary btn-sm" href="/student/review?tutor={tu.slug}"
					>{m.leave_review()}</a
				>{/if}
		</div>
	{:else}
		<p class="empty">{m.no_tutors_yet()}</p>
	{/each}
	<a class="btn btn-secondary btn-block" href="/tutors">{m.find_a_tutor()}</a>

	{#if data.favourites.length}
		<h2>{m.fav_title()}</h2>
		<ul class="list card">
			{#each data.favourites as f (f.slug)}<li><a href="/t/{f.slug}">{f.name}</a></li>{/each}
		</ul>
	{/if}
	{#if data.isParent}
		<p><a href="/student/children">{m.children_manage({ n: data.children.length })}</a></p>
	{/if}
	<p style="margin-top:16px"><a href="/account">{m.nav_account()}</a></p>
</section>
