import type { QuestionInput, SetInput } from '#lib/server/assessments.ts';
import { MAX_CHOICES } from '#lib/server/assessments.ts';

const text = (f: FormData, k: string) => {
	const v = f.get(k);
	return typeof v === 'string' ? v : '';
};

export function setFromForm(f: FormData): SetInput {
	return {
		kind: text(f, 'kind') === 'test' ? 'test' : 'quiz',
		title: text(f, 'title'),
		subject: text(f, 'subject'),
		topic: text(f, 'topic'),
		level: text(f, 'level') || null,
		dailyChecks: f.get('dailyChecks') === 'on'
	};
}

export function questionFromForm(f: FormData): QuestionInput {
	const answer = Number(text(f, 'answer'));
	return {
		prompt: text(f, 'prompt'),
		choices: Array.from({ length: MAX_CHOICES }, (_, i) => text(f, `choice${i}`)),
		answer: Number.isInteger(answer) && text(f, 'answer') !== '' ? answer : -1,
		explanation: text(f, 'explanation') || null
	};
}
