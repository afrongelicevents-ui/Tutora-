import type { LayoutServerLoad } from './$types';
import { siteSettings } from '#lib/server/site.ts';

export const load: LayoutServerLoad = async ({ locals }) => {
	const settings = await siteSettings();
	return {
		user: locals.user ? { name: locals.user.name, role: locals.user.role } : null,
		whatsapp: settings.whatsappNumber
	};
};
