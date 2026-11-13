/**
 * Personal daily schedule: the student's own timetable (school, meals, breaks, friends,
 * sport, study...) merged with study-plan slots, and plain-words tips that help it stay
 * sensible (no overlaps, breaks between long blocks, time to eat, enough sleep).
 */
import { and, asc, eq } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { personalActivity, ACTIVITY_KINDS, type ActivityKind } from './db/schedule.schema.ts';
import { planFor } from './study.ts';
import { local } from '../tz.ts';

export { ACTIVITY_KINDS, type ActivityKind };
export const MAX_ACTIVITIES = 60;

export interface Block {
	key: string;
	/** personal activity id (null: a study-plan slot, edited on the study plan page) */
	id: number | null;
	kind: ActivityKind;
	label: string | null;
	subject: string | null;
	start: number;
	end: number;
}

export function isKind(v: unknown): v is ActivityKind {
	return typeof v === 'string' && (ACTIVITY_KINDS as readonly string[]).includes(v);
}

export async function weekBlocks(db: DB, studentId: string) {
	const [acts, plan] = await Promise.all([
		db
			.select()
			.from(personalActivity)
			.where(and(eq(personalActivity.studentId, studentId), eq(personalActivity.active, true)))
			.orderBy(asc(personalActivity.startMinute)),
		planFor(db, studentId)
	]);
	const byDay: Block[][] = Array.from({ length: 7 }, () => []);
	for (const a of acts)
		for (const d of a.days)
			if (d >= 0 && d <= 6)
				byDay[d].push({
					key: `a${a.id}`,
					id: a.id,
					kind: a.kind,
					label: a.label,
					subject: null,
					start: a.startMinute,
					end: a.endMinute
				});
	for (const p of plan)
		byDay[p.weekday].push({
			key: `p${p.id}`,
			id: null,
			kind: 'study',
			label: p.topic,
			subject: p.subject,
			start: p.startMinute,
			end: Math.min(1440, p.startMinute + p.minutes)
		});
	for (const day of byDay) day.sort((a, b) => a.start - b.start || a.end - b.end);
	return byDay;
}

export async function todaysBlocks(db: DB, studentId: string, now = new Date()) {
	return (await weekBlocks(db, studentId))[local(now).weekday];
}

export async function addActivity(
	db: DB,
	studentId: string,
	v: { kind: ActivityKind; label: string; days: number[]; start: number; end: number }
): Promise<{ ok: true } | { ok: false; error: string }> {
	const days = [...new Set(v.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))];
	if (!days.length) return { ok: false, error: 'ps_err_days' };
	if (!(v.start >= 0 && v.start < 1440 && v.end > v.start && v.end <= 1440))
		return { ok: false, error: 'ps_err_time' };
	const count = (
		await db
			.select({ id: personalActivity.id })
			.from(personalActivity)
			.where(eq(personalActivity.studentId, studentId))
	).length;
	if (count >= MAX_ACTIVITIES) return { ok: false, error: 'ps_err_many' };
	await db.insert(personalActivity).values({
		studentId,
		kind: v.kind,
		label: v.label.trim().slice(0, 40) || null,
		days,
		startMinute: v.start,
		endMinute: v.end
	});
	return { ok: true };
}

export async function removeActivity(db: DB, studentId: string, id: number) {
	// kept (inactive) so past days in the personal report stay as they were
	await db
		.update(personalActivity)
		.set({ active: false, removedAt: new Date() })
		.where(
			and(
				eq(personalActivity.id, id),
				eq(personalActivity.studentId, studentId),
				eq(personalActivity.active, true)
			)
		);
}

/** Plain-words tips for one day's timetable. Keys are messages ps_tip_*. */
export function tipsFor(day: Block[]): { key: string; a?: string; b?: string }[] {
	const tips: { key: string; a?: string; b?: string }[] = [];
	if (!day.length) return tips;
	const name = (x: Block) => x.label || x.subject || x.kind;
	// overlaps (sleep across the evening is fine to touch, not to overlap)
	for (let i = 0; i < day.length; i++)
		for (let j = i + 1; j < day.length; j++)
			if (day[j].start < day[i].end && day[i].start < day[j].end) {
				tips.push({ key: 'ps_tip_overlap', a: name(day[i]), b: name(day[j]) });
				i = day.length;
				break;
			}
	// long study without a break: study blocks back to back for more than 90 minutes
	const study = day.filter((x) => x.kind === 'study');
	let run = 0;
	let prevEnd = -1;
	for (const s of study) {
		run = s.start - prevEnd <= 5 ? run + (s.end - s.start) : s.end - s.start;
		prevEnd = s.end;
		if (run > 90) {
			tips.push({ key: 'ps_tip_break' });
			break;
		}
	}
	const has = (k: ActivityKind) => day.some((x) => x.kind === k);
	if (!has('meal')) tips.push({ key: 'ps_tip_meal' });
	if (study.length && !has('break') && !has('friends') && !has('sport'))
		tips.push({ key: 'ps_tip_rest' });
	const late = study.find((s) => s.end > 21 * 60 + 30);
	if (late) tips.push({ key: 'ps_tip_late' });
	return tips;
}
