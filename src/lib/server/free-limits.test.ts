import { describe, expect, it } from 'vitest';
import { meters, needsAlert, type Usage } from './free-limits.ts';

const base: Usage = {
	at: '2026-11-15T12:00:00Z',
	cloudflare: {
		ok: true,
		requestsToday: 1_000,
		errorsToday: 0,
		limitErrorsToday: 0,
		cpuP50Ms: 3,
		cpuP99Ms: 6
	},
	neon: { ok: true, computeHoursMonth: 10, storageMb: 40, egressMbMonth: 100 },
	dbSizeMb: 35,
	slowest: null
};

describe('free limits', () => {
	it('is quiet well inside the limits', () => {
		expect(needsAlert(base)).toEqual([]);
		expect(meters(base).map((m) => m.key)).toEqual([
			'requests',
			'cpu',
			'limitErrors',
			'compute',
			'storage',
			'egress'
		]);
	});

	it('warns at 70% and marks over 100%', () => {
		const u: Usage = {
			...base,
			cloudflare: { ...base.cloudflare, requestsToday: 72_000 } as Usage['cloudflare'],
			neon: { ok: true, computeHoursMonth: 120, storageMb: 40, egressMbMonth: null }
		};
		const a = needsAlert(u);
		expect(a.find((m) => m.key === 'requests')?.level).toBe('warn');
		expect(a.find((m) => m.key === 'compute')?.level).toBe('over');
	});

	it('alerts on any request refused for a limit', () => {
		const u: Usage = {
			...base,
			cloudflare: { ...base.cloudflare, limitErrorsToday: 1 } as Usage['cloudflare']
		};
		expect(needsAlert(u).map((m) => m.key)).toEqual(['limitErrors']);
	});

	it('counts the AI test maker against its stop line, with the 70% alert', () => {
		expect(meters({ ...base, ai: { neuronsToday: 100, stopAt: 6_500 } }).at(-1)).toMatchObject({
			key: 'ai',
			level: 'ok'
		});
		const warn = needsAlert({ ...base, ai: { neuronsToday: 4_600, stopAt: 6_500 } });
		expect(warn.map((m) => [m.key, m.level])).toEqual([['ai', 'warn']]);
		const over = needsAlert({ ...base, ai: { neuronsToday: 6_500, stopAt: 6_500 } });
		expect(over[0].level).toBe('over');
	});

	it('still shows the database size when Neon cannot be read', () => {
		const u: Usage = { ...base, neon: { ok: false, reason: 'no_permission' }, dbSizeMb: 400 };
		const s = meters(u).find((m) => m.key === 'storage')!;
		expect(s.used).toBe(400);
		expect(s.level).toBe('warn');
	});
});
