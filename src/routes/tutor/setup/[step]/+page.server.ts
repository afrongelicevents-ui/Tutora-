import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { loadSection, sectionActions, WIZARD } from '#lib/server/sections.ts';
import { getSettings, updateSettings } from '#lib/server/settings.ts';
import { requireTutor } from '#lib/server/guards.ts';

/** Step 0 = welcome, 1..7 = sections, 8 = done. */
function stepOf(param: string) {
	const n = Number(param);
	if (!Number.isInteger(n) || n < 0 || n > WIZARD.length + 1) error(404, 'Not found');
	return n;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const step = stepOf(params.step);
	const section = step >= 1 && step <= WIZARD.length ? WIZARD[step - 1] : null;
	const data = section
		? await loadSection(locals.db, section)
		: { settings: await getSettings(locals.db) };
	return { step, total: WIZARD.length, section, ...data, email: locals.user!.email };
};

const next = (ev: { params: { step?: string } }) => `/tutor/setup/${Number(ev.params.step) + 1}`;

export const actions: Actions = {
	...sectionActions((ev) => {
		const step = Number(ev.params.step);
		return Number.isInteger(step) ? next(ev) : null;
	}),
	/** "Finish later": stop showing the wizard; remember where they were. */
	later: async ({ locals, url, params }) => {
		requireTutor(locals.user, url);
		const step = Number(params.step);
		await updateSettings(locals.db, {
			setupDoneAt: new Date(),
			setupStep: Number.isInteger(step) ? step : 0
		});
		redirect(303, '/tutor');
	},
	finish: async ({ locals, url }) => {
		requireTutor(locals.user, url);
		const s = await getSettings(locals.db);
		if (!s) return fail(500);
		await updateSettings(locals.db, { setupDoneAt: new Date(), setupStep: WIZARD.length + 1 });
		redirect(303, '/tutor');
	}
};
