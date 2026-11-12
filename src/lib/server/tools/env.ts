import {
	BETTER_AUTH_SECRET,
	GOOGLE_API_KEY,
	GOOGLE_APP_ID,
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET,
	MS_CLIENT_ID,
	MS_CLIENT_SECRET,
	ORIGIN,
	TOOLS_KEY
} from '$app/env/private';
import type { ToolsEnv } from './meetings.ts';

/** The Connected Tools settings for this request (OAuth apps are optional). */
export function toolsEnv(url: URL): ToolsEnv {
	return {
		origin: (ORIGIN || url.origin).replace(/\/$/, ''),
		secret: BETTER_AUTH_SECRET,
		GOOGLE_CLIENT_ID,
		GOOGLE_CLIENT_SECRET,
		GOOGLE_API_KEY,
		GOOGLE_APP_ID,
		MS_CLIENT_ID,
		MS_CLIENT_SECRET,
		TOOLS_KEY
	};
}
