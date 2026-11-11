import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { supportRequest } from '#lib/server/db/app.schema.ts';
import { hitLimit, clientIp } from '#lib/server/rate-limit.ts';
import { looksLikeBot } from '#lib/server/bot.ts';
import { notifyOwners } from '#lib/server/notify.ts';
import { emailField, fieldErrors, formObject } from '#lib/validation/auth.ts';
import { m } from '#lib/paraglide/messages.js';

export const load: PageServerLoad = ({ locals }) => ({
	name: locals.user?.name ?? '',
	email: locals.user?.email ?? ''
});

const schema = z.object({
	name: z.string().trim().min(2, 'err_name').max(80, 'err_too_long'),
	email: emailField,
	topic: z.enum(['help', 'report', 'tutor', 'other']).default('help'),
	message: z.string().trim().min(10, 'err_message_short').max(2000, 'err_too_long')
});

/** Help requests and reports to the Tutora team. */
export const actions: Actions = {
	default: async ({ locals, request }) => {
		const f = formObject(await request.formData());
		const values = {
			name: f.name ?? '',
			email: f.email ?? '',
			message: f.message ?? '',
			topic: f.topic ?? 'help'
		};
		// bots get the same "thank you" and nothing is stored
		if (looksLikeBot(f)) return { sent: true };
		const limit = await hitLimit(locals.db, 'signup', `contact:${clientIp(request)}`);
		if (!limit.ok)
			return fail(429, { values, errors: { form: 'err_rate_limited' } as Record<string, string> });
		const p = schema.safeParse(f);
		if (!p.success) return fail(400, { values, errors: fieldErrors(p.error) });
		await locals.db.insert(supportRequest).values({ ...p.data, userId: locals.user?.id ?? null });
		await notifyOwners(
			locals.db,
			m.owner_support_s(),
			m.owner_support_b({ name: p.data.name }),
			'/owner/reports'
		);
		return { sent: true };
	}
};
