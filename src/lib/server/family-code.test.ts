import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/env', () => ({ dev: true }));
vi.mock('$app/env/private', () => ({
	BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-1'
}));

describe('family code cookie', () => {
	it('only opens codes the server sealed, before they expire', async () => {
		const { sealCode, openCode } = await import('./family-code.ts');
		const now = Date.now();
		const v = await sealCode('ami-7kq49p', now);
		expect(await openCode(v, now)).toBe('AMI7KQ49P');
		// a hand-made cookie with another code is refused
		expect(await openCode(v.replace('AMI7KQ49P', 'AMI7KQ49Q'), now)).toBeNull();
		expect(await openCode('AMI7KQ49P', now)).toBeNull();
		expect(await openCode(v, now + 7 * 3_600_000)).toBeNull();
		expect(await openCode(v, now, 'another-secret-another-secret-12')).toBeNull();
	});
});
