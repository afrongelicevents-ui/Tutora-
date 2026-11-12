import { fail } from '@sveltejs/kit';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { answersToCheck, countStudents } from '#lib/server/people.ts';
import { myNotifications } from '#lib/server/notify.ts';
import { requireTutor } from '#lib/server/guards.ts';
import { SubmitFail, submitForApproval } from '#lib/server/tutor.ts';
import type { Actions, PageServerLoad } from './$types';
import { lessonsBetween, pendingRequests } from '#lib/server/bookings.ts';
import { monthlyTotals, pendingPayments } from '#lib/server/billing.ts';
import { getSettings, listAvailability, listSubjects } from '#lib/server/settings.ts';
import { fileLink } from '#lib/server/storage.ts';
import { inboxActions } from '#lib/server/actions/tutor-inbox.ts';
import { briefsForRequests } from '#lib/server/brief.ts';
import { attendee, lesson, profile } from '#lib/server/db/app.schema.ts';
import { lessonMeeting } from '#lib/server/db/v3.schema.ts';
import { addDays, fromLocal, localDate, startOfLocalDay, startOfLocalWeek } from '#lib/tz.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	const db = locals.db;
	const now = new Date();
	const day = startOfLocalDay(now);
	const week = startOfLocalWeek(now);
	const thisMonth = localDate(now).slice(0, 7);
	const [lessons, weekLessons, requests, payments, s, subjects, times, students, months] =
		await Promise.all([
			lessonsBetween(db, t, day, addDays(day, 1)),
			lessonsBetween(db, t, week, addDays(week, 7)),
			pendingRequests(db, t),
			pendingPayments(db, t),
			getSettings(db, t),
			listSubjects(db, t),
			listAvailability(db, t),
			countStudents(db, t),
			monthlyTotals(db, t, fromLocal(`${thisMonth}-01`, 0))
		]);
	const ids = [...new Set(lessons.flatMap((l) => l.people.map((p) => p.userId)))];
	const lessonIds = lessons.map((l) => l.id);
	// lessons come from THIS tutor only, so these lookups stay inside their own lessons
	// (an empty list matches nothing: drizzle turns `in ()` into `false`)
	const phones: { userId: string; phone: string | null; parentPhone: string | null }[] = await db
		.select({ userId: profile.userId, phone: profile.phone, parentPhone: profile.parentPhone })
		.from(profile)
		.where(inArray(profile.userId, ids));
	const meetings: { lessonId: number; provider: 'meet' | 'teams'; joinUrl: string }[] = await db
		.select({
			lessonId: lessonMeeting.lessonId,
			provider: lessonMeeting.provider,
			joinUrl: lessonMeeting.joinUrl
		})
		.from(lessonMeeting)
		.where(inArray(lessonMeeting.lessonId, lessonIds));
	const places: {
		id: number;
		lessonId: number;
		userId: string;
		attendance: 'completed' | 'absent' | null;
		address: string | null;
	}[] = await db
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
	// what is still missing from setup (shown as a reminder, never forced)
	const missing = [
		!s.tutorName && 'profile',
		!subjects.length && 'subjects',
		!times.length && 'times',
		!s.whatsappNumber && !s.contactEmail && 'contact',
		!s.bankAccountNumber && !s.ecocashNumber && !s.innbucksNumber && 'payments'
	].filter(Boolean) as string[];
	const month = months.find((x) => x.month === thisMonth && x.currency === s.currency);
	return {
		now,
		name: s.tutorName || locals.user!.name,
		currency: s.currency,
		stats: {
			students,
			week: weekLessons.length,
			monthCents: month?.total ?? 0
		},
		lessons: lessons.map((l) => {
			const mine = places.filter((p) => p.lessonId === l.id);
			return {
				...l,
				address: mine.find((p) => p.address)?.address ?? null,
				meeting: meetings.find((x) => x.lessonId === l.id) ?? null,
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
		payments: await Promise.all(
			payments.map(async (p) => ({
				...p,
				proofUrl: p.proofKey ? await fileLink(p.proofKey, `proof-${p.id}`) : null
			}))
		),
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
