import { z } from 'zod';
import { parseMoney } from '../money.ts';
import { hhmmToMinutes } from '../tz.ts';

/** Empty text boxes become null (= "not filled in", so the public site hides it). */
const text = (max: number) =>
	z
		.string()
		.trim()
		.max(max, 'err_too_long')
		.optional()
		.transform((v) => (v ? v : null));
const phone = z
	.string()
	.trim()
	.optional()
	.transform((v) => (v ? v : null))
	.refine((v) => v === null || /^\+?[0-9 ()-]{9,20}$/.test(v), 'err_phone');
const email = z
	.string()
	.trim()
	.toLowerCase()
	.optional()
	.transform((v) => (v ? v : null))
	.refine((v) => v === null || z.email().safeParse(v).success, 'err_email');
const int = (min: number, max: number) =>
	z.coerce
		.number({ error: 'err_number' })
		.int('err_number')
		.min(min, 'err_number')
		.max(max, 'err_number');
const optionalInt = (min: number, max: number) =>
	z
		.string()
		.trim()
		.optional()
		.transform((v) => (v ? Number(v) : null))
		.refine((v) => v === null || (Number.isInteger(v) && v >= min && v <= max), 'err_number');
const moneyField = z
	.string()
	.trim()
	.optional()
	.transform((v, ctx) => {
		if (!v) return null;
		const c = parseMoney(v);
		if (c === null) {
			ctx.addIssue({ code: 'custom', message: 'err_money' });
			return z.NEVER;
		}
		return c;
	});
const checkbox = z
	.string()
	.optional()
	.transform((v) => v === 'on' || v === 'true');

export const profileSchema = z.object({
	tutorName: text(80),
	headline: text(120),
	bio: text(2000),
	qualifications: text(300),
	yearsTeaching: optionalInt(0, 60),
	teachingStyle: text(1000),
	languages: text(120),
	town: text(80)
});

export const teachingSchema = z.object({
	lessonModes: z.enum(['online', 'in_person', 'both'], 'err_required'),
	groupMode: z.enum(['one_to_one', 'groups', 'both'], 'err_required'),
	maxGroupSize: int(2, 20),
	lessonMinutes: int(15, 240),
	cancelHours: int(0, 168)
});

export const pricesSchema = z.object({
	defaultPrice: moneyField,
	showPrices: checkbox,
	offersIntro: checkbox,
	currency: z.enum(['USD', 'ZWG'], 'err_required')
});

export const contactSchema = z.object({
	whatsappNumber: phone,
	phone: phone,
	contactEmail: email
});

export const paymentDetailsSchema = z.object({
	bankName: text(80),
	bankAccountName: text(80),
	bankAccountNumber: text(40),
	bankBranch: text(80),
	ecocashNumber: phone,
	ecocashName: text(80),
	innbucksNumber: phone,
	innbucksName: text(80),
	paymentNote: text(300),
	acceptsCash: checkbox
});

export const subjectSchema = z.object({
	name: z.string().trim().min(2, 'err_required').max(60, 'err_too_long'),
	levels: z.string().trim().max(200, 'err_too_long').default(''),
	price: moneyField
});

export const packageSchema = z.object({
	name: z.string().trim().min(2, 'err_required').max(60, 'err_too_long'),
	lessonCount: int(1, 100),
	price: moneyField.refine((v) => v !== null, 'err_money')
});

export const resultSchema = z.object({
	value: z.string().trim().min(1, 'err_required').max(20, 'err_too_long'),
	label: z.string().trim().min(2, 'err_required').max(80, 'err_too_long')
});

export interface AvailabilityRow {
	weekday: number;
	startMinute: number;
	endMinute: number;
}

/**
 * Weekly free times from the form: for each day 0-6, fields `on{d}`, `from{d}`, `to{d}`.
 * One window per day keeps the form simple on a phone.
 */
export function parseAvailability(
	form: Record<string, string>
): { ok: true; rows: AvailabilityRow[] } | { ok: false; errors: Record<string, string> } {
	const rows: AvailabilityRow[] = [];
	const errors: Record<string, string> = {};
	for (let d = 0; d < 7; d++) {
		if (form[`on${d}`] !== 'on') continue;
		const from = hhmmToMinutes(form[`from${d}`] ?? '');
		const to = hhmmToMinutes(form[`to${d}`] ?? '');
		if (from === null || to === null || from >= to) {
			errors[`day${d}`] = 'err_times';
			continue;
		}
		rows.push({ weekday: d, startMinute: from, endMinute: to });
	}
	return Object.keys(errors).length ? { ok: false, errors } : { ok: true, rows };
}
