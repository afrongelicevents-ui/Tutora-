import { fail } from '@sveltejs/kit';
import { requireTutor } from '#lib/server/guards.ts';
import { SubmitFail, submitForApproval } from '#lib/server/tutor.ts';
import type { Actions, PageServerLoad } from './$types';
import { inArray } from 'drizzle-orm';
import { lessonsBetween, pendingRequests } from '#lib/server/bookings.ts';
import { pendingPayments } from '#lib/server/billing.ts';
import { getSettings, listAvailability, listSubjects } from '#lib/server/settings.ts';
import { fileLink } from '#lib/server/storage.ts';
import { inboxActions } from '#lib/server/actions/tutor-inbox.ts';
import { profile } from '#lib/server/db/app.schema.ts';
import { addDays, startOfLocalDay } from '#lib/tz.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	const now = new Date();
	const day = startOfLocalDay(now);
	const [lessons, requests, payments, s, subjects, times] = await Promise.all([
		lessonsBetween(locals.db, t, day, addDays(day, 1)),
		pendingRequests(locals.db, t),
		pendingPayments(locals.db, t),
		getSettings(locals.db, t),
		listSubjects(locals.db, t),
		listAvailability(locals.db, t)
	]);
	const ids = [...new Set(lessons.flatMap((l) => l.people.map((p) => p.userId)))];
	const phones: { userId: string; phone: string | null; parentPhone: string | null }[] = ids.length
		? await locals.db
				.select({ userId: profile.userId, phone: profile.phone, parentPhone: profile.parentPhone })
				.from(profile)
				.where(inArray(profile.userId, ids))
		: [];
	// what is still missing from setup (shown as a reminder, never forced)
	const missing = [
		!s.tutorName && 'profile',
		!subjects.length && 'subjects',
		!times.length && 'times',
		!s.whatsappNumber && !s.contactEmail && 'contact',
		!s.bankAccountNumber && !s.ecocashNumber && !s.innbucksNumber && 'payments'
	].filter(Boolean) as string[];
	return {
		now,
		lessons: lessons.map((l) => ({
			...l,
			people: l.people.map((p) => {
				const ph = phones.find((x) => x.userId === p.userId);
				return { ...p, phone: ph?.phone ?? ph?.parentPhone ?? null };
			})
		})),
		requests,
		payments: await Promise.all(
			payments.map(async (p) => ({
				...p,
				proofUrl: p.proofKey ? await fileLink(p.proofKey, `proof-${p.id}`) : null
			}))
		),
		currency: s.currency,
		missing
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
