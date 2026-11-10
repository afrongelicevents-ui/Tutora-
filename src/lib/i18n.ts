import { m } from '#lib/paraglide/messages.js';

type MessageFn = (params?: Record<string, unknown>) => string;

/** Look up a message by key (used for validation error keys returned by the server). */
export function t(key: string | undefined | null, params?: Record<string, unknown>): string {
	if (!key) return '';
	const fn = (m as unknown as Record<string, MessageFn | undefined>)[key];
	return fn ? fn(params ?? {}) : m.err_generic();
}

export { m };
