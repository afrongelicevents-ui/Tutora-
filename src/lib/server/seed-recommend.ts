/**
 * Test site only: more approved tutors, so "Tutora recommended tutors" has real choices for
 * the test families (Tatenda: Mathematics and Physics, Form 3). One is pinned by the owner
 * and one is hidden, to show both. These tutors have no login.
 */
import type { DB } from './db/types.ts';
import { user } from './db/auth.schema.ts';
import { availability, subject, tutorProfile } from './db/app.schema.ts';
import { recommendPref } from './db/recommend.schema.ts';

const EXTRA = [
	{
		name: 'Kudakwashe Marufu',
		headline: 'O and A Level Maths, one step at a time',
		subjects: [{ name: 'Mathematics', levels: 'O Level, A Level' }],
		approved: true,
		hours: true,
		mode: null
	},
	{
		name: 'Nyasha Gumbo',
		headline: 'Physics and Chemistry with lots of practice',
		subjects: [
			{ name: 'Physics', levels: 'O Level' },
			{ name: 'Chemistry', levels: 'O Level' }
		],
		approved: true,
		hours: true,
		mode: 'pinned' as const
	},
	{
		name: 'Tafadzwa Chari',
		headline: 'Grade 7 and O Level Maths revision',
		subjects: [{ name: 'Mathematics', levels: 'Grade 7, O Level' }],
		approved: false,
		hours: false,
		mode: null
	},
	{
		name: 'Ropafadzo Mlambo',
		headline: 'Combined Science and Maths for Forms 1 to 4',
		subjects: [
			{ name: 'Combined Science', levels: 'O Level' },
			{ name: 'Mathematics', levels: 'O Level' }
		],
		approved: true,
		hours: false,
		mode: null
	},
	{
		name: 'Blessing Moyo',
		headline: 'Maths lessons (hidden from recommendations in the test data)',
		subjects: [{ name: 'Mathematics', levels: 'O Level' }],
		approved: true,
		hours: true,
		mode: 'hidden' as const
	}
];

export async function seedRecommendations(db: DB) {
	for (const [i, t] of EXTRA.entries()) {
		const slug = t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
		const id = `test_rec_${i + 1}`;
		await db.insert(user).values({
			id,
			name: t.name,
			email: `rec${i + 1}.tutor@example.com`,
			emailVerified: true,
			role: 'tutor'
		});
		await db.insert(tutorProfile).values({
			tutorId: id,
			slug,
			status: 'active',
			approvedAt: t.approved ? new Date() : null,
			tutorName: t.name,
			headline: t.headline,
			bio: 'A made-up tutor on the test site.',
			lessonModes: 'online',
			lessonMinutes: 60,
			defaultPriceCents: 900,
			showPrices: true,
			currency: 'USD',
			setupStep: 7,
			setupDoneAt: new Date()
		});
		await db.insert(subject).values(
			t.subjects.map((s, k) => ({
				tutorId: id,
				name: s.name,
				levels: s.levels,
				priceCents: 900,
				sortOrder: k
			}))
		);
		if (t.hours)
			await db.insert(availability).values(
				[1, 3, 5].map((weekday) => ({
					tutorId: id,
					weekday,
					startMinute: 16 * 60,
					endMinute: 18 * 60
				}))
			);
		if (t.mode) await db.insert(recommendPref).values({ tutorId: id, mode: t.mode });
	}
}
