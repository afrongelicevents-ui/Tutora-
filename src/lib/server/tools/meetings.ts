import type { DB } from '../db/types.ts';

/** Server settings the Connected Tools need (OAuth app ids and the token-encryption key). */
export interface ToolsEnv {
	origin: string;
	secret: string;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
	GOOGLE_API_KEY?: string;
	GOOGLE_APP_ID?: string;
	MS_CLIENT_ID?: string;
	MS_CLIENT_SECRET?: string;
	TOOLS_KEY?: string;
}

/**
 * After a lesson is confirmed: if the tutor runs online lessons on Google Meet or Microsoft
 * Teams and has connected that account, create the meeting and store its join link.
 * Returns null when no tool is used (the low-data room is used instead) or creation fails;
 * a failure never blocks the booking.
 * (Filled in by the Connected Tools work.)
 */
export async function createMeetingForLesson(
	_db: DB,
	_env: ToolsEnv,
	_lessonId: number
): Promise<{ provider: 'meet' | 'teams'; joinUrl: string } | null> {
	return null;
}
