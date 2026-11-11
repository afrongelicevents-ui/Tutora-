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
import { formObject } from '../../validation/auth.ts';
import { fmtDayTime, fromLocal, hhmmToMinutes, isIsoDate } from '../../tz.ts';
import { formatMoney } from '../../money.ts';

const id = z.object({ id: z.coerce.number().int().positive() });
const message = (v: string | undefined) => (v?.trim() ? v.trim().slice(0, 300) : null);

/** Answer booking requests and payments. Used on Today and on the Money page. */
export const inboxActions: Actions = {
	accept: async ({ locals, url, request }) => {
		requireTutor(locals.user, url);
		const p = id.safeParse(formObject(await request.formData()));
		if (!p.success) return fail(400, { error: 'err_generic' });
		try {
			const r = await acceptBooking(locals.db, p.data.id);
			await notifyUser(
				locals.db,
				r.userId,
				'Your lesson is booked',
				`Your lesson on ${fmtDayTime(r.startsAt)} (Zimbabwe time) is confirmed. See it under "Lessons" on Tutora.`
			);
			return { done: 'accepted' };
		} catch (e) {
			if (e instanceof BookingFail) return fail(400, { error: e.code });
			throw e;
		}
	},
	decline: async ({ locals, url, request }) => {
		requireTutor(locals.user, url);
		const f = formObject(await request.formData());
		const p = id.safeParse(f);
		if (!p.success) return fail(400, { error: 'err_generic' });
		try {
			const b = await declineBooking(locals.db, p.data.id, message(f.message));
			await notifyUser(
				locals.db,
				b.userId,
				'About your lesson request',
				`Sorry, the tutor can't do ${fmtDayTime(b.startsAt)}.${f.message ? `\nMessage: ${message(f.message)}` : ''}\nYou can choose another time on Tutora.`
			);
			return { done: 'declined' };
		} catch (e) {
			if (e instanceof BookingFail) return fail(400, { error: e.code });
			throw e;
		}
	},
	propose: async ({ locals, url, request }) => {
		requireTutor(locals.user, url);
		const f = formObject(await request.formData());
		const p = id.safeParse(f);
		const min = hhmmToMinutes(f.time ?? '');
		if (!p.success || !isIsoDate(f.date ?? '') || min === null)
			return fail(400, { error: 'err_times', id: f.id });
		const when = fromLocal(f.date, min);
		try {
			const b = await proposeTime(locals.db, p.data.id, when, message(f.message));
			await notifyUser(
				locals.db,
				b.userId,
				'The tutor suggested another time',
				`The tutor suggests ${fmtDayTime(when)} instead.${f.message ? `\nMessage: ${message(f.message)}` : ''}\nOpen Tutora to accept or say no.`
			);
			return { done: 'proposed' };
		} catch (e) {
			if (e instanceof BookingFail) return fail(400, { error: e.code, id: f.id });
			throw e;
		}
	},
	confirmPayment: async ({ locals, url, request }) => {
		requireTutor(locals.user, url);
		const p = id.safeParse(formObject(await request.formData()));
		if (!p.success) return fail(400, { error: 'err_generic' });
		try {
			const r = await confirmPayment(locals.db, p.data.id);
			await notifyUser(
				locals.db,
				r.userId,
				`Payment confirmed – receipt ${receiptNumber(r.receiptNo)}`,
				`The tutor confirmed your payment of ${formatMoney(r.amountCents, r.currency)}. Your receipt is under "Payments" on Tutora.`
			);
			return { done: 'confirmed', receipt: receiptNumber(r.receiptNo) };
		} catch (e) {
			if (e instanceof BillingFail) return fail(400, { error: e.code });
			throw e;
		}
	},
	rejectPayment: async ({ locals, url, request }) => {
		requireTutor(locals.user, url);
		const f = formObject(await request.formData());
		const p = id.safeParse(f);
		if (!p.success) return fail(400, { error: 'err_generic' });
		try {
			const before = await getPayment(locals.db, p.data.id);
			await rejectPayment(locals.db, p.data.id, message(f.reason));
			if (before)
				await notifyUser(
					locals.db,
					before.userId,
					'About your payment',
					`The tutor could not confirm your payment of ${formatMoney(before.amountCents, before.currency)}.${f.reason ? `\nReason: ${message(f.reason)}` : ''}\nPlease check and send it again, or message the tutor.`
				);
			return { done: 'rejected' };
		} catch (e) {
			if (e instanceof BillingFail) return fail(400, { error: e.code });
			throw e;
		}
	}
};
