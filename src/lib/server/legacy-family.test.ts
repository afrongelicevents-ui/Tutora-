import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LEGACY_FAMILY_SQL, MANAGED_MINORS_SQL } from './legacy-family.ts';

describe('legacy parent conversion', () => {
	it('is the same as the 0011 migration', () => {
		const file = readFileSync(
			new URL('../../../drizzle/0011_v3_family_data.sql', import.meta.url),
			'utf8'
		);
		const stmts = file
			.split('--> statement-breakpoint')
			.map((p) =>
				p
					.split('\n')
					.filter((l) => !l.trim().startsWith('--'))
					.join('\n')
					.trim()
					.replace(/;$/, '')
			)
			.filter(Boolean);
		expect(LEGACY_FAMILY_SQL).toEqual(stmts);
	});
	it('makes younger children under 18, as migration 0012 does', () => {
		const file = readFileSync(
			new URL('../../../drizzle/0012_managed_minors.sql', import.meta.url),
			'utf8'
		);
		expect(file).toContain(`${MANAGED_MINORS_SQL};`);
	});
});
