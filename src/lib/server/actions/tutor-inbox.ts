import { shortName } from '../../names.ts';
import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions } from '@sveltejs/kit';
import { requireTutor } from '../guards.ts';
import { acceptBooking, BookingFail, declineBooking, proposeTime } from '../bookings.ts';
import {
	BillingFail,
	confirmPayment,
	getPayment,
	receiptNumber,
	rejectPayment
} from '../billing.ts';
import { notifyUser } from '../notify.ts';
import { afterAccept } from '../after-accept.ts';
import { toolsEnv } from '../tools/env.ts';
import { formObject } from '../../validation/auth.ts';
import { fmtDayTime, fromLocal, hhmmToMinutes, isIsoDate } from '../../tz.ts';
import { formatMoney } from '../../money.ts';
import { m } from '../../paraglide/messages.js';
import { and, eq, ne } from 'drizzle-orm';
import { user } from '../db/auth.schema.ts';
import { attendee, lesson } from '../db/app.schema.ts';
import { parentsWhoSee } from '../family.ts';
import { setAttendance } from '../people.ts';

const id = z.object({ id: z.coerce.number().int().positive() });
const message = (v: string | undefined) => (v?.trim() ? v.trim().slice(0, 300) : null);

/** Answer booking requests and payments, mark attendance. Used on Today, Earnings and Students. */
export const inboxActions: Actions = {
	accept: async ({ locals, url, request }) => {
		const me = requireTutor(locals.user, url);
		const p = id.safeParse(formObject(await request.formData()));
		if (!p.success) return fail(400, { error: 'err_generic' });
		try {
			const r = await acceptBooking(locals.db, me.id, p.data.id);
			const { meeting } = await afterAccept(locals.db, toolsEnv(url), r);
			// for the confirmation line: who was told (the student and the family who see lessons)
			const [s] = await locals.db
				.select({ name: user.name })
				.from(user)
				.where(eq(user.id, r.userId));
			const family = await parentsWhoSee(locals.db, r.userId, 'lessons');
			return {
				done: 'accepted',
				meeting: meeting?.provider ?? null,
				student: shortName(s?.name ?? ''),
				family: family.length
			};
		} catch (e) {
			if (e instanceof BookingFail) return fail(400, { error: e.code });
			throw e;
		}
	},
	decline: async ({ locals, url, request }) => {
		const me = requireTutor(locals.user, url);
		const f = formObject(await request.formData());
		const p = id.safeParse(f);
		if (!p.success) return fail(400, { error: 'err_generic' });
		try {
			const b = await declineBooking(locals.db, me.id, p.data.id, message(f.message));
			await notifyUser(
				locals.db,
				b.userId,
				m.email_declined_s(),
				m.email_declined_b({
					when: fmtDayTime(b.startsAt),
					extra: f.message ? m.email_message_line({ text: message(f.message) ?? '' }) : ''
				}),
				{ kind: 'booking', link: '/student#requests' }
			);
			return { done: 'declined' };
		} catch (e) {
			if (e instanceof BookingFail) return fail(400, { error: e.code });
			throw e;
		}
	},
	propose: async ({ locals, url, request }) => {
		const me = requireTutor(locals.user, url);
		const f = formObject(await request.formData());
		const p = id.safeParse(f);
		const min = hhmmToMinutes(f.time ?? '');
		if (!p.success || !isIsoDate(f.date ?? '') || min === null)
			return fail(400, { error: 'err_times', id: f.id });
		const when = fromLocal(f.date, min);
		try {
			const b = await proposeTime(locals.db, me.id, p.data.id, when, message(f.message));
			await notifyUser(
				locals.db,
				b.userId,
				m.email_proposed_s(),
				m.email_proposed_b({
					when: fmtDayTime(when),
					extra: f.message ? m.email_message_line({ text: message(f.message) ?? '' }) : ''
				}),
				{ kind: 'booking', link: '/student#requests' }
			);
			return { done: 'proposed' };
		} catch (e) {
			if (e instanceof BookingFail) return fail(400, { error: e.code, id: f.id });
			throw e;
		}
	},
	confirmPayment: async ({ locals, url, request }) => {
		const me = requireTutor(locals.user, url);
		const p = id.safeParse(formObject(await request.formData()));
		if (!p.success) return fail(400, { error: 'err_generic' });
		try {
			const r = await confirmPayment(locals.db, me.id, p.data.id);
			await notifyUser(
				locals.db,
				r.userId,
				m.email_confirmed_s({ receipt: receiptNumber(r.receiptNo) }),
				m.email_confirmed_b({ amount: formatMoney(r.amountCents, r.currency) }),
				{ kind: 'payment', link: '/student/payments?tab=history' }
			);
			return { done: 'confirmed', receipt: receiptNumber(r.receiptNo) };
		} catch (e) {
			if (e instanceof BillingFail) return fail(400, { error: e.code });
			throw e;
		}
	},
	/** After a lesson has started (up to 7 days after): completed or absent, only in MY lessons. */
	attendance: async ({ locals, url, request }) => {
		const me = requireTutor(locals.user, url);
		const f = formObject(await request.formData());
		const p = z.object({ attendeeId: z.coerce.number().int().positive() }).safeParse(f);
		if (!p.success) return fail(400, { error: 'err_generic' });
		const [a] = await locals.db
			.select({
				id: attendee.id,
				userId: attendee.userId,
				attendance: attendee.attendance,
				lessonId: lesson.id,
				startsAt: lesson.startsAt,
				endsAt: lesson.endsAt
			})
			.from(attendee)
			.innerJoin(lesson, eq(lesson.id, attendee.lessonId))
			.where(
				and(
					eq(attendee.id, p.data.attendeeId),
					eq(lesson.tutorId, me.id),
					ne(attendee.status, 'cancelled'),
					ne(lesson.status, 'cancelled')
				)
			);
		if (!a) return fail(404, { error: 'err_not_found' });
		if (a.startsAt.getTime() > Date.now()) return fail(400, { error: 'err_not_started' });
		if (a.endsAt.getTime() < Date.now() - 7 * 86_400_000)
			return fail(400, { error: 'err_too_late_mark' });
		const v = f.value === 'completed' || f.value === 'absent' ? f.value : null;
		await setAttendance(locals.db, me.id, a.id, v);
		// the student is told when they are marked absent
		if (v === 'absent' && a.attendance !== 'absent')
			await notifyUser(
				locals.db,
				a.userId,
				m.absent_s(),
				m.absent_b({ when: fmtDayTime(a.startsAt) }),
				{
					kind: 'lesson',
					link: `/student/lessons/${a.lessonId}`
				}
			);
		return { done: 'attendance' };
	},
	rejectPayment: async ({ locals, url, request }) => {
		const me = requireTutor(locals.user, url);
		const f = formObject(await request.formData());
		const p = id.safeParse(f);
		if (!p.success) return fail(400, { error: 'err_generic' });
		try {
			const before = await getPayment(locals.db, p.data.id, me.id);
			await rejectPayment(locals.db, me.id, p.data.id, message(f.reason));
			if (before)
				await notifyUser(
					locals.db,
					before.userId,
					m.email_rejected_s(),
					m.email_rejected_b({
						amount: formatMoney(before.amountCents, before.currency),
						extra: f.reason ? m.email_reason_line({ text: message(f.reason) ?? '' }) : ''
					}),
					{ kind: 'payment', link: '/student/payments?tab=history' }
				);
			return { done: 'rejected' };
		} catch (e) {
			if (e instanceof BillingFail) return fail(400, { error: e.code });
			throw e;
		}
	}
};
