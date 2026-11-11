/**
 * Light bot protection for public forms (no outside service): a hidden field that people never
 * fill, and a minimum time between showing the form and sending it.
 */
export function looksLikeBot(f: Record<string, string>, now = Date.now()): boolean {
	if ((f.website ?? '').trim() !== '') return true;
	const started = Number(f.started);
	if (!Number.isFinite(started)) return false; // older pages without the field
	return now - started < 2_000;
}
