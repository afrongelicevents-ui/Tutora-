/**
 * TEST SITE ONLY (called from seedTestData): a small question bank of ORIGINAL questions
 * (written for Tutora, never from exam papers or textbooks), one shared question, and a
 * built test for Nyasha and Tatenda, so the bank, builder, test and marking can be walked.
 */
import { eq } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { user } from './db/auth.schema.ts';
import { addBankQuestion, buildTest, setShared, type BankInput } from './tests.ts';
import { assignSet } from './assessments.ts';
import type { TestLogin } from './seed.ts';

const base = { subject: 'Mathematics', form: 'Form 2', term: 'Term 3' as const };

const QUESTIONS: BankInput[] = [
	{
		...base,
		chapter: 'Fractions',
		difficulty: 'easy',
		type: 'mcq',
		prompt: 'Which fraction is the same as one half?',
		choices: ['2/4', '2/3', '3/5'],
		answer: 0
	},
	{
		...base,
		chapter: 'Fractions',
		difficulty: 'easy',
		type: 'mcq',
		prompt: 'Tendai eats 3 of the 8 slices of bread. What fraction is left?',
		choices: ['5/8', '3/8', '3/5'],
		answer: 0,
		explanation: '8 − 3 = 5 slices are left, out of 8.'
	},
	{
		...base,
		chapter: 'Fractions',
		difficulty: 'medium',
		type: 'mcq',
		prompt: 'What is 1/3 + 1/6?',
		choices: ['1/2', '2/9', '1/9'],
		answer: 0,
		explanation: '1/3 = 2/6, and 2/6 + 1/6 = 3/6 = 1/2.'
	},
	{
		...base,
		chapter: 'Fractions',
		difficulty: 'medium',
		type: 'short',
		prompt: 'Write 0.25 as a fraction in its simplest form.',
		accepted: ['1/4']
	},
	{
		...base,
		chapter: 'Fractions',
		difficulty: 'hard',
		type: 'maths',
		prompt: 'A bag holds {n} oranges. {k} out of every {d} are ripe. How many oranges are ripe?',
		template: {
			vars: { d: { min: 3, max: 6 }, k: { min: 1, max: 2 }, g: { min: 2, max: 9 } },
			lets: { n: 'd * g' },
			answer: 'k * g'
		},
		marks: 2
	},
	{
		...base,
		chapter: 'Equations',
		difficulty: 'easy',
		type: 'maths',
		prompt: 'Solve {a}x + {b} = {c}',
		template: {
			vars: { a: { min: 2, max: 9 }, x: { min: 1, max: 12 }, b: { min: 1, max: 20 } },
			lets: { c: 'a * x + b' },
			answer: 'x'
		}
	},
	{
		...base,
		chapter: 'Equations',
		difficulty: 'medium',
		type: 'maths',
		prompt: 'Solve {a}(x − {b}) = {c}',
		template: {
			vars: { a: { min: 2, max: 6 }, x: { min: 3, max: 15 }, b: { min: 1, max: 3 } },
			lets: { c: 'a * (x - b)' },
			answer: 'x'
		}
	},
	{
		...base,
		chapter: 'Equations',
		difficulty: 'easy',
		type: 'mcq',
		prompt: 'If y − 7 = 5, what is y?',
		choices: ['12', '2', '-2'],
		answer: 0
	},
	{
		...base,
		chapter: 'Equations',
		difficulty: 'medium',
		type: 'written',
		prompt: 'Explain in your own words how you would solve 3x + 4 = 19. Show each step.',
		explanation: 'Take 4 from both sides (3x = 15), then divide both sides by 3 (x = 5).',
		marks: 3
	},
	{
		...base,
		chapter: 'Equations',
		difficulty: 'hard',
		type: 'short',
		prompt: 'A number doubled and then increased by 6 gives 20. What is the number?',
		accepted: ['7']
	}
];

export async function seedQuestionBank(db: DB, _logins: TestLogin[]) {
	const idOf = async (email: string) => {
		const [u] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
		return u?.id ?? null;
	};
	const [chipo, tendai, nyasha, tatenda] = await Promise.all([
		idOf('chipo@example.com'),
		idOf('tendai@example.com'),
		idOf('nyasha@example.com'),
		idOf('tatenda@example.com')
	]);
	if (!chipo) return;
	for (const q of QUESTIONS) await addBankQuestion(db, chipo, q);
	if (tendai) {
		const shared = await addBankQuestion(db, tendai, {
			subject: 'Mathematics',
			form: 'Form 2',
			chapter: 'Fractions',
			difficulty: 'easy',
			type: 'mcq',
			prompt: 'Which is bigger: 3/4 or 2/3?',
			choices: ['3/4', '2/3', 'They are the same'],
			answer: 0,
			explanation: '3/4 = 9/12 and 2/3 = 8/12.'
		});
		await setShared(db, tendai, shared.id, true);
	}
	const test = await buildTest(db, chipo, {
		title: 'Fractions and equations check',
		subject: 'Mathematics',
		form: 'Form 2',
		chapters: ['Fractions', 'Equations'],
		term: 'Term 3',
		count: 8,
		timerMinutes: 20
	});
	for (const s of [nyasha, tatenda])
		if (s) await assignSet(db, chipo, test.id, s, null).catch(() => {});
}
