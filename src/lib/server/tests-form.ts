/** Reading the question bank, test builder and AI forms (pages only; checks are in tests.ts). */
import type { QuestionTemplate } from '../math-template.ts';
import type { BankInput, BuildInput } from './tests.ts';
import type { AiInput } from './ai-tests.ts';

const text = (f: FormData, k: string) => {
	const v = f.get(k);
	return typeof v === 'string' ? v : '';
};

export const VAR_ROWS = 4;

export function bankFromForm(f: FormData): BankInput {
	const type = text(f, 'type');
	const answer = text(f, 'answer');
	let template: QuestionTemplate | null = null;
	if (type === 'maths') {
		const vars: QuestionTemplate['vars'] = {};
		for (let i = 0; i < VAR_ROWS; i++) {
			const name = text(f, `v${i}name`).trim().toLowerCase();
			if (!name) continue;
			vars[name] = {
				min: Number(text(f, `v${i}min`)),
				max: Number(text(f, `v${i}max`)),
				...(text(f, `v${i}step`) ? { step: Number(text(f, `v${i}step`)) } : {})
			};
		}
		const lets: Record<string, string> = {};
		for (const line of text(f, 'lets').split('\n')) {
			const x = /^\s*([a-z][a-z0-9]{0,7})\s*=\s*(.+?)\s*$/i.exec(line);
			if (x) lets[x[1].toLowerCase()] = x[2];
		}
		template = {
			vars,
			...(Object.keys(lets).length ? { lets } : {}),
			answer: text(f, 'formula'),
			decimals: Number(text(f, 'decimals')) || 0
		};
	}
	return {
		type: (['mcq', 'short', 'written', 'maths'] as const).find((t) => t === type) ?? 'mcq',
		prompt: text(f, 'prompt'),
		choices: Array.from({ length: 5 }, (_, i) => text(f, `choice${i}`)),
		answer: answer !== '' && /^\d$/.test(answer) ? Number(answer) : -1,
		accepted: text(f, 'accepted').split('\n'),
		template,
		marks: Number(text(f, 'marks')) || 1,
		explanation: text(f, 'explanation') || null,
		subject: text(f, 'subject'),
		form: text(f, 'form') || null,
		chapter: text(f, 'chapter'),
		term: text(f, 'term') || null,
		difficulty: text(f, 'difficulty') || null,
		shared: f.get('shared') === 'on'
	};
}

export function buildFromForm(f: FormData): BuildInput & { studentIds: string[]; dueOn: string } {
	const n = (k: string) => Math.max(0, Math.round(Number(text(f, k)) || 0));
	return {
		title: text(f, 'title'),
		subject: text(f, 'subject'),
		form: text(f, 'form') || null,
		chapters: f.getAll('chapters').filter((c): c is string => typeof c === 'string'),
		term: text(f, 'term') || null,
		count: n('count'),
		mix: { easy: n('easy'), medium: n('medium'), hard: n('hard') },
		timerMinutes: text(f, 'timer') ? Number(text(f, 'timer')) : null,
		studentIds: f.getAll('students').filter((c): c is string => typeof c === 'string'),
		dueOn: text(f, 'dueOn')
	};
}

export function aiFromForm(f: FormData): AiInput {
	const type = text(f, 'type');
	return {
		notes: text(f, 'notes'),
		subject: text(f, 'subject'),
		form: text(f, 'form') || null,
		chapter: text(f, 'chapter'),
		term: text(f, 'term') || null,
		count: Number(text(f, 'count')) || 5,
		type: (['mcq', 'short', 'written', 'mixed'] as const).find((t) => t === type) ?? 'mixed',
		difficulty: text(f, 'difficulty') || null
	};
}

/** For filling the bank form back in from a saved question. */
export function bankToForm(q: {
	type: string;
	template: QuestionTemplate | null;
	choices: string[];
	answer: number;
	accepted: string[];
}) {
	const t = q.template;
	return {
		type: t ? 'maths' : q.type,
		vars: t
			? Object.entries(t.vars).map(([name, r]) => ({ name, min: r.min, max: r.max, step: r.step }))
			: [],
		lets: t?.lets
			? Object.entries(t.lets)
					.map(([k, v]) => `${k} = ${v}`)
					.join('\n')
			: '',
		formula: t?.answer ?? '',
		decimals: t?.decimals ?? 0,
		accepted: q.accepted.join('\n')
	};
}
