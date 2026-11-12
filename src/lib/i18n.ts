import { m } from '#lib/paraglide/messages.js';
import { err_generic } from '#lib/paraglide/messages.js';
import { T_MESSAGES } from './t-keys.gen.ts';

type MessageFn = (params?: Record<string, unknown>) => string;
const LOOKUP = T_MESSAGES as unknown as Record<string, MessageFn | undefined>;

/**
 * Look up a message by key (error codes from the server, moods, statuses).
 * Only the messages listed in t-keys.gen.ts are sent to the browser for this (low data);
 * `pnpm i18n:t` refreshes the list and a test checks it is up to date.
 */
export function t(key: string | undefined | null, params?: Record<string, unknown>): string {
	if (!key) return '';
	const fn = LOOKUP[key];
	return fn ? fn(params ?? {}) : err_generic();
}

export { m };
