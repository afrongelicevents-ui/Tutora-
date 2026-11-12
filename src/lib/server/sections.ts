import { fail, redirect, type Actions, type RequestEvent } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { z } from 'zod';
import type { DB } from './db/types.ts';
import {
	addPackage,
	addResult,
	addSubject,
	getSettings,
	listAvailability,
	listPackages,
	listResults,
	listSubjects,
	removePackage,
	removeResult,
	removeSubject,
	replaceAvailability,
	updateSettings,
	updateSubject
} from './settings.ts';
import {
	contactSchema,
	packageSchema,
	parseAvailability,
	paymentDetailsSchema,
	pricesSchema,
	profileSchema,
	resultSchema,
	subjectSchema,
	teachingSchema
} from '../validation/settings.ts';
import { fieldErrors, formObject } from '../validation/auth.ts';
import { readUpload, IMAGE_KINDS, newKey } from './files.ts';
import { getStore } from './storage.ts';
import { requireRole, requireTutor } from './guards.ts';
import { hitLimit, clientIp } from './rate-limit.ts';
import { emailEnabled } from './auth.ts';
import { changeEmailNow } from './account.ts';

export const SECTIONS = [
	'profile',
	'subjects',
	'teaching',
	'prices',
	'times',
	'contact',
	'payments',
	'results',
	'account'
] as const;
export type Section = (typeof SECTIONS)[number];
/** The first-login wizard walks through these, in this order. */
export const WIZARD: Section[] = [
	'profile',
	'subjects',
	'teaching',
	'prices',
	'times',
	'contact',
	'payments'
];
export const PHOTO_MAX_BYTES = 400 * 1024;

export function isSection(s: string): s is Section {
	return (SECTIONS as readonly string[]).includes(s);
}

export async function loadSection(db: DB, tutorId: string, section: Section) {
	const s = await getSettings(db, tutorId);
	const [subjects, packages, times, results] = await Promise.all([
		section === 'subjects' || section === 'prices' ? listSubjects(db, tutorId) : [],
		section === 'prices' ? listPackages(db, tutorId) : [],
		section === 'times' ? listAvailability(db, tutorId) : [],
		section === 'results' ? listResults(db, tutorId) : []
	]);
	return { settings: s, subjects, packages, times, results };
}

type Ev = RequestEvent;
const idSchema = z.object({ id: z.coerce.number().int().positive() });

async function form(ev: Ev) {
	return formObject(await ev.request.formData());
}

/** Form actions shared by the setup wizard and Settings. Every one re-checks: tutor + 2FA. */
export function sectionActions(after: (ev: Ev) => string | null): Actions {
	const guard = (ev: Ev) => requireTutor(ev.locals.user, ev.url);
	const done = (ev: Ev) => {
		const to = after(ev);
		if (to) redirect(303, to);
		return { saved: true };
	};
	return {
		profile: async (ev) => {
			const t = guard(ev).id;
			const data = await ev.request.formData();
			const parsed = profileSchema.safeParse(formObject(data));
			if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error) });
			const patch: Record<string, unknown> = { ...parsed.data };
			// where in-person lessons happen (copied onto each new in-person lesson)
			const addr = data.get('lessonAddress');
			if (typeof addr === 'string') {
				if (addr.trim().length > 200)
					return fail(400, { errors: { lessonAddress: 'err_too_long' } });
				patch.lessonAddress = addr.trim() || null;
			}
			const photo = await readUpload(data.get('photo'), {
				maxBytes: PHOTO_MAX_BYTES,
				allowed: IMAGE_KINDS
			});
			if (photo && !photo.ok)
				return fail(400, {
					errors: { photo: photo.error === 'err_file_big' ? 'err_photo_big' : photo.error }
				});
			if (photo?.ok) {
				const store = getStore(ev.platform);
				const s = await getSettings(ev.locals.db, t);
				const key = newKey('public', photo.ext);
				await store.put(key, photo.bytes, photo.kind);
				if (s.photoKey) await store.delete(s.photoKey).catch(() => {});
				patch.photoKey = key;
				patch.photoVersion = s.photoVersion + 1;
			}
			if (data.get('removePhoto') === 'on') {
				const s = await getSettings(ev.locals.db, t);
				if (s.photoKey)
					await getStore(ev.platform)
						.delete(s.photoKey)
						.catch(() => {});
				patch.photoKey = null;
			}
			await updateSettings(ev.locals.db, t, patch);
			return done(ev);
		},
		teaching: async (ev) => {
			const t = guard(ev).id;
			const parsed = teachingSchema.safeParse(await form(ev));
			if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error) });
			await updateSettings(ev.locals.db, t, parsed.data);
			return done(ev);
		},
		prices: async (ev) => {
			const t = guard(ev).id;
			const f = await form(ev);
			const parsed = pricesSchema.safeParse(f);
			if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error) });
			// subject prices are edited on the same page: price_<id>
			const subjects = await listSubjects(ev.locals.db, t);
			for (const subj of subjects) {
				const field = `price_${subj.id}`;
				if (!(field in f)) continue;
				const p = subjectSchema.shape.price.safeParse(f[field]);
				if (!p.success) return fail(400, { errors: { [field]: 'err_money' } });
				await updateSubject(ev.locals.db, t, subj.id, {
					name: subj.name,
					levels: subj.levels,
					price: p.data
				});
			}
			const { defaultPrice, ...rest } = parsed.data;
			await updateSettings(ev.locals.db, t, { ...rest, defaultPriceCents: defaultPrice });
			return done(ev);
		},
		contact: async (ev) => {
			const t = guard(ev).id;
			const parsed = contactSchema.safeParse(await form(ev));
			if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error) });
			await updateSettings(ev.locals.db, t, parsed.data);
			return done(ev);
		},
		payments: async (ev) => {
			const t = guard(ev).id;
			const parsed = paymentDetailsSchema.safeParse(await form(ev));
			if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error) });
			await updateSettings(ev.locals.db, t, parsed.data);
			return done(ev);
		},
		times: async (ev) => {
			const t = guard(ev).id;
			const f = await form(ev);
			const avail = parseAvailability(f);
			if (!avail.ok) return fail(400, { errors: avail.errors });
			const parsed = teachingSchema.pick({ lessonMinutes: true, cancelHours: true }).safeParse(f);
			if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error) });
			await replaceAvailability(ev.locals.db, t, avail.rows);
			await updateSettings(ev.locals.db, t, parsed.data);
			return done(ev);
		},
		next: async (ev) => {
			// "Next" on list sections (subjects) where items are saved one by one
			guard(ev);
			return done(ev);
		},
		addSubject: async (ev) => {
			const t = guard(ev).id;
			const parsed = subjectSchema.safeParse(await form(ev));
			if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error) });
			await addSubject(ev.locals.db, t, parsed.data);
			return { saved: true };
		},
		editSubject: async (ev) => {
			const t = guard(ev).id;
			const f = await form(ev);
			const id = idSchema.safeParse(f);
			const parsed = subjectSchema.safeParse(f);
			if (!id.success || !parsed.success)
				return fail(400, { errors: parsed.success ? {} : fieldErrors(parsed.error) });
			await updateSubject(ev.locals.db, t, id.data.id, parsed.data);
			return { saved: true };
		},
		removeSubject: async (ev) => {
			const t = guard(ev).id;
			const id = idSchema.safeParse(await form(ev));
			if (id.success) await removeSubject(ev.locals.db, t, id.data.id);
			return { saved: true };
		},
		addPackage: async (ev) => {
			const t = guard(ev).id;
			const parsed = packageSchema.safeParse(await form(ev));
			if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error) });
			await addPackage(ev.locals.db, t, { ...parsed.data, price: parsed.data.price! });
			return { saved: true };
		},
		removePackage: async (ev) => {
			const t = guard(ev).id;
			const id = idSchema.safeParse(await form(ev));
			if (id.success) await removePackage(ev.locals.db, t, id.data.id);
			return { saved: true };
		},
		addResult: async (ev) => {
			const t = guard(ev).id;
			const parsed = resultSchema.safeParse(await form(ev));
			if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error) });
			await addResult(ev.locals.db, t, parsed.data);
			return { saved: true };
		},
		removeResult: async (ev) => {
			const t = guard(ev).id;
			const id = idSchema.safeParse(await form(ev));
			if (id.success) await removeResult(ev.locals.db, t, id.data.id);
			return { saved: true };
		},
		resultsConsent: async (ev) => {
			const t = guard(ev).id;
			const f = await form(ev);
			await updateSettings(ev.locals.db, t, { resultsConsent: f.consent === 'on' });
			return { saved: true };
		},
		...accountActions()
	};
}

/** Login email and password changes, for tutors and the platform owner. */
export function accountActions(): Actions {
	return {
		changeEmail: async (ev) => {
			const u = requireRole(ev.locals.user, ev.url, ['tutor', 'owner']);
			const limit = await hitLimit(
				ev.locals.db,
				'passwordReset',
				`${clientIp(ev.request)}:${u.id}`
			);
			if (!limit.ok)
				return fail(429, { errors: { newEmail: 'err_rate_limited' }, retryMinutes: 60 });
			const parsed = z
				.object({
					newEmail: z.string().trim().toLowerCase().pipe(z.email('err_email')),
					password: z.string().max(128).optional()
				})
				.safeParse(await form(ev));
			if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error) });
			if (!emailEnabled) {
				// No email service: no link can be sent, so the current password proves it's you.
				const okPw = await ev.locals.auth.api
					.verifyPassword({
						body: { password: parsed.data.password ?? '' },
						headers: ev.request.headers
					})
					.then(() => true)
					.catch(() => false);
				if (!okPw) return fail(400, { errors: { password: 'err_password_wrong' } });
				const r = await changeEmailNow(ev.locals.db, u.id, parsed.data.newEmail);
				if (r === 'same') return fail(400, { errors: { newEmail: 'err_email_same' } });
				if (r === 'taken') return fail(400, { errors: { newEmail: 'err_email_taken' } });
				return { emailChanged: parsed.data.newEmail };
			}
			try {
				await ev.locals.auth.api.changeEmail({
					body: {
						newEmail: parsed.data.newEmail,
						callbackURL: '/tutor/settings/account?changed=1'
					},
					headers: ev.request.headers
				});
			} catch (e) {
				if (e instanceof APIError) return fail(400, { errors: { newEmail: 'err_email_same' } });
				throw e;
			}
			return { emailSent: parsed.data.newEmail };
		},
		changePassword: async (ev) => {
			const u = requireRole(ev.locals.user, ev.url, ['tutor', 'owner']);
			const limit = await hitLimit(
				ev.locals.db,
				'passwordReset',
				`${clientIp(ev.request)}:${u.id}:pw`
			);
			if (!limit.ok)
				return fail(429, { errors: { currentPassword: 'err_rate_limited' }, retryMinutes: 60 });
			const parsed = z
				.object({
					currentPassword: z.string().min(1, 'err_password_wrong').max(128),
					newPassword: z.string().min(10, 'err_password_short').max(128, 'err_too_long')
				})
				.safeParse(await form(ev));
			if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error) });
			try {
				await ev.locals.auth.api.changePassword({
					body: { ...parsed.data, revokeOtherSessions: true },
					headers: ev.request.headers
				});
			} catch (e) {
				if (e instanceof APIError)
					return fail(400, { errors: { currentPassword: 'err_password_wrong' } });
				throw e;
			}
			return { passwordChanged: true };
		}
	};
}
