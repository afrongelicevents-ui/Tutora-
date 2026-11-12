/**
 * Everything a child reads after a check-in comes from this reviewed list (the words are in
 * messages/en.json under the keys below). No generated text. To change what children read,
 * edit the messages and have them reviewed.
 */
import type { CHECKIN_MOODS } from './checkin-moods.ts';

export type Mood = (typeof CHECKIN_MOODS)[number];

/** good / okay / tough, for the weekly chart and simple comparisons (not a score of the child) */
export const MOOD_LEVEL: Record<Mood, 0 | 1 | 2> = {
	confident: 2,
	motivated: 2,
	need_break: 1,
	finding_hard: 0,
	need_help: 0
};

/** The response message key: with today's plan (needs {subject}) or without. */
export const responseKey = (mood: Mood, withPlan: boolean) =>
	`cr_${mood}_${withPlan ? 'plan' : 'noplan'}`;

/** One small next step, and where it leads (null: nothing to open). */
export const NEXT_STEP: Record<Mood, { key: string; href: string | null }> = {
	confident: { key: 'cs_confident', href: '/student/check' },
	motivated: { key: 'cs_motivated', href: '/student/study' },
	finding_hard: { key: 'cs_finding_hard', href: '/student/study' },
	need_help: { key: 'cs_need_help', href: '/student/messages' },
	need_break: { key: 'cs_need_break', href: null }
};

/** After "How did it go?" */
export const followupKey = (mood: Mood) => `cf_${mood}`;

/** Moods that count towards the gentle "talk to someone" suggestion. */
export const TOUGH: readonly Mood[] = ['finding_hard', 'need_help'];
/** Days in a row with a tough check-in before suggesting to talk to someone. */
export const TOUGH_DAYS = 3;
