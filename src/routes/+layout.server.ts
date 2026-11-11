import type { LayoutServerLoad } from './$types';
import { getSettings } from '#lib/server/settings.ts';

export const load: LayoutServerLoad = async ({ locals }) => {
	let whatsapp: string | null = null;
	let tutorName: string | null = null;
	try {
		const s = await getSettings(locals.db);
		whatsapp = s.whatsappNumber;
		tutorName = s.tutorName;
	} catch (e) {
		// public pages still load if the database is briefly unreachable
		console.error('layout settings unavailable', e);
	}
	return {
		user: locals.user ? { name: locals.user.name, role: locals.user.role } : null,
		whatsapp,
		tutorName
	};
};
