import { and, eq, inArray, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { availability, subject, tutorProfile } from './db/app.schema.ts';
import { getSettings, type SiteSettings } from './settings.ts';
import { notifyOwners } from './notify.ts';
import { m } from '../paraglide/messages.js';

export interface ProfileItem {
	key: string;
	done: boolean;
	/** needed before the profile can be submitted for approval */
	required: boolean;
	/** Settings section that fills it */
	section: string;
}

/** What a tutor's profile has, and what is still missing (for the completeness bar). */
export async function completeness(db: DB, s: SiteSettings) {
	const [subs, times] = await Promise.all([
		db
			.select({ n: sql<number>`count(*)::int` })
			.from(subject)
			.where(and(eq(subject.tutorId, s.tutorId), eq(subject.active, true))),
		db
			.select({ n: sql<number>`count(*)::int` })
			.from(availability)
			.where(eq(availability.tutorId, s.tutorId))
	]);
	const items: ProfileItem[] = [
		{ key: 'cp_photo', done: !!s.photoKey, required: false, section: 'profile' },
		{ key: 'cp_intro', done: !!(s.bio && s.headline), required: true, section: 'profile' },
		{ key: 'cp_subjects', done: subs[0].n > 0, required: true, section: 'subjects' },
		{
			key: 'cp_qualifications',
			done: !!(s.qualifications || s.yearsTeaching),
			required: false,
			section: 'profile'
		},
		{
			key: 'cp_prices',
			done: s.defaultPriceCents != null || !s.showPrices,
			required: false,
			section: 'prices'
		},
		{ key: 'cp_times', done: times[0].n > 0, required: true, section: 'times' },
		{
			key: 'cp_where',
			done: s.lessonModes === 'online' || !!s.town,
			required: true,
			section: 'teaching'
		},
		{
			key: 'cp_contact',
			done: !!(s.whatsappNumber || s.phone),
			required: false,
			section: 'contact'
		},
		{
			key: 'cp_payments',
			done: !!(s.bankAccountNumber || s.ecocashNumber || s.innbucksNumber || s.acceptsCash),
			required: true,
			section: 'payments'
		}
	];
	const percent = Math.round((items.filter((i) => i.done).length / items.length) * 100);
	const canSubmit = items.every((i) => i.done || !i.required);
	return { items, percent, canSubmit };
}

export class SubmitFail extends Error {}

/** The tutor sends their profile to the Tutora team for approval. */
export async function submitForApproval(db: DB, tutorId: string) {
	const s = await getSettings(db, tutorId);
	if (s.status !== 'draft' && s.status !== 'rejected') throw new SubmitFail('err_state');
	const c = await completeness(db, s);
	if (!c.canSubmit) throw new SubmitFail('err_profile_incomplete');
	const done = await db
		.update(tutorProfile)
		.set({ status: 'pending', submittedAt: new Date(), rejectReason: null })
		.where(
			and(eq(tutorProfile.tutorId, tutorId), inArray(tutorProfile.status, ['draft', 'rejected']))
		)
		.returning({ id: tutorProfile.tutorId });
	if (!done.length) throw new SubmitFail('err_state');
	await notifyOwners(
		db,
		m.owner_submitted_s(),
		m.owner_submitted_b({ name: s.tutorName ?? '' }),
		'/owner'
	);
}
