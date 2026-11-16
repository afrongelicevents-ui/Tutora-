import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { dev } from '$app/env';
import { TEST_SITE } from '$app/env/private';
import { requireTutor } from '#lib/server/guards.ts';
import { proAccess } from '#lib/server/pro.ts';
import { bankTags, countBank, TestFail } from '#lib/server/tests.ts';
import {
	AI_FREE_PER_DAY,
	AI_TUTOR_CAP,
	aiStopLine,
	aiToday,
	makeDrafts,
	MAX_DRAFTS,
	MAX_NOTES,
	MAX_OUT_TOKENS,
	neuronsFor,
	type AiBinding
} from '#lib/server/ai-tests.ts';
import { aiFromForm } from '#lib/server/tests-form.ts';
import { and, asc, eq } from 'drizzle-orm';
import { subject } from '#lib/server/db/app.schema.ts';
import { cfBinding } from '#lib/server/cf-env.ts';

const testSite = TEST_SITE === '1';
/** Workers AI only on the real sites (local dev has no free binding) */
const binding = () => (dev ? null : cfBinding<AiBinding>('AI'));

/** The AI test maker (Tutora Pro): free Workers AI only, with our own daily counter. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	const [pro, today, tags, drafts, mine] = await Promise.all([
		proAccess(locals.db, t),
		aiToday(locals.db, t),
		bankTags(locals.db, t),
		countBank(locals.db, t, { status: 'draft' }),
		// the subjects the tutor teaches, so drafts land under the right subject
		locals.db
			.select({ name: subject.name })
			.from(subject)
			.where(and(eq(subject.tutorId, t), eq(subject.active, true)))
			.orderBy(asc(subject.sortOrder), asc(subject.id))
	]);
	const stop = aiStopLine(testSite);
	// about how many more times today this tutor can ask (a careful guess per request)
	const perCall = neuronsFor(600, MAX_OUT_TOKENS);
	const left = Math.max(
		0,
		Math.floor(Math.min(AI_TUTOR_CAP - today.mine, stop - today.neurons) / perCall)
	);
	return {
		pro: pro.active,
		available: !!binding(),
		resting: today.neurons >= stop - 60,
		tutorFull: today.mine >= AI_TUTOR_CAP - 60,
		usedPct: Math.min(100, Math.round((100 * today.neurons) / AI_FREE_PER_DAY)),
		stopPct: Math.round((100 * stop) / AI_FREE_PER_DAY),
		tags,
		subjects: [...new Set([...mine.map((x: { name: string }) => x.name), ...tags.subjects])],
		left,
		drafts,
		maxDrafts: MAX_DRAFTS,
		maxNotes: MAX_NOTES
	};
};

export const actions: Actions = {
	default: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		if (!(await proAccess(locals.db, t)).active)
			return fail(403, { error: 'ai_err_pro', input: null });
		const input = aiFromForm(await request.formData());
		let r: Awaited<ReturnType<typeof makeDrafts>>;
		try {
			r = await makeDrafts(locals.db, binding(), t, input, { testSite });
		} catch (e) {
			if (e instanceof TestFail) return fail(400, { error: e.code, input });
			throw e;
		}
		if (r.ok) redirect(303, `/tutor/bank?status=draft&made=${r.drafts}`);
		return fail(r.reason === 'resting' || r.reason === 'tutor_cap' ? 429 : 400, {
			error: `ai_err_${r.reason}`,
			input,
			// test site only: what the model wrote, to see why nothing could be used
			raw: testSite ? (r.raw ?? null) : null
		});
	}
};
