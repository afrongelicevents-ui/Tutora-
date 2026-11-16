import { fail } from '@sveltejs/kit';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { answersToCheck, countStudents } from '#lib/server/people.ts';
import { myNotifications } from '#lib/server/notify.ts';
import { requireTutor } from '#lib/server/guards.ts';
import { SubmitFail, submitForApproval } from '#lib/server/tutor.ts';
import type { Actions, PageServerLoad } from './$types';
import { lessonsBetween, pendingRequests } from '#lib/server/bookings.ts';
import { conversations } from '#lib/server/messages.ts';
import { OPEN_BEFORE_MIN } from '#lib/server/room.ts';
import { getSettings, listAvailability, listSubjects } from '#lib/server/settings.ts';
import { inboxActions } from '#lib/server/actions/tutor-inbox.ts';
import { briefsForRequests } from '#lib/server/brief.ts';
import { attendee, lesson, profile } from '#lib/server/db/app.schema.ts';
import { joinLinks } from '#lib/server/meeting-links.ts';
import { addDays, local, startOfLocalDay, startOfLocalWeek } from '#lib/tz.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	const db = locals.db;
	const now = new Date();
	const day = startOfLocalDay(now);
	const week = startOfLocalWeek(now);
	// one range covering this week and the next 15 days (was three separate lookups)
	const from = week < day ? week : day;
	const toWeek = addDays(week, 7);
	const toSoon = addDays(day, 15);
	const [all, requests, s, subjects, times, students] = await Promise.all([
		lessonsBetween(db, t, from, toWeek > toSoon ? toWeek : toSoon),
		pendingRequests(db, t),
		getSettings(db, t),
		listSubjects(db, t),
		listAvailability(db, t),
		countStudents(db, t)
	]);
	// the same rule as lessonsBetween: lessons starting in [a, b)
	const inRange = (a: Date, b: Date) => all.filter((l) => l.startsAt >= a && l.startsAt < b);
	const lessons = inRange(day, addDays(day, 1));
	const weekLessons = inRange(week, toWeek);
	const soon = inRange(day, toSoon);
	// the next lesson that hasn't finished (today or in the next two weeks)
	const next = soon.find((l) => l.endsAt > now) ?? null;
	const ids = [...new Set(lessons.flatMap((l) => l.people.map((p) => p.userId)))];
	const lessonIds = lessons.map((l) => l.id);
	// lessons come from THIS tutor only, so these lookups stay inside their own lessons
	// (an empty list matches nothing: drizzle turns `in ()` into `false`)
	// these four lookups don't depend on each other: start them together (one database batch)
	const phonesQ = db
		.select({ userId: profile.userId, phone: profile.phone, parentPhone: profile.parentPhone })
		.from(profile)
		.where(inArray(profile.userId, ids));
	// today's join links and the next lesson's, in one go: the lesson's own meeting, else the
	// class link (group lessons), else the student's own link
	const forJoin = next && !lessonIds.includes(next.id) ? [...lessons, next] : lessons;
	const meetingsQ = joinLinks(
		db,
		forJoin.map((l) => ({
			lessonId: l.id,
			tutorId: t,
			studentIds: l.people.map((p) => p.userId),
			group: l.capacity > 1
		}))
	);
	const placesQ = db
		.select({
			id: attendee.id,
			lessonId: attendee.lessonId,
			userId: attendee.userId,
			attendance: attendee.attendance,
			address: lesson.address
		})
		.from(attendee)
		.innerJoin(lesson, eq(lesson.id, attendee.lessonId))
		.where(
			and(
				eq(lesson.tutorId, t),
				inArray(attendee.lessonId, lessonIds),
				ne(attendee.status, 'cancelled')
			)
		);
	const [convs, phones, allMeetings, places] = (await Promise.all([
		conversations(db, t, 'tutor'),
		phonesQ,
		meetingsQ,
		placesQ
	])) as [
		Awaited<ReturnType<typeof conversations>>,
		{ userId: string; phone: string | null; parentPhone: string | null }[],
		Awaited<ReturnType<typeof joinLinks>>,
		{
			id: number;
			lessonId: number;
			userId: string;
			attendance: 'completed' | 'absent' | null;
			address: string | null;
		}[]
	];
	const meetingOf = (id: number) => {
		const j = allMeetings.get(id);
		return j ? { lessonId: id, provider: j.provider, joinUrl: j.url } : null;
	};
	const nextMeeting = next ? meetingOf(next.id) : null;
	// what is still missing from setup (shown as a reminder, never forced)
	const missing = [
		!s.tutorName && 'profile',
		!subjects.length && 'subjects',
		!times.length && 'times',
		!s.whatsappNumber && !s.contactEmail && 'contact',
		!s.bankAccountNumber && !s.ecocashNumber && !s.innbucksNumber && 'payments'
	].filter(Boolean) as string[];
	return {
		hour: local(now).minutes / 60,
		next: next
			? {
					id: next.id,
					startsAt: next.startsAt,
					endsAt: next.endsAt,
					mode: next.mode,
					subjectName: next.subjectName,
					who: next.people.map((p) => p.name),
					joinUrl: nextMeeting?.joinUrl?.startsWith('https://') ? nextMeeting.joinUrl : null,
					provider: nextMeeting?.provider ?? null,
					open:
						next.mode === 'online' &&
						now.getTime() >= next.startsAt.getTime() - OPEN_BEFORE_MIN * 60_000
				}
			: null,
		messages: convs.slice(0, 2),
		unreadMessages: convs.reduce((a, c) => a + c.unread, 0),
		openBeforeMin: OPEN_BEFORE_MIN,
		now,
		name: s.tutorName || locals.user!.name,
		currency: s.currency,
		stats: {
			students,
			week: weekLessons.length
		},
		lessons: lessons.map((l) => {
			const mine = places.filter((p) => p.lessonId === l.id);
			return {
				...l,
				address: mine.find((p) => p.address)?.address ?? null,
				meeting: meetingOf(l.id),
				people: l.people.map((p) => {
					const ph = phones.find((x) => x.userId === p.userId);
					const a = mine.find((x) => x.userId === p.userId);
					return {
						...p,
						attendeeId: a?.id ?? null,
						attendance: a?.attendance ?? null,
						phone: ph?.phone ?? ph?.parentPhone ?? null
					};
				})
			};
		}),
		requests,
		briefs: await briefsForRequests(db, t, requests, now),
		missing,
		toCheck: (await answersToCheck(db, t)).length,
		activity: (await myNotifications(db, t, 5)).map((n) => ({
			id: n.id,
			title: n.title,
			createdAt: n.createdAt
		}))
	};
};

export const actions: Actions = {
	...inboxActions,
	submit: async ({ locals, url }) => {
		const t = requireTutor(locals.user, url).id;
		try {
			await submitForApproval(locals.db, t);
		} catch (e) {
			if (e instanceof SubmitFail) return fail(400, { error: e.message });
			throw e;
		}
		return { done: 'submitted' };
	}
};
