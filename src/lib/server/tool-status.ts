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
	const env = toolsEnv(url);
	const google = providerConfigured(env, 'google');
	const canConnectDrive = google && allowed;
	return {
		// Meet / Teams links exist only when Tutora has the keys to make them (same as tutor tools)
		meet: google,
		teams: providerConfigured(env, 'microsoft'),
		driveAvailable: google,
		drive: c.drive,
		kahoot: pref.kahootOn,
		driveConnectHref: canConnectDrive ? '/tools/connect/google' : '/student/tools'
	};
}
