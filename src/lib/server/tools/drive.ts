/**
 * Google Drive with the `drive.file` scope: Tutora can only see files the person picked
 * with the Google Picker. The browser gets its OWN short-lived token from Google Identity
 * Services to show the Picker; the server's stored token is never sent to the browser.
 * After a pick, the server checks the file with its own token (files.get works because
 * drive.file covers files picked in this app) and, for a tutor's file, gives the student
 * read access.
 */
import type { DB } from '../db/types.ts';
import type { ToolsEnv } from './meetings.ts';
import { accessToken, G_DRIVE_FILE, providerConfigured } from './oauth.ts';

export const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';

/** Public-by-design settings the Picker needs in the browser (no secrets). */
export interface PickerConfig {
	clientId: string;
	apiKey: string;
	appId: string;
}

/** Picker settings, or null when Drive is not set up on this site or not connected. */
export function pickerConfig(env: ToolsEnv, driveConnected: boolean): PickerConfig | null {
	if (!driveConnected || !providerConfigured(env, 'google')) return null;
	if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_API_KEY || !env.GOOGLE_APP_ID) return null;
	return { clientId: env.GOOGLE_CLIENT_ID, apiKey: env.GOOGLE_API_KEY, appId: env.GOOGLE_APP_ID };
}

export const isDriveFileId = (id: unknown): id is string =>
	typeof id === 'string' && /^[\w-]{10,200}$/.test(id);

export interface DriveFile {
	id: string;
	name: string;
	url: string;
	mimeType: string;
}

/**
 * Check a picked file with the server's token for this person. Null when Drive is not
 * connected or the file is not one they picked in Tutora (or does not exist).
 */
export async function verifyPickedFile(
	db: DB,
	env: ToolsEnv,
	userId: string,
	fileId: string
): Promise<DriveFile | null> {
	if (!isDriveFileId(fileId)) return null;
	const tok = await accessToken(db, env, userId, 'google', G_DRIVE_FILE);
	if (!tok) return null;
	try {
		const res = await (env.fetch ?? fetch)(
			`${DRIVE_FILES}/${encodeURIComponent(fileId)}?fields=id,name,mimeType,webViewLink,trashed&supportsAllDrives=true`,
			{ headers: { authorization: `Bearer ${tok}` } }
		);
		if (!res.ok) return null;
		const f = (await res.json()) as {
			id?: string;
			name?: string;
			mimeType?: string;
			webViewLink?: string;
			trashed?: boolean;
		};
		if (!f.id || f.trashed) return null;
		const url =
			f.webViewLink && f.webViewLink.startsWith('https://')
				? f.webViewLink
				: `https://drive.google.com/file/d/${encodeURIComponent(f.id)}/view`;
		return {
			id: f.id,
			name: (f.name ?? 'Drive file').slice(0, 200),
			url,
			mimeType: f.mimeType ?? ''
		};
	} catch {
		return null;
	}
}

/** Placeholder logins (younger children, test accounts) cannot receive Drive sharing. */
export const canShareTo = (email: string | null | undefined) =>
	!!email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && !/\.invalid$/i.test(email);

export type ShareResult = 'shared' | 'skipped' | 'failed';

/**
 * Give one person read access to a file the owner picked. Google emails them the usual
 * "shared with you" note (Drive requires it for addresses without a Google account).
 * `skipped` for placeholder emails: the owner shares it themselves.
 */
export async function shareFile(
	db: DB,
	env: ToolsEnv,
	ownerId: string,
	fileId: string,
	email: string | null | undefined
): Promise<ShareResult> {
	if (!canShareTo(email)) return 'skipped';
	if (!isDriveFileId(fileId)) return 'failed';
	const tok = await accessToken(db, env, ownerId, 'google', G_DRIVE_FILE);
	if (!tok) return 'failed';
	try {
		const res = await (env.fetch ?? fetch)(
			`${DRIVE_FILES}/${encodeURIComponent(fileId)}/permissions?supportsAllDrives=true`,
			{
				method: 'POST',
				headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
				body: JSON.stringify({ type: 'user', role: 'reader', emailAddress: email })
			}
		);
		return res.ok ? 'shared' : 'failed';
	} catch {
		return 'failed';
	}
}

/** Share with several people; the worst result wins ("skipped" means: share it yourself). */
export async function shareWithAll(
	db: DB,
	env: ToolsEnv,
	ownerId: string,
	fileId: string,
	emails: (string | null | undefined)[]
): Promise<ShareResult> {
	let out: ShareResult = 'shared';
	for (const e of emails) {
		const r = await shareFile(db, env, ownerId, fileId, e);
		if (r === 'failed') out = 'failed';
		else if (r === 'skipped' && out === 'shared') out = 'skipped';
	}
	return out;
}
