import type { PageServerLoad } from './$types';
import { listTutors, subjectOptions } from '#lib/server/settings.ts';
import { requireRole } from '#lib/server/guards.ts';
import { isService } from '#lib/services.ts';

const PAGE = 10;

/** Find a tutor: real, approved tutors only; search, subject chips and filters. */
export const load: PageServerLoad = async ({ locals, url }) => {
	requireRole(locals.user, url, ['student']);
	const p = (k: string) => (url.searchParams.get(k) ?? '').trim().slice(0, 60);
	const mode = p('mode');
	const max = Number(p('max'));
	const f = {
		q: p('q'),
		subject: p('subject'),
		level: p('level'),
		mode: (mode === 'online' || mode === 'in_person' ? mode : '') as '' | 'online' | 'in_person',
		location: p('location'),
		maxPriceCents: Number.isFinite(max) && max > 0 ? Math.round(max * 100) : null,
		service: isService(p('service')) ? p('service') : ''
	};
	const shown = Math.min(Math.max(Number(url.searchParams.get('n')) || PAGE, PAGE), 200);
	const [found, subjects] = await Promise.all([
		listTutors(locals.db, f),
		subjectOptions(locals.db)
	]);
	// no tutor lists that kind of help yet: say so and show the other matches instead
	const serviceFallback = !!f.service && !found.length;
	const all = serviceFallback ? await listTutors(locals.db, { ...f, service: '' }) : found;
	return {
		f: { ...f, max: f.maxPriceCents ? f.maxPriceCents / 100 : '' },
		serviceFallback,
		subjects: subjects.slice(0, 8),
		total: all.length,
		shown,
		tutors: all.slice(0, shown).map((t) => ({
			slug: t.slug,
			name: t.name,
			hasPhoto: t.hasPhoto,
			photoVersion: t.photoVersion,
			subjects: t.subjects,
			levels: t.levels,
			lessonModes: t.lessonModes,
			town: t.town,
			fromPriceCents: t.fromPriceCents,
			currency: t.currency
		}))
	};
};
