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
import { m } from '../../paraglide/messages.js';

const id = z.object({ id: z.coerce.number().int().positive() });
const message = (v: string | undefined) => (v?.trim() ? v.trim().slice(0, 300) : null);

/** Answer booking requests and payments. Used on Today and on the Money page. */
export const inboxActions: Actions = {
	accept: async ({ locals, url, request }) => {
		const me = requireTutor(locals.user, url);
		const p = id.safeParse(formObject(await request.formData()));
		if (!p.success) return fail(400, { error: 'err_generic' });
		try {
			const r = await acceptBooking(locals.db, me.id, p.data.id);
			await notifyUser(
				locals.db,
				r.userId,
				m.email_booked_s(),
				m.email_booked_b({ when: fmtDayTime(r.startsAt) })
			);
			return { done: 'accepted' };
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
				})
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
				})
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
				m.email_confirmed_b({ amount: formatMoney(r.amountCents, r.currency) })
			);
			return { done: 'confirmed', receipt: receiptNumber(r.receiptNo) };
		} catch (e) {
			if (e instanceof BillingFail) return fail(400, { error: e.code });
			throw e;
		}
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
					})
				);
			return { done: 'rejected' };
		} catch (e) {
			if (e instanceof BillingFail) return fail(400, { error: e.code });
			throw e;
		}
	}
};
