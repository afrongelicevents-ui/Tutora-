import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireTutor } from '#lib/server/guards.ts';
import {
	addBankQuestion,
	bankTags,
	copyShared,
	countBank,
	listBank,
	removeBankQuestion,
	setShared,
	sharedBank,
	TestFail,
	type BankFilter
} from '#lib/server/tests.ts';
import { bankFromForm } from '#lib/server/tests-form.ts';

const idOf = (v: unknown) => (typeof v === 'string' && /^\d{1,9}$/.test(v) ? Number(v) : 0);
const PAGE = 30;

function filterOf(url: URL): BankFilter {
	const g = (k: string) => url.searchParams.get(k)?.slice(0, 80) || undefined;
	const status = g('status');
	return {
		subject: g('subject'),
		form: g('form'),
		chapter: g('chapter'),
		term: g('term'),
		difficulty: g('difficulty'),
		type: g('type'),
		q: g('q'),
		status: status === 'draft' || status === 'ready' ? status : undefined
	};
}

/** The question bank: the tutor's own questions, or (view=shared) the Tutora bank. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	const f = filterOf(url);
	const shared = url.searchParams.get('view') === 'shared';
	const page = Math.max(0, Math.min(200, Number(url.searchParams.get('p')) || 0));
	const [tags, drafts, total, list, others] = await Promise.all([
		bankTags(locals.db, t),
		countBank(locals.db, t, { status: 'draft' }),
		shared ? Promise.resolve(0) : countBank(locals.db, t, f),
		shared ? Promise.resolve([]) : listBank(locals.db, t, f, PAGE, page * PAGE),
		shared ? sharedBank(locals.db, t, f, 40) : Promise.resolve([])
	]);
	return {
		filter: f,
		shared,
		made: Math.max(0, Math.min(10, Number(url.searchParams.get('made')) || 0)),
		page,
		pages: Math.ceil(total / PAGE),
		total,
		tags,
		drafts,
		questions: list.map((q) => ({
			id: q.id,
			type: q.type,
			maths: !!q.template,
			prompt: q.prompt,
			choices: q.choices,
			answer: q.answer,
			accepted: q.accepted,
			marks: q.marks,
			subject: q.subject,
			form: q.form,
			chapter: q.chapter,
			term: q.term,
			difficulty: q.difficulty,
			status: q.status,
			origin: q.origin,
			shared: q.shared,
			hidden: !!q.hiddenAt,
			inQuiz: !!q.setId
		})),
		others: others.map((q) => ({ ...q, maths: !!q.template, template: undefined }))
	};
};

async function run(name: string, fn: () => Promise<unknown>, done: string) {
	try {
		await fn();
		return { done };
	} catch (e) {
		if (e instanceof TestFail) return fail(400, { error: e.code, form: name });
		throw e;
	}
}

export const actions: Actions = {
	add: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = await request.formData();
		return run('add', () => addBankQuestion(locals.db, t, bankFromForm(f)), 'added');
	},
	share: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = await request.formData();
		return run(
			`q${idOf(f.get('id'))}`,
			() => setShared(locals.db, t, idOf(f.get('id')), f.get('shared') === '1'),
			f.get('shared') === '1' ? 'shared' : 'unshared'
		);
	},
	remove: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = await request.formData();
		if (f.get('sure') !== 'on')
			return fail(400, { error: 'qb_err_sure', form: `q${idOf(f.get('id'))}` });
		await removeBankQuestion(locals.db, t, idOf(f.get('id')));
		return { done: 'removed' };
	},
	copy: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = await request.formData();
		return run(
			`s${idOf(f.get('id'))}`,
			() => copyShared(locals.db, t, idOf(f.get('id'))),
			'copied'
		);
	}
};
