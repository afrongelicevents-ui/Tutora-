import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireTutor } from '#lib/server/guards.ts';
import {
	bankTags,
	getBankQuestion,
	removeBankQuestion,
	TestFail,
	updateBankQuestion
} from '#lib/server/tests.ts';
import { bankFromForm, bankToForm } from '#lib/server/tests-form.ts';
import { instantiate } from '#lib/math-template.ts';

const idOf = (v: string) => (/^\d{1,9}$/.test(v) ? Number(v) : 0);

/** One of the tutor's own bank questions: check (a draft), change, remove. */
export const load: PageServerLoad = async ({ locals, url, params }) => {
	const t = requireTutor(locals.user, url).id;
	const [q, tags] = await Promise.all([
		getBankQuestion(locals.db, t, idOf(params.id)),
		bankTags(locals.db, t)
	]);
	if (!q) error(404, 'Not found');
	// a maths question: show two example versions, as two students would see them
	let examples: { prompt: string; answer: number }[] = [];
	if (q.template)
		try {
			examples = [11, 22].map((s) => {
				const v = instantiate(q.template!, q.prompt, s);
				return { prompt: v.prompt, answer: v.answer };
			});
		} catch {
			examples = [];
		}
	return { q, maths: bankToForm(q), tags, examples };
};

export const actions: Actions = {
	save: async ({ locals, url, params, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = await request.formData();
		const approve = f.get('approve') === '1';
		try {
			await updateBankQuestion(locals.db, t, idOf(params.id), bankFromForm(f), approve);
		} catch (e) {
			if (e instanceof TestFail) return fail(400, { error: e.code });
			throw e;
		}
		if (approve) redirect(303, '/tutor/bank?status=draft');
		return { done: 'saved' };
	},
	remove: async ({ locals, url, params, request }) => {
		const t = requireTutor(locals.user, url).id;
		if ((await request.formData()).get('sure') !== 'on') return fail(400, { error: 'qb_err_sure' });
		await removeBankQuestion(locals.db, t, idOf(params.id));
		redirect(303, '/tutor/bank');
	}
};
