import { describe, expect, it } from 'vitest';
import { fieldErrors, signupSchema } from './auth.ts';

const ok = {
	name: 'Tendai Moyo',
	email: ' Tendai@Example.com ',
	password: 'longenough1',
	accountType: 'student',
	consent: 'on'
};

describe('signup validation', () => {
	it('accepts an adult student and normalises email', () => {
		const r = signupSchema.parse(ok);
		expect(r.email).toBe('tendai@example.com');
		expect(r.isUnder18).toBe(false);
	});

	it('requires parent name and phone for under-18 students', () => {
		const r = signupSchema.safeParse({ ...ok, isUnder18: 'on' });
		expect(r.success).toBe(false);
		if (!r.success) {
			expect(fieldErrors(r.error)).toMatchObject({
				parentName: 'err_parent_required',
				parentPhone: 'err_parent_required'
			});
		}
		const good = signupSchema.parse({
			...ok,
			isUnder18: 'on',
			parentName: 'Mai Moyo',
			parentPhone: '+263 77 123 4567'
		});
		expect(good.parentName).toBe('Mai Moyo');
	});

	it('does not allow signing up as tutor', () => {
		const r = signupSchema.safeParse({ ...ok, accountType: 'tutor' });
		expect(r.success).toBe(false);
	});

	it('requires consent, a valid email and a 10+ character password', () => {
		const r = signupSchema.safeParse({ ...ok, consent: '', email: 'nope', password: 'short' });
		expect(r.success).toBe(false);
		if (!r.success) {
			expect(fieldErrors(r.error)).toMatchObject({
				consent: 'err_consent',
				email: 'err_email',
				password: 'err_password_short'
			});
		}
	});

	it('drops parent fields for parent accounts', () => {
		const r = signupSchema.parse({
			...ok,
			accountType: 'parent',
			isUnder18: 'on',
			parentName: 'x'
		});
		expect(r.isUnder18).toBe(false);
		expect(r.parentName).toBeUndefined();
	});
});
