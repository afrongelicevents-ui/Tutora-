import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, wantedKeys } from '../../scripts/gen-t-keys.mjs';

describe('t() message list', () => {
	it('is up to date (run pnpm i18n:t)', () => {
		const current = readFileSync(new URL('./t-keys.gen.ts', import.meta.url), 'utf8');
		expect(current).toBe(render(wantedKeys(new URL('../..', import.meta.url).pathname)));
	});
});
