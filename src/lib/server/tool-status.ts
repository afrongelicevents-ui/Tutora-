/** The real status of a student's connected tools (for the tool tiles). */
import type { DB } from './db/types.ts';
import { connections, providerConfigured } from './tools/oauth.ts';
import { getToolPref } from './tools/meetings.ts';
import { toolsEnv } from './tools/env.ts';
import { toolsAllowedFor } from './family.ts';

export async function studentToolStatus(db: DB, studentId: string, url: URL) {
	const [c, pref, allowed] = await Promise.all([
		connections(db, studentId),
		getToolPref(db, studentId),
		toolsAllowedFor(db, studentId)
	]);
	const canConnectDrive = providerConfigured(toolsEnv(url), 'google') && allowed;
	return {
		drive: c.drive,
		kahoot: pref.kahootOn,
		driveConnectHref: canConnectDrive ? '/tools/connect/google' : '/student/tools'
	};
}
