import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { parentAccess, previewInvite } from '#lib/server/family.ts';
import { rememberedCode } from '#lib/server/family-code.ts';
import { requireRole } from '#lib/server/guards.ts';
import { childOverview } from '#lib/server/parent.ts';
import { pickChild } from '#lib/server/parent-child.ts';
import { shortName } from '#lib/names.ts';
import { readingParents } from '#lib/server/messages.ts';
import {
	BookingFail,
	bookingTutorId,
	requestsForUser,
	respondToProposal
} from '#lib/server/bookings.ts';
import { afterAccept } from '#lib/server/after-accept.ts';
import { toolsEnv } from '#lib/server/tools/env.ts';
import { notifyTutor } from '#lib/server/notify.ts';
import { formObject } from '#lib/validation/auth.ts';
import { m } from '#lib/paraglide/messages.js';

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	const u = requireRole(locals.user, url, ['parent']);
	const { kids, current } = await pickChild(locals.db, u.id, url, cookies);
	const code = await rememberedCode(cookies);
	const waiting = code ? await previewInvite(locals.db, code) : null;
	// a guardian sees the child's lesson requests and answers a tutor's suggested time
	const access = current ? await parentAccess(locals.db, u.id, current) : null;
	const requests =
		current && access?.ok && access.guardian ? await requestsForUser(locals.db, current) : [];
	return {
		name: shortName(u.name),
		kids,
		current,
		child: current ? await childOverview(locals.db, u.id, current) : null,
		// the messages link only for a parent who may read them (under 18, guardian first)
		readsMessages: current ? (await readingParents(locals.db, current)).includes(u.id) : false,
		waitingCode: waiting ? { firstName: waiting.firstName } : null,
		requests: requests.map((r) => ({
			id: r.id,
			status: r.status,
			startsAt: r.startsAt,
			proposedStartsAt: r.proposedStartsAt,
			tutorMessage: r.tutorMessage,
			subjectName: r.subjectName,
			tutorName: r.tutorName,
			tutorSlug: r.tutorSlug
		}))
	};
};

export const actions: Actions = {
	/** A guardian accepts or declines the tutor's suggested time for their child. */
	respond: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['parent']);
		const f = formObject(await request.formData());
		const child = f.child ?? '';
		const access = await parentAccess(locals.db, u.id, child);
		if (!access.ok || !access.guardian) return fail(404, { error: 'err_not_found' });
		const id = Number(f.id) || 0;
		const yes = f.answer === 'yes';
		const tutorId = await bookingTutorId(locals.db, child, id);
		let accepted: Awaited<ReturnType<typeof respondToProposal>>;
		try {
			accepted = await respondToProposal(locals.db, child, id, yes);
		} catch (e) {
			if (e instanceof BookingFail) return fail(400, { error: e.code });
			throw e;
		}
		if (accepted) await afterAccept(locals.db, toolsEnv(url), accepted);
		if (tutorId)
			await notifyTutor(
				locals.db,
				tutorId,
				yes ? m.email_time_accepted_s() : m.email_time_declined_s(),
				yes ? m.email_time_accepted_b({ name: u.name }) : m.email_time_declined_b({ name: u.name }),
				{ kind: 'booking', link: '/tutor#requests' }
			);
		return { responded: yes ? 'yes' : 'no' };
	}
};
