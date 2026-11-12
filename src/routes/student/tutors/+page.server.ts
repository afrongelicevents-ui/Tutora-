import type { PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { myTutors, todoFromTutors } from '#lib/server/student-tutors.ts';
import { conversations } from '#lib/server/messages.ts';
import { connections, providerConfigured } from '#lib/server/tools/oauth.ts';
import { getToolPref } from '#lib/server/tools/meetings.ts';
import { toolsEnv } from '#lib/server/tools/env.ts';
import { toolsAllowedFor } from '#lib/server/family.ts';

/** The Tutors tab: my tutors, work to do from them, messages and connected tools. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const s = requireRole(locals.user, url, ['student']).id;
	const [tutors, todo, convs, c, pref, allowed] = await Promise.all([
		myTutors(locals.db, s),
		todoFromTutors(locals.db, s),
		conversations(locals.db, s, 'student'),
		connections(locals.db, s),
		getToolPref(locals.db, s),
		toolsAllowedFor(locals.db, s)
	]);
	const canConnectDrive = providerConfigured(toolsEnv(url), 'google') && allowed;
	return {
		tutors,
		todo: todo.slice(0, 3),
		todoTotal: todo.length,
		today: new Date().toISOString(),
		messages: convs.slice(0, 3),
		tools: {
			drive: c.drive,
			kahoot: pref.kahootOn,
			driveConnectHref: canConnectDrive ? '/tools/connect/google' : '/student/tools'
		}
	};
};
