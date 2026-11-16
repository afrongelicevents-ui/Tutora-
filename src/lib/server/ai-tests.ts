/**
 * The AI test maker (Tutora Pro): the tutor pastes notes or a topic and a small free model
 * on Cloudflare Workers AI drafts questions. Drafts go into the tutor's question bank as
 * DRAFTS: they can't be used in a test until the tutor has checked (and edited) each one.
 *
 * FREE ONLY. Workers AI on the free plan gives 10,000 "neurons" a day per Cloudflare account
 * (resets 00:00 UTC); over that, calls simply fail on the free plan. We never get there:
 *  - our own counter (ai_usage) adds a careful estimate BEFORE each call (prompt + the most
 *    the answer may be), and the real figure afterwards if it was more;
 *  - the live and test sites share the account, so live stops at 6,500 and test at 1,500
 *    (together 80% of the free allowance);
 *  - one tutor can use at most 1,500 a day.
 * When the line is reached the page says the AI test maker is resting. No paid fallback, ever.
 */
import { and, eq, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { aiUsage } from './db/tests.schema.ts';
import { DIFFICULTIES, type Difficulty } from './db/v3.schema.ts';
import { addBankQuestion, TestFail, TERMS, type BankInput } from './tests.ts';

/** Cloudflare Workers AI free allowance, neurons per day per account */
export const AI_FREE_PER_DAY = 10_000;
/** we stop at 80% of it, split between the two sites */
export const AI_STOP_LIVE = 6_500;
export const AI_STOP_TEST = 1_500;
/** one tutor's most per day */
export const AI_TUTOR_CAP = 1_500;

/** A small model on the free plan. */
export const AI_MODEL = '@cf/meta/llama-3.2-3b-instruct';
/**
 * Neurons per million tokens for that model (Cloudflare's price list: about 4,625 in and
 * 30,475 out), rounded UP so our counter is always a little ahead of Cloudflare's.
 */
export const NEURONS_PER_M_IN = 5_000;
export const NEURONS_PER_M_OUT = 31_000;
export const MAX_OUT_TOKENS = 1_200;
export const MAX_NOTES = 6_000;
export const MAX_DRAFTS = 10;

export const aiStopLine = (testSite: boolean) => (testSite ? AI_STOP_TEST : AI_STOP_LIVE);

/** A rough token count: about 3 characters a token (English; rounds up). */
export const estimateTokens = (text: string) => Math.ceil(text.length / 3) + 8;

export const neuronsFor = (inTokens: number, outTokens: number) =>
	Math.ceil((inTokens * NEURONS_PER_M_IN + outTokens * NEURONS_PER_M_OUT) / 1_000_000);

export const utcDay = (now: Date) => now.toISOString().slice(0, 10);

/** Today's use on this site (all tutors) and for one tutor. */
export async function aiToday(db: DB, tutorId: string | null, now = new Date()) {
	const day = utcDay(now);
	const [all] = await db
		.select({
			n: sql<number>`coalesce(sum(${aiUsage.neurons}), 0)::int`,
			calls: sql<number>`coalesce(sum(${aiUsage.calls}), 0)::int`,
			mine: tutorId
				? sql<number>`coalesce(sum(${aiUsage.neurons}) filter (where ${aiUsage.tutorId} = ${tutorId}), 0)::int`
				: sql<number>`0`
		})
		.from(aiUsage)
		.where(eq(aiUsage.day, day));
	return { neurons: all?.n ?? 0, calls: all?.calls ?? 0, mine: Number(all?.mine ?? 0) };
}

export type AiGate = 'ok' | 'resting' | 'tutor_cap';

/**
 * Adds `neurons` to today's count for the tutor, only if that stays under both lines.
 * One at a time (an advisory lock), so two tutors at once can't both slip past the line.
 */
export async function reserveNeurons(
	db: DB,
	tutorId: string,
	neurons: number,
	stopLine: number,
	now = new Date()
): Promise<AiGate> {
	const day = utcDay(now);
	return db.transaction(async (tx) => {
		const t = tx as unknown as DB;
		await t.execute(sql`select pg_advisory_xact_lock(hashtext('ai-usage'))`);
		const used = await aiToday(t, tutorId, now);
		if (used.neurons + neurons > stopLine) return 'resting';
		if (used.mine + neurons > AI_TUTOR_CAP) return 'tutor_cap';
		await t
			.insert(aiUsage)
			.values({ day, tutorId, neurons, calls: 1, updatedAt: now })
			.onConflictDoUpdate({
				target: [aiUsage.day, aiUsage.tutorId],
				set: {
					neurons: sql`${aiUsage.neurons} + ${neurons}`,
					calls: sql`${aiUsage.calls} + 1`,
					updatedAt: now
				}
			});
		return 'ok';
	});
}

/** After the call: if Cloudflare's real figure was more than we counted, add the difference. */
export async function settleNeurons(
	db: DB,
	tutorId: string,
	reserved: number,
	actual: number | null,
	now = new Date()
) {
	if (actual === null || actual <= reserved) return;
	await db
		.update(aiUsage)
		.set({ neurons: sql`${aiUsage.neurons} + ${actual - reserved}`, updatedAt: now })
		.where(and(eq(aiUsage.day, utcDay(now)), eq(aiUsage.tutorId, tutorId)));
}

/* ------------------------------------------------------------------ asking the model */

export interface AiInput {
	notes: string;
	subject: string;
	form?: string | null;
	chapter: string;
	term?: string | null;
	count: number;
	type: 'mcq' | 'short' | 'written' | 'mixed';
	difficulty?: string | null;
}

/** The binding's shape (only what we use), so tests can pass a fake. */
export interface AiBinding {
	run(
		model: string,
		input: {
			messages: { role: string; content: string }[];
			max_tokens: number;
			temperature: number;
		}
	): Promise<unknown>;
}

export function buildMessages(v: AiInput) {
	const kinds =
		v.type === 'mixed'
			? 'a mix of "mcq" (multiple choice), "short" (short answer) and "written" (explain in a few sentences)'
			: `only "${v.type}"`;
	return [
		{
			role: 'system',
			content:
				'You write original school test questions for a tutor in Zimbabwe. Write NEW questions ' +
				'only: never copy exam papers or textbooks. Simple, clear English. Answer with JSON ' +
				'only, no other text: {"questions":[{"type":"mcq","prompt":"...","choices":["...","...",' +
				'"...","..."],"answer":0,"explanation":"..."},{"type":"short","prompt":"...","answers":' +
				'["..."]},{"type":"written","prompt":"...","explanation":"what a good answer says"}]}. ' +
				'For mcq, "answer" is the index (0-3) of the right choice.'
		},
		{
			role: 'user',
			content:
				`Subject: ${v.subject}. ${v.form ? `Class: ${v.form}. ` : ''}Chapter: ${v.chapter}. ` +
				`${v.difficulty ? `Difficulty: ${v.difficulty}. ` : ''}` +
				`Write ${v.count} questions, ${kinds}, from these notes or topic:\n\n${v.notes}`
		}
	];
}

/** Takes the model's text and returns valid questions only (anything odd is dropped). */
export function parseDrafts(raw: unknown, max = MAX_DRAFTS) {
	const text = typeof raw === 'string' ? raw : '';
	const tryParse = (s: string) => {
		try {
			return JSON.parse(s) as unknown;
		} catch {
			return null;
		}
	};
	let data = tryParse(text.trim());
	if (!data) {
		// the JSON inside other words or a code block
		const a = text.indexOf('{');
		const b = text.lastIndexOf('}');
		if (a >= 0 && b > a) data = tryParse(text.slice(a, b + 1));
		if (!data) {
			const c = text.indexOf('[');
			const d = text.lastIndexOf(']');
			if (c >= 0 && d > c) data = tryParse(text.slice(c, d + 1));
		}
	}
	const list: unknown[] = Array.isArray(data)
		? data
		: data && typeof data === 'object' && Array.isArray((data as { questions?: unknown }).questions)
			? (data as { questions: unknown[] }).questions
			: [];
	const out: {
		type: 'mcq' | 'short' | 'written';
		prompt: string;
		choices: string[];
		answer: number;
		accepted: string[];
		explanation: string | null;
	}[] = [];
	const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
	for (const q of list) {
		if (out.length >= max) break;
		if (!q || typeof q !== 'object') continue;
		const o = q as Record<string, unknown>;
		const prompt = str(o.prompt ?? o.question, 1500);
		if (!prompt) continue;
		const explanation = str(o.explanation, 1000) || null;
		const type = str(o.type, 20).toLowerCase();
		if (type === 'mcq' || (!type && Array.isArray(o.choices))) {
			const choices = (Array.isArray(o.choices) ? o.choices : [])
				.map((c) => str(c, 300))
				.filter(Boolean)
				.slice(0, 5);
			let answer = typeof o.answer === 'number' ? o.answer : Number.NaN;
			if (typeof o.answer === 'string') {
				const letter = /^[A-Ea-e]$/.test(o.answer.trim())
					? o.answer.trim().toUpperCase().charCodeAt(0) - 65
					: -1;
				answer =
					letter >= 0
						? letter
						: /^\d$/.test(o.answer.trim())
							? Number(o.answer)
							: choices.findIndex((c) => c.toLowerCase() === str(o.answer, 300).toLowerCase());
			}
			if (choices.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= choices.length)
				continue;
			out.push({ type: 'mcq', prompt, choices, answer, accepted: [], explanation });
		} else if (type === 'short') {
			const raw = Array.isArray(o.answers) ? o.answers : [o.answer ?? o.answers];
			const accepted = raw
				.map((x) => str(typeof x === 'number' ? String(x) : x, 200))
				.filter(Boolean);
			if (!accepted.length) continue;
			out.push({ type: 'short', prompt, choices: [], answer: 0, accepted, explanation });
		} else if (type === 'written') {
			out.push({ type: 'written', prompt, choices: [], answer: 0, accepted: [], explanation });
		}
	}
	return out;
}

const cut = (v: unknown, n: number) =>
	String(v ?? '')
		.trim()
		.slice(0, n);

export function cleanAiInput(v: AiInput): AiInput {
	const notes = cut(v.notes, MAX_NOTES);
	const subject = cut(v.subject, 60);
	const chapter = cut(v.chapter, 80);
	if (notes.length < 3) throw new TestFail('ai_err_notes');
	if (!subject || !chapter) throw new TestFail('qb_err_tags');
	const count = Math.max(1, Math.min(MAX_DRAFTS, Math.round(Number(v.count) || 5)));
	const type = (['mcq', 'short', 'written', 'mixed'] as const).includes(v.type) ? v.type : 'mixed';
	return {
		notes,
		subject,
		chapter,
		form: cut(v.form, 40) || null,
		term: v.term && (TERMS as readonly string[]).includes(v.term) ? v.term : null,
		count,
		type,
		difficulty: (DIFFICULTIES as readonly string[]).includes(v.difficulty ?? '')
			? (v.difficulty as Difficulty)
			: null
	};
}

export type AiResult =
	| { ok: true; drafts: number }
	| {
			ok: false;
			reason: 'resting' | 'tutor_cap' | 'unavailable' | 'failed' | 'nothing';
			/** the start of what the model wrote (shown on the test site only) */
			raw?: string;
	  };

/**
 * Asks the model and saves what it wrote as drafts. The counter is checked (and added to)
 * BEFORE the call; a call that fails still counts (Cloudflare may have counted it).
 */
export async function makeDrafts(
	db: DB,
	ai: AiBinding | null | undefined,
	tutorId: string,
	input: AiInput,
	opts: { testSite: boolean; now?: Date }
): Promise<AiResult> {
	const v = cleanAiInput(input);
	if (!ai || typeof ai.run !== 'function') return { ok: false, reason: 'unavailable' };
	const now = opts.now ?? new Date();
	const messages = buildMessages(v);
	const inTokens = estimateTokens(messages.map((m) => m.content).join('\n'));
	const reserved = neuronsFor(inTokens, MAX_OUT_TOKENS);
	const gate = await reserveNeurons(db, tutorId, reserved, aiStopLine(opts.testSite), now);
	if (gate !== 'ok') return { ok: false, reason: gate };
	let res: unknown;
	try {
		res = await ai.run(AI_MODEL, { messages, max_tokens: MAX_OUT_TOKENS, temperature: 0.4 });
	} catch (e) {
		return { ok: false, reason: 'failed', raw: String(e).slice(0, 300) };
	}
	const r = (res ?? {}) as {
		response?: unknown;
		usage?: { prompt_tokens?: number; completion_tokens?: number };
	};
	const u = r.usage;
	await settleNeurons(
		db,
		tutorId,
		reserved,
		u && Number.isFinite(u.prompt_tokens) && Number.isFinite(u.completion_tokens)
			? neuronsFor(Number(u.prompt_tokens), Number(u.completion_tokens))
			: null,
		now
	);
	// some models hand back the JSON already parsed
	const text = typeof r.response === 'string' ? r.response : JSON.stringify(r.response ?? '');
	const drafts = parseDrafts(text, v.count);
	if (!drafts.length) return { ok: false, reason: 'nothing', raw: text.slice(0, 600) };
	for (const d of drafts) {
		const q: BankInput = {
			type: d.type,
			prompt: d.prompt,
			choices: d.choices,
			answer: d.answer,
			accepted: d.accepted,
			explanation: d.explanation,
			subject: v.subject,
			form: v.form,
			chapter: v.chapter,
			term: v.term,
			difficulty: v.difficulty
		};
		try {
			await addBankQuestion(db, tutorId, q, { origin: 'ai', status: 'draft' });
		} catch (e) {
			if (!(e instanceof TestFail)) throw e;
		}
	}
	return { ok: true, drafts: drafts.length };
}
