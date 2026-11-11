import type { PageServerLoad } from './$types';
import { listTutors, subjectOptions } from '#lib/server/settings.ts';

const PAGE = 10;

/** "Find a tutor": approved tutors only, filters and sorting, shown 10 at a time (low data). */
export const load: PageServerLoad = async ({ locals, url }) => {
	const p = (k: string) => (url.searchParams.get(k) ?? '').trim().slice(0, 60);
	const mode = p('mode');
	const sort = p('sort');
	const f = {
		subject: p('subject'),
		level: p('level'),
		mode: (mode === 'online' || mode === 'in_person' ? mode : '') as '' | 'online' | 'in_person',
		location: p('location'),
		sort: (['rating', 'price', 'newest'].includes(sort) ? sort : '') as
			'' | 'rating' | 'price' | 'newest'
	};
	const shown = Math.min(Math.max(Number(url.searchParams.get('n')) || PAGE, PAGE), 200);
	const [all, subjects] = await Promise.all([listTutors(locals.db, f), subjectOptions(locals.db)]);
	return {
		f,
		subjects,
		total: all.length,
		shown,
		tutors: all.slice(0, shown).map(({ tutorId: _id, createdAt: _c, ...t }) => ({
			...t,
			intro: (t.headline || t.bio || '').slice(0, 140)
		}))
	};
};
