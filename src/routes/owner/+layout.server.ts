import type { LayoutServerLoad } from './$types';
import { requireOwner } from '#lib/server/guards.ts';

// Every page under /owner: the platform owner with two-step verification, checked on the server.
export const load: LayoutServerLoad = ({ locals, url }) => {
	requireOwner(locals.user, url);
	return {};
};
