/**
 * Fake data for the TEST site only: an owner, approved tutors with different subjects,
 * one tutor waiting for approval, students and parents (some under 18), lessons in the past
 * and the future (groups and one-to-one), requests, payments in every state, receipts,
 * packages, homework and reviews. Everything uses obviously fake names, emails and numbers.
 *
 * It DELETES ALL DATA first, so callers must only use it on the test site.
 */
import { sql } from 'drizzle-orm';
import type { Auth } from './auth-config.ts';
import type { DB } from './db/types.ts';
import {
	attendee,
	availability,
	booking,
	calendarEvent,
	charge,
	enrollment,
	fileBlob,
	homework,
	homeworkAnswer,
	lesson,
	lessonPackage,
	payment,
	profile,
	resultHighlight,
	review,
	studentPackage,
	subject,
	tutorProfile
} from './db/app.schema.ts';
import { account, user } from './db/auth.schema.ts';
import { confirmPayment, recordCash, rejectPayment } from './billing.ts';
import { addDays, fromLocal, localDate } from '../tz.ts';

/** One shared password for every test login (the test site shows it on purpose). */
export const TEST_PASSWORD = 'TutoraTest2026';

export interface TestLogin {
	role: string;
	name: string;
	email: string;
}

/** A tiny valid PNG, used as fake "proof of payment" and homework files. */
const PNG = Uint8Array.from(
	atob(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
	),
	(c) => c.charCodeAt(0)
);

const day = (offset: number) => localDate(addDays(new Date(), offset));
const at = (offset: number, hhmm: string) => {
	const [h, m] = hhmm.split(':').map(Number);
	return fromLocal(day(offset), h * 60 + m);
};
const plus = (d: Date, min: number) => new Date(d.getTime() + min * 60_000);

export async function seedTestData(
	db: DB,
	auth: Auth,
	opts: { testSite: boolean }
): Promise<TestLogin[]> {
	if (!opts.testSite) throw new Error('seedTestData only runs on the test site');

	// 1. Wipe everything (users cascade to all their data).
	await db.execute(
		sql`truncate table "user", "verification", "rate_limit", "action_limit", "file_blob", "setup_code" restart identity cascade`
	);
	await db.execute(sql`alter sequence receipt_no_seq restart with 1`);

	const ctx = await auth.$context;
	const hash = await ctx.password.hash(TEST_PASSWORD);
	const logins: TestLogin[] = [];

	async function person(
		name: string,
		email: string,
		role: 'owner' | 'tutor' | 'student' | 'parent'
	): Promise<string> {
		const id = `test_${email.split('@')[0].replace(/[^a-z0-9]/g, '_')}`;
		await db.insert(user).values({ id, name, email, emailVerified: true, role });
		await db.insert(account).values({
			id: `acc_${id}`,
			userId: id,
			accountId: id,
			providerId: 'credential',
			password: hash
		});
		logins.push({ role, name, email });
		return id;
	}

	// 2. People
	await person('Tutora Owner', 'owner@example.com', 'owner');

	const tutorDefs = [
		{
			name: 'Chipo Moyo',
			email: 'chipo@example.com',
			headline: 'Clear, patient Maths and Physics lessons that build confidence',
			bio: 'I have taught O and A Level Maths for 9 years. I explain each step slowly, give lots of practice and check that you really understand before we move on.',
			qualifications: 'BSc Mathematics (UZ), Diploma in Education',
			years: 9,
			town: 'Harare (Avondale)',
			modes: 'both' as const,
			groups: 'both' as const,
			whatsapp: '+263770000101',
			price: 1000,
			subjects: [
				{ name: 'Mathematics', levels: 'O Level, A Level', price: 1000 },
				{ name: 'Physics', levels: 'O Level', price: 1200 }
			]
		},
		{
			name: 'Tendai Ncube',
			email: 'tendai@example.com',
			headline: 'English and Literature for Grade 7 and O Level',
			bio: 'Reading, writing and exam practice in small steps. I help learners write clear compositions and answer comprehension questions with confidence.',
			qualifications: 'BA English (MSU)',
			years: 5,
			town: null,
			modes: 'online' as const,
			groups: 'one_to_one' as const,
			whatsapp: '+263770000102',
			price: 800,
			subjects: [
				{ name: 'English Language', levels: 'Grade 7, O Level', price: 800 },
				{ name: 'Literature in English', levels: 'O Level', price: 900 }
			]
		},
		{
			name: 'Farai Dube',
			email: 'farai@example.com',
			headline: 'Shona and History, in person in Bulawayo',
			bio: 'Small group lessons after school. We read, discuss and practise past papers together.',
			qualifications: 'Certificate in Education',
			years: 12,
			town: 'Bulawayo (Suburbs)',
			modes: 'in_person' as const,
			groups: 'groups' as const,
			whatsapp: null,
			price: 700,
			subjects: [
				{ name: 'Shona', levels: 'Grade 7, O Level', price: 700 },
				{ name: 'History', levels: 'O Level', price: 700 }
			]
		}
	];

	const tutors: { id: string; subjects: number[]; packages: number[]; price: number }[] = [];
	for (const [i, t] of tutorDefs.entries()) {
		const id = await person(t.name, t.email, 'tutor');
		await db.insert(tutorProfile).values({
			tutorId: id,
			slug: t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
			status: 'active',
			approvedAt: new Date(),
			tutorName: t.name,
			headline: t.headline,
			bio: t.bio,
			qualifications: t.qualifications,
			yearsTeaching: t.years,
			town: t.town,
			lessonModes: t.modes,
			groupMode: t.groups,
			maxGroupSize: 4,
			lessonMinutes: 60,
			cancelHours: 24,
			defaultPriceCents: t.price,
			showPrices: true,
			currency: 'USD',
			whatsappNumber: t.whatsapp,
			contactEmail: t.email,
			ecocashNumber: `+26377000020${i + 1}`,
			ecocashName: t.name,
			bankName: i === 0 ? 'Test Bank' : null,
			bankAccountName: i === 0 ? t.name : null,
			bankAccountNumber: i === 0 ? '0000 1111 2222' : null,
			bankBranch: i === 0 ? 'Harare Main' : null,
			paymentNote: 'Use your name as the reference.',
			resultsConsent: i === 0,
			setupStep: 7,
			setupDoneAt: new Date()
		});
		const subs = await db
			.insert(subject)
			.values(
				t.subjects.map((s, k) => ({
					tutorId: id,
					name: s.name,
					levels: s.levels,
					priceCents: s.price,
					sortOrder: k
				}))
			)
			.returning({ id: subject.id });
		const pkgs = await db
			.insert(lessonPackage)
			.values([
				{ tutorId: id, name: '5 lessons', lessonCount: 5, priceCents: t.price * 5 - 500 },
				{ tutorId: id, name: '10 lessons', lessonCount: 10, priceCents: t.price * 10 - 1500 }
			])
			.returning({ id: lessonPackage.id });
		// free times: Monday to Friday 15:00-19:00, Saturday 08:00-12:00
		await db.insert(availability).values([
			...[1, 2, 3, 4, 5].map((weekday) => ({
				tutorId: id,
				weekday,
				startMinute: 15 * 60,
				endMinute: 19 * 60
			})),
			{ tutorId: id, weekday: 6, startMinute: 8 * 60, endMinute: 12 * 60 }
		]);
		await db.insert(calendarEvent).values({
			tutorId: id,
			title: 'School meeting',
			startsAt: at(3, '17:00'),
			endsAt: at(3, '18:00'),
			note: null
		});
		if (i === 0)
			await db.insert(resultHighlight).values([
				{
					tutorId: id,
					value: '92%',
					label: 'of my O Level students passed Maths in 2025',
					sortOrder: 0
				},
				{ tutorId: id, value: '14', label: 'A grades last year', sortOrder: 1 }
			]);
		tutors.push({
			id,
			subjects: subs.map((s) => s.id),
			packages: pkgs.map((p) => p.id),
			price: t.price
		});
	}

	// a tutor who just joined and waits for the owner's approval
	const pendingId = await person('Rumbi Chikwanha', 'rumbi@example.com', 'tutor');
	await db.insert(tutorProfile).values({
		tutorId: pendingId,
		slug: 'rumbi-chikwanha',
		status: 'pending',
		tutorName: 'Rumbi Chikwanha'
	});

	const studentDefs: {
		name: string;
		email: string;
		role: 'student' | 'parent';
		under18?: boolean;
		child?: string;
		tutors: number[];
	}[] = [
		{ name: 'Rudo Banda', email: 'rudo@example.com', role: 'student', tutors: [0, 1] },
		{
			name: 'Tatenda Sibanda',
			email: 'tatenda@example.com',
			role: 'student',
			under18: true,
			tutors: [0]
		},
		{ name: 'Nyasha Mutasa', email: 'nyasha@example.com', role: 'student', tutors: [0] },
		{ name: 'Kuda Chirwa', email: 'kuda@example.com', role: 'student', under18: true, tutors: [0] },
		{
			name: 'Mrs Grace Zulu',
			email: 'grace@example.com',
			role: 'parent',
			child: 'Anesu Zulu',
			tutors: [0]
		},
		{ name: 'Tsitsi Mhlanga', email: 'tsitsi@example.com', role: 'student', tutors: [1] },
		{
			name: 'Blessing Ndlovu',
			email: 'blessing@example.com',
			role: 'student',
			under18: true,
			tutors: [1]
		},
		{
			name: 'Mr Peter Gumbo',
			email: 'peter@example.com',
			role: 'parent',
			child: 'Ruvimbo Gumbo',
			tutors: [1]
		},
		{ name: 'Simba Makoni', email: 'simba@example.com', role: 'student', tutors: [1] },
		{
			name: 'Chiedza Marufu',
			email: 'chiedza@example.com',
			role: 'student',
			under18: true,
			tutors: [2]
		},
		{ name: 'Tinashe Phiri', email: 'tinashe@example.com', role: 'student', tutors: [2] },
		{
			name: 'Mrs Ruth Moyo',
			email: 'ruth@example.com',
			role: 'parent',
			child: 'Takudzwa Moyo',
			tutors: [2]
		},
		{ name: 'Fadzai Mapfumo', email: 'fadzai@example.com', role: 'student', tutors: [2] },
		{
			name: 'Panashe Shumba',
			email: 'panashe@example.com',
			role: 'student',
			under18: true,
			tutors: [2]
		},
		{ name: 'Vimbai Hove', email: 'vimbai@example.com', role: 'student', tutors: [] }
	];
	const students: { id: string; name: string; tutors: number[] }[] = [];
	for (const [k, s] of studentDefs.entries()) {
		const id = await person(s.name, s.email, s.role);
		await db.insert(profile).values({
			userId: id,
			phone: `+2637710000${String(k + 10).padStart(2, '0')}`,
			isUnder18: !!s.under18,
			parentName: s.under18 ? `Parent of ${s.name.split(' ')[0]}` : null,
			parentPhone: s.under18 ? `+2637720000${String(k + 10).padStart(2, '0')}` : null,
			childName: s.child ?? null,
			consentAt: new Date()
		});
		for (const t of s.tutors)
			await db.insert(enrollment).values({
				tutorId: tutors[t].id,
				userId: id,
				level: ['Form 2', 'Form 3', 'Form 4', 'Grade 7', 'Lower 6'][k % 5]
			});
		students.push({ id, name: s.name, tutors: s.tutors });
	}
	const of = (t: number) => students.filter((s) => s.tutors.includes(t));

	// 3. Lessons: past and upcoming, one-to-one and groups, each with its charge
	async function addLesson(
		t: number,
		start: Date,
		people: { id: string }[],
		opts: {
			subject?: number;
			mode?: 'online' | 'in_person';
			group?: boolean;
			kind?: 'lesson' | 'intro';
		} = {}
	) {
		const tutor = tutors[t];
		const kind = opts.kind ?? 'lesson';
		const [l] = await db
			.insert(lesson)
			.values({
				tutorId: tutor.id,
				kind,
				subjectId: kind === 'intro' ? null : tutor.subjects[opts.subject ?? 0],
				mode: opts.mode ?? (t === 2 ? 'in_person' : 'online'),
				startsAt: start,
				endsAt: plus(start, kind === 'intro' ? 15 : 60),
				capacity: opts.group ? 4 : 1,
				reminded24: start < new Date(),
				reminded1: start < new Date()
			})
			.returning();
		for (const p of people) {
			const price = kind === 'intro' ? 0 : tutor.price;
			const [b] = await db
				.insert(booking)
				.values({
					tutorId: tutor.id,
					userId: p.id,
					kind,
					subjectId: l.subjectId,
					mode: l.mode,
					startsAt: l.startsAt,
					endsAt: l.endsAt,
					status: 'accepted',
					lessonId: l.id,
					decidedAt: addDays(start, -2)
				})
				.returning();
			const [a] = await db
				.insert(attendee)
				.values({ lessonId: l.id, userId: p.id, bookingId: b.id, priceCents: price })
				.returning();
			if (price > 0)
				await db.insert(charge).values({
					tutorId: tutor.id,
					userId: p.id,
					kind: 'lesson',
					attendeeId: a.id,
					description: `Lesson, ${localDate(start)}`,
					amountCents: price,
					createdAt: addDays(start, -2)
				});
		}
		return l;
	}

	for (let t = 0; t < 3; t++) {
		const s = of(t);
		const group = t !== 1;
		// past: one-to-one lessons over the last three weeks
		for (let w = 1; w <= 3; w++)
			for (const [k, st] of s.slice(0, 3).entries())
				await addLesson(t, at(-7 * w + k, `${15 + k}:00`), [st], { subject: k % 2 });
		// past group lesson
		if (group) await addLesson(t, at(-4, '10:00'), s.slice(0, 3), { group: true });
		// today and upcoming
		await addLesson(t, at(0, '17:00'), [s[0]], { subject: 0 });
		await addLesson(t, at(1, '16:00'), [s[1] ?? s[0]], { subject: 1 });
		await addLesson(t, at(2, '15:00'), [s[2] ?? s[0]]);
		if (group) await addLesson(t, at(5, '09:00'), s.slice(1, 3), { group: true });
		if (t === 0) await addLesson(t, at(4, '18:30'), [s[3]], { kind: 'intro' });
	}

	// 4. Open requests for the tutors to answer (requested, proposed, declined)
	for (let t = 0; t < 3; t++) {
		const s = of(t);
		const last = s[s.length - 1];
		const start = at(6, '16:00');
		await db.insert(booking).values([
			{
				tutorId: tutors[t].id,
				userId: last.id,
				kind: 'lesson',
				subjectId: tutors[t].subjects[0],
				mode: t === 2 ? 'in_person' : 'online',
				startsAt: start,
				endsAt: plus(start, 60),
				note: 'I need help with past papers please.',
				status: 'requested'
			},
			{
				tutorId: tutors[t].id,
				userId: s[0].id,
				kind: 'lesson',
				subjectId: tutors[t].subjects[1],
				mode: t === 2 ? 'in_person' : 'online',
				startsAt: at(7, '15:00'),
				endsAt: plus(at(7, '15:00'), 60),
				status: 'proposed',
				proposedStartsAt: at(8, '16:00'),
				tutorMessage: 'I am busy then. Is the next day at 4pm OK?',
				decidedAt: new Date()
			},
			{
				tutorId: tutors[t].id,
				userId: s[1].id,
				kind: 'intro',
				subjectId: null,
				mode: 'online',
				startsAt: at(-1, '18:00'),
				endsAt: plus(at(-1, '18:00'), 15),
				status: 'declined',
				tutorMessage: 'Sorry, that time is no longer free.',
				decidedAt: addDays(new Date(), -2)
			}
		]);
	}

	// 5. Packages: one student per tutor bought 5 lessons (2 used)
	for (let t = 0; t < 3; t++) {
		const st = of(t)[1];
		const [sp] = await db
			.insert(studentPackage)
			.values({
				tutorId: tutors[t].id,
				userId: st.id,
				packageId: tutors[t].packages[0],
				name: '5 lessons',
				lessonsTotal: 5,
				lessonsUsed: 2,
				priceCents: tutors[t].price * 5 - 500
			})
			.returning();
		await db.insert(charge).values({
			tutorId: tutors[t].id,
			userId: st.id,
			kind: 'package',
			studentPackageId: sp.id,
			description: 'Package: 5 lessons',
			amountCents: sp.priceCents
		});
	}

	// 6. Payments in every state: confirmed (with receipt), waiting, rejected, cash
	async function proof(key: string) {
		await db.insert(fileBlob).values({ key, contentType: 'image/png', data: PNG });
		return key;
	}
	for (let t = 0; t < 3; t++) {
		const tid = tutors[t].id;
		const s = of(t);
		const pay = async (
			userId: string,
			cents: number,
			status: 'confirm' | 'wait' | 'reject',
			d: number
		) => {
			const [p] = await db
				.insert(payment)
				.values({
					tutorId: tid,
					userId,
					amountCents: cents,
					currency: 'USD',
					method: d % 2 ? 'ecocash' : 'bank',
					reference: `TEST${t}${d}${cents}`,
					paidOn: day(-d),
					proofKey: await proof(`proofs/${userId}/test-${t}-${d}.png`),
					recordedBy: 'student'
				})
				.returning();
			if (status === 'confirm') await confirmPayment(db, tid, p.id);
			if (status === 'reject')
				await rejectPayment(db, tid, p.id, 'The reference does not match any payment I received.');
		};
		await pay(s[0].id, tutors[t].price * 2, 'confirm', 10);
		await pay(s[1].id, tutors[t].price * 5 - 500, 'confirm', 6);
		await pay(s[2].id, tutors[t].price, 'wait', 1);
		await pay(s[0].id, tutors[t].price, 'reject', 3);
		await recordCash(db, tid, s[2].id, tutors[t].price * 2, day(-2));
		// a student says they paid cash and waits for the tutor to confirm
		await db.insert(payment).values({
			tutorId: tid,
			userId: s[1].id,
			amountCents: tutors[t].price,
			currency: 'USD',
			method: 'cash',
			reference: null,
			paidOn: day(0),
			recordedBy: 'student'
		});
	}

	// 7. Homework with answers and feedback
	for (let t = 0; t < 3; t++) {
		const s = of(t);
		const [h1] = await db
			.insert(homework)
			.values({
				tutorId: tutors[t].id,
				userId: s[0].id,
				title: 'Past paper practice: Paper 1, 2023',
				note: 'Do questions 1 to 10. Show your working.',
				dueOn: day(3)
			})
			.returning();
		const [h2] = await db
			.insert(homework)
			.values({
				tutorId: tutors[t].id,
				userId: s[1].id,
				title: 'Revision worksheet',
				note: 'Read the notes and answer the questions on the sheet.',
				fileKey: await proof(`homework/${s[1].id}/test-${t}.png`),
				fileName: 'worksheet.png',
				dueOn: day(-2)
			})
			.returning();
		await db.insert(homeworkAnswer).values([
			{ homeworkId: h1.id, note: 'I finished 1 to 7. Number 8 was hard.', feedback: null },
			{
				homeworkId: h2.id,
				note: 'Done, see my photo.',
				fileKey: await proof(`answers/${s[1].id}/test-${t}.png`),
				fileName: 'answer.png',
				feedback: 'Well done! Check question 4 again.'
			}
		]);
	}

	// 8. Reviews (one hidden, to show the tutor can hide reviews)
	const texts = [
		[5, 'Very patient and explains everything clearly. My marks went up a lot.'],
		[4, 'Good lessons and useful homework. Sometimes the connection was slow.'],
		[5, 'My child now enjoys the subject. Thank you!']
	] as const;
	for (let t = 0; t < 3; t++) {
		for (const [k, st] of of(t).slice(0, 3).entries()) {
			await db.insert(review).values({
				tutorId: tutors[t].id,
				userId: st.id,
				displayName: st.name.replace(/^(Mrs|Mr) /, '').split(' ')[0],
				rating: texts[k][0],
				text: texts[k][1],
				hidden: t === 1 && k === 2
			});
		}
	}

	return logins;
}
