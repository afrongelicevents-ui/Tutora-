import { z } from 'zod';
import { SIGNUP_ROLES } from '../roles';

/**
 * Error messages are i18n message keys (see messages/en.json), not English text,
 * so the UI can show them in any language.
 */
const phone = z
	.string()
	.trim()
	.regex(/^\+?[0-9 ()-]{9,20}$/, 'err_phone');
const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max, 'err_too_long')
		.optional()
		.transform((v) => (v ? v : undefined));
const checkbox = z
	.union([z.literal('on'), z.literal('true'), z.literal('')])
	.optional()
	.transform((v) => v === 'on' || v === 'true');

export const emailField = z
	.string()
	.trim()
	.toLowerCase()
	.pipe(z.email('err_email'))
	.pipe(z.string().max(254));
export const passwordField = z.string().min(10, 'err_password_short').max(128, 'err_too_long');

export const signupSchema = z
	.object({
		name: z.string().trim().min(2, 'err_name').max(80, 'err_too_long'),
		email: emailField,
		password: passwordField,
		accountType: z.enum(SIGNUP_ROLES, 'err_account_type'),
		phone: phone.optional().or(z.literal('').transform(() => undefined)),
		isUnder18: checkbox,
		parentName: optionalText(80),
		parentPhone: phone.optional().or(z.literal('').transform(() => undefined)),
		parentEmail: z
			.union([emailField, z.literal('')])
			.optional()
			.transform((v) => (v ? v : undefined)),
		childName: optionalText(80),
		consent: checkbox
	})
	.superRefine((v, ctx) => {
		if (!v.consent) ctx.addIssue({ code: 'custom', path: ['consent'], message: 'err_consent' });
		if (v.accountType === 'parent' && !v.childName) {
			ctx.addIssue({ code: 'custom', path: ['childName'], message: 'err_child_name' });
		}
		if (v.accountType === 'student' && v.isUnder18) {
			if (!v.parentName)
				ctx.addIssue({ code: 'custom', path: ['parentName'], message: 'err_parent_required' });
			if (!v.parentPhone)
				ctx.addIssue({ code: 'custom', path: ['parentPhone'], message: 'err_parent_required' });
		}
	})
	.transform((v) =>
		// parents are adults and don't need a parent contact
		v.accountType === 'parent'
			? {
					...v,
					isUnder18: false,
					parentName: undefined,
					parentPhone: undefined,
					parentEmail: undefined
				}
			: { ...v, childName: undefined }
	);

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
	email: emailField,
	password: z.string().min(1, 'err_required').max(128, 'err_too_long')
});

export const forgotSchema = z.object({ email: emailField });

export const resetSchema = z
	.object({ token: z.string().min(1).max(512), password: passwordField, confirm: z.string() })
	.refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'err_password_match' });

export const totpCodeSchema = z.object({
	code: z
		.string()
		.trim()
		.regex(/^\d{6}$/, 'err_code'),
	trustDevice: checkbox
});

export const backupCodeSchema = z.object({
	code: z.string().trim().min(6, 'err_code').max(32, 'err_code')
});

/** Turn Zod issues into { field: messageKey } for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
	const out: Record<string, string> = {};
	for (const issue of error.issues) {
		const key = String(issue.path[0] ?? 'form');
		if (!out[key]) out[key] = issue.message;
	}
	return out;
}

export function formObject(data: FormData): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [k, v] of data) if (typeof v === 'string') out[k] = v;
	return out;
}
