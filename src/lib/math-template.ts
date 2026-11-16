/**
 * Maths questions with changing numbers, e.g. "Solve {a}x + {b} = {c}".
 *
 * A template has variables with ranges, optional worked-out values ("lets", e.g. c = a*x+b)
 * and an answer formula. A tiny, safe calculator works them out: numbers, names,
 * + - * / ^ and brackets only. No eval, no Function, no other names: anything else is refused.
 * Each student gets their own numbers from a seed, so the same student always sees the same
 * numbers for the same test.
 */
/** A maths question with changing numbers: "Solve {a}x + {b} = {c}", answer "({c}-{b})/{a}". */
export interface QuestionTemplate {
	vars: Record<string, { min: number; max: number; step?: number }>;
	/** worked out from the variables (in order); may use earlier ones */
	lets?: Record<string, string>;
	answer: string;
	/** decimal places in the answer (default 0 = whole numbers) */
	decimals?: number;
}

export class TemplateFail extends Error {
	constructor(public code: string) {
		super(code);
	}
}

const MAX_EXPR = 200;
const MAX_DEPTH = 20;
const MAX_VARS = 8;
const MAX_ABS = 1_000_000;
const NAME = /^[a-z][a-z0-9]{0,7}$/;

type Tok = { k: 'num'; v: number } | { k: 'name'; v: string } | { k: 'op'; v: string };

function tokens(src: string): Tok[] {
	if (src.length > MAX_EXPR) throw new TemplateFail('qb_err_formula');
	const out: Tok[] = [];
	let i = 0;
	while (i < src.length) {
		const c = src[i];
		if (c === ' ' || c === '\t') {
			i++;
			continue;
		}
		if ('+-*/^()'.includes(c)) {
			out.push({ k: 'op', v: c });
			i++;
			continue;
		}
		const num = /^\d+(?:\.\d+)?/.exec(src.slice(i));
		if (num) {
			out.push({ k: 'num', v: Number(num[0]) });
			i += num[0].length;
			continue;
		}
		const name = /^[a-z][a-z0-9]*/.exec(src.slice(i));
		if (name && NAME.test(name[0])) {
			out.push({ k: 'name', v: name[0] });
			i += name[0].length;
			continue;
		}
		throw new TemplateFail('qb_err_formula');
	}
	if (!out.length) throw new TemplateFail('qb_err_formula');
	return out;
}

export type Expr =
	| { t: 'n'; v: number }
	| { t: 'v'; name: string }
	| { t: 'neg'; e: Expr }
	| { t: 'bin'; op: string; a: Expr; b: Expr };

/** Parses a formula; throws TemplateFail('qb_err_formula') on anything unexpected. */
export function parseFormula(src: string): Expr {
	const ts = tokens(src);
	let p = 0;
	const peek = () => ts[p];
	const isOp = (v: string) => peek()?.k === 'op' && peek()!.v === v;
	const fail = () => {
		throw new TemplateFail('qb_err_formula');
	};
	function expr(d: number): Expr {
		if (d > MAX_DEPTH) fail();
		let a = term(d + 1);
		while (isOp('+') || isOp('-')) {
			const op = ts[p++].v as string;
			a = { t: 'bin', op, a, b: term(d + 1) };
		}
		return a;
	}
	function term(d: number): Expr {
		let a = unary(d + 1);
		while (isOp('*') || isOp('/')) {
			const op = ts[p++].v as string;
			a = { t: 'bin', op, a, b: unary(d + 1) };
		}
		return a;
	}
	// "-x^2" is -(x^2), as in maths
	function unary(d: number): Expr {
		if (d > MAX_DEPTH) fail();
		if (isOp('-')) {
			p++;
			return { t: 'neg', e: unary(d + 1) };
		}
		return power(d + 1);
	}
	function power(d: number): Expr {
		const a = primary(d + 1);
		if (isOp('^')) {
			p++;
			return { t: 'bin', op: '^', a, b: unary(d + 1) };
		}
		return a;
	}
	function primary(d: number): Expr {
		const tk = ts[p++];
		if (!tk) fail();
		if (tk.k === 'num') return { t: 'n', v: tk.v };
		if (tk.k === 'name') return { t: 'v', name: tk.v };
		if (tk.v === '(') {
			const e = expr(d + 1);
			if (!isOp(')')) fail();
			p++;
			return e;
		}
		return fail();
	}
	const e = expr(0);
	if (p !== ts.length) fail();
	return e;
}

export function namesIn(e: Expr, out = new Set<string>()): Set<string> {
	if (e.t === 'v') out.add(e.name);
	else if (e.t === 'neg') namesIn(e.e, out);
	else if (e.t === 'bin') {
		namesIn(e.a, out);
		namesIn(e.b, out);
	}
	return out;
}

export function evaluate(e: Expr, vals: Record<string, number>): number {
	switch (e.t) {
		case 'n':
			return e.v;
		case 'v': {
			const v = vals[e.name];
			if (typeof v !== 'number') throw new TemplateFail('qb_err_unknown_name');
			return v;
		}
		case 'neg':
			return -evaluate(e.e, vals);
		case 'bin': {
			const a = evaluate(e.a, vals);
			const b = evaluate(e.b, vals);
			let r: number;
			if (e.op === '+') r = a + b;
			else if (e.op === '-') r = a - b;
			else if (e.op === '*') r = a * b;
			else if (e.op === '/') {
				if (b === 0) throw new TemplateFail('qb_err_divide_zero');
				r = a / b;
			} else {
				if (Math.abs(b) > 10) throw new TemplateFail('qb_err_formula');
				r = a ** b;
			}
			if (!Number.isFinite(r) || Math.abs(r) > MAX_ABS) throw new TemplateFail('qb_err_too_big');
			return r;
		}
	}
}

/** Mulberry32: small seeded random numbers (0 ≤ x < 1). */
export function seededRandom(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** FNV-1a hash of a string, for seeds. */
export function hashText(s: string) {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return h;
}

const roundTo = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;
const isExactly = (x: number, d: number) => Math.abs(x - roundTo(x, d)) < 1e-9;

interface Compiled {
	vars: [string, { min: number; max: number; step: number }][];
	lets: [string, Expr][];
	answer: Expr;
	decimals: number;
}

/** Checks a template and returns it cleaned; throws TemplateFail with a message key. */
export function cleanTemplate(t: QuestionTemplate, prompt: string): QuestionTemplate {
	const c = compile(t);
	// every {name} in the prompt must be a variable or a worked-out value
	const known = new Set([...c.vars.map(([n]) => n), ...c.lets.map(([n]) => n)]);
	for (const m of prompt.matchAll(/\{([^}]*)\}/g))
		if (!known.has(m[1].trim())) throw new TemplateFail('qb_err_unknown_name');
	// and at least some numbers must give a clean answer
	let ok = 0;
	for (let s = 1; s <= 40 && ok < 3; s++) if (tryValues(c, seededRandom(s))) ok++;
	if (!ok) throw new TemplateFail('qb_err_no_values');
	return {
		vars: Object.fromEntries(c.vars),
		...(c.lets.length ? { lets: Object.fromEntries(Object.entries(t.lets ?? {})) } : {}),
		answer: t.answer.trim(),
		decimals: c.decimals
	};
}

function compile(t: QuestionTemplate): Compiled {
	const vars = Object.entries(t.vars ?? {});
	if (!vars.length || vars.length > MAX_VARS) throw new TemplateFail('qb_err_vars');
	const names = new Set<string>();
	const cv: Compiled['vars'] = vars.map(([n, r]) => {
		const min = Number(r?.min);
		const max = Number(r?.max);
		const step = r?.step === undefined || r?.step === null ? 1 : Number(r.step);
		if (!NAME.test(n) || names.has(n)) throw new TemplateFail('qb_err_vars');
		if (![min, max, step].every(Number.isFinite) || min > max || step <= 0)
			throw new TemplateFail('qb_err_range');
		if (Math.abs(min) > 10_000 || Math.abs(max) > 10_000 || (max - min) / step > 10_000)
			throw new TemplateFail('qb_err_range');
		names.add(n);
		return [n, { min, max, step }];
	});
	const lets: Compiled['lets'] = [];
	for (const [n, f] of Object.entries(t.lets ?? {})) {
		if (!NAME.test(n) || names.has(n) || lets.length >= MAX_VARS)
			throw new TemplateFail('qb_err_vars');
		const e = parseFormula(String(f));
		for (const used of namesIn(e))
			if (!names.has(used)) throw new TemplateFail('qb_err_unknown_name');
		names.add(n);
		lets.push([n, e]);
	}
	const answer = parseFormula(String(t.answer ?? ''));
	for (const used of namesIn(answer))
		if (!names.has(used)) throw new TemplateFail('qb_err_unknown_name');
	const decimals = Math.max(0, Math.min(3, Math.round(Number(t.decimals ?? 0)) || 0));
	return { vars: cv, lets, answer, decimals };
}

function tryValues(c: Compiled, rnd: () => number) {
	const vals: Record<string, number> = {};
	for (const [n, r] of c.vars) {
		const steps = Math.floor((r.max - r.min) / r.step + 1e-9);
		vals[n] = roundTo(r.min + r.step * Math.floor(rnd() * (steps + 1)), 6);
	}
	try {
		for (const [n, e] of c.lets) {
			const v = evaluate(e, vals);
			// shown in the question, so worked-out values must be tidy too
			if (!isExactly(v, 3)) return null;
			vals[n] = roundTo(v, 6);
		}
		const answer = evaluate(c.answer, vals);
		if (!isExactly(answer, c.decimals)) return null;
		return { vals, answer: roundTo(answer, c.decimals) };
	} catch (e) {
		if (e instanceof TemplateFail) return null;
		throw e;
	}
}

const show = (x: number) => String(roundTo(x, 6));

/**
 * One student's version of a template question: the prompt with their numbers and the
 * answer. Tries up to 50 seeds from `seed` for numbers that give a clean answer.
 */
export function instantiate(t: QuestionTemplate, prompt: string, seed: number) {
	const c = compile(t);
	const rnd = seededRandom(seed);
	for (let i = 0; i < 50; i++) {
		const got = tryValues(c, rnd);
		if (got)
			return {
				prompt: prompt.replace(/\{([^}]*)\}/g, (_, n: string) =>
					n.trim() in got.vals ? show(got.vals[n.trim()]) : `{${n}}`
				),
				answer: got.answer,
				decimals: c.decimals,
				values: got.vals
			};
	}
	throw new TemplateFail('qb_err_no_values');
}

/** Reads a typed number: "3", "-2.5", "2,5", "7/2". Null when it isn't one. */
export function readNumber(s: string): number | null {
	const x = s.trim().replace(/\s+/g, '').replace(',', '.');
	if (/^[-+]?\d+(?:\.\d+)?$/.test(x)) return Number(x);
	const f = /^([-+]?\d+)\/(\d+)$/.exec(x);
	if (f && Number(f[2]) !== 0) return Number(f[1]) / Number(f[2]);
	return null;
}

/** Is a typed answer right? Whole-number answers must match exactly; decimals to the places asked. */
export function numberMatches(given: string, expected: number, decimals: number) {
	const n = readNumber(given);
	if (n === null) return false;
	const tol = decimals > 0 ? 0.5 * 10 ** -decimals + 1e-9 : 1e-6;
	return Math.abs(n - expected) <= tol;
}
