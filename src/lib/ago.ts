import { m } from '#lib/i18n.ts';
import { fmtDay } from '#lib/tz.ts';

/** "2m ago", "1h ago", "3d ago", then the date. */
export function ago(d: Date | string, now = new Date()) {
	const t = typeof d === 'string' ? new Date(d) : d;
	const min = Math.floor((now.getTime() - t.getTime()) / 60_000);
	if (min < 1) return m.ago_now();
	if (min < 60) return m.ago_min({ n: min });
	if (min < 24 * 60) return m.ago_hour({ n: Math.floor(min / 60) });
	if (min < 7 * 24 * 60) return m.ago_day({ n: Math.floor(min / 1440) });
	return fmtDay(t);
}
