/**
 * v3 fake data for the TEST site only (runs after seed.ts): Family Connection, check-ins,
 * school work, study plans and sessions, results, exams, quizzes and lesson materials.
 * Everything is clearly fake (example.com, test names).
 */
import { connectByCode, moderate, myCode, saveCard, sendPreset } from './buddies.ts';
import { sendMessage } from './messages.ts';
import { and, asc, eq, gt, inArray } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { account, user } from './db/auth.schema.ts';
import { attendee, child, enrollment, homework, lesson, profile } from './db/app.schema.ts';
import {
	checkin,
	type CheckinMood,
	familyInvite,
	lessonFeedback,
	lessonMaterial,
	question,
	questionSet,
	quizAssignment,
	resource,
	schoolInfo,
	schoolSubject,
	studyPlanItem,
	studySession
} from './db/v3.schema.ts';
import { legacyParentsToFamily } from './legacy-family.ts';
import { createInvite, normalizeInvite, redeemInvite, setSharing, sha256Hex } from './family.ts';
import { addExam, recordResult } from './progress.ts';
import { addDays, addMinutes, fromLocal, local, localDate } from '../tz.ts';
import type { TestLogin } from './seed.ts';

/** A code anyone can use on the test site to try "Join with code" (Kuda's invite). */
export const TEST_INVITE_CODE = 'KUD-TEST42';

export async function seedV3(db: DB, hash: string, logins: TestLogin[], now = new Date()) {
	// 1. The v2 parents (who booked for their children) go through the real v3 conversion.
	await legacyParentsToFamily(db);

	const idOf = async (email: string) => {
		const [u] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
		if (!u) throw new Error(`seed: ${email} missing`);
		return u.id;
	};
	const login = async (userId: string, email: string, name: string, shown = email) => {
		await db.update(user).set({ email }).where(eq(user.id, userId));
		await db
			.insert(account)
			.values({
				id: `acc_${userId}`,
				userId,
				accountId: userId,
				providerId: 'credential',
				password: hash
			})
			.onConflictDoNothing();
		logins.push({ role: 'student', name, email: shown });
	};
	const parentAccount = async (name: string, email: string) => {
		const id = `test_${email.split('@')[0].replace(/[^a-z0-9]/g, '_')}`;
		await db.insert(user).values({ id, name, email, emailVerified: true, role: 'parent' });
		await db.insert(profile).values({ userId: id, phone: '+263773000099', consentAt: now });
		await db.insert(account).values({
			id: `acc_${id}`,
			userId: id,
			accountId: id,
			providerId: 'credential',
			password: hash
		});
		logins.push({ role: 'parent', name, email });
		return id;
	};

	const chipo = await idOf('chipo@example.com');
	const tendai = await idOf('tendai@example.com');
	const grace = await idOf('grace@example.com');
	const tatenda = await idOf('tatenda@example.com');
	const rudo = await idOf('rudo@example.com');
	const kuda = await idOf('kuda@example.com');

	// 2. Mrs Zulu's children: Anesu gets her own login; Tafara is a younger child with a username.
	const kids = await db
		.select({ name: child.name, studentId: child.studentId })
		.from(child)
		.where(eq(child.parentId, grace))
		.orderBy(asc(child.id));
	const anesu = kids.find((k) => k.name.startsWith('Anesu'))?.studentId;
	const tafara = kids.find((k) => k.name.startsWith('Tafara'))?.studentId;
	if (anesu) await login(anesu, 'anesu@example.com', 'Anesu Zulu (child of Mrs Zulu)');
	if (tafara)
		await login(
			tafara,
			'tafara.zulu@kids.tutora.invalid',
			'Tafara Zulu (younger child: log in with the username)',
			'tafara.zulu'
		);

	// 3. Tatenda (under 18) invited Mrs Sibanda, who is her guardian; Rudo (adult) invited
	// Mr Banda but keeps her progress private.
	const sibanda = await parentAccount('Mrs Memory Sibanda', 'sibanda@example.com');
	const banda = await parentAccount('Mr Joseph Banda', 'banda@example.com');
	await redeemInvite(
		db,
		(await createInvite(db, tatenda, now)).code,
		sibanda,
		{ guardianClaim: true },
		now
	);
	await redeemInvite(
		db,
		(await createInvite(db, rudo, now)).code,
		banda,
		{ guardianClaim: false },
		now
	);
	await setSharing(db, rudo, banda, {
		progress: false,
		lessons: true,
		homework: true,
		study: true,
		label: 'Dad'
	});
	// Mrs Sibanda also follows Kuda's cousin? No: she uses Kuda's open code in the walkthrough.
	await db.insert(familyInvite).values({
		studentId: kuda,
		codeHash: await sha256Hex(normalizeInvite(TEST_INVITE_CODE)),
		hint: 'KUD',
		expiresAt: addDays(now, 2)
	});

	// 4. School work, entered by the family and (partly) checked by the tutor.
	await db
		.insert(schoolInfo)
		.values([
			{
				studentId: tatenda,
				school: 'Harare High School (test)',
				year: 'Form 3',
				enteredBy: tatenda
			},
			...(anesu
				? [
						{
							studentId: anesu,
							school: 'Avondale Primary (test)',
							year: 'Grade 7',
							enteredBy: grace
						}
					]
				: [])
		])
		.onConflictDoNothing();
	await db.insert(schoolSubject).values([
		{
			studentId: tatenda,
			subject: 'Mathematics',
			syllabus: 'ZIMSEC O Level',
			textbook: 'New General Mathematics 3 (test)',
			currentTopic: 'Fractions and ratio',
			enteredBy: tatenda,
			checkedBy: chipo,
			checkedAt: addDays(now, -2)
		},
		{
			studentId: tatenda,
			subject: 'Physics',
			syllabus: 'ZIMSEC O Level',
			currentTopic: 'Forces',
			enteredBy: sibanda
		}
	]);

	// 5. Study plans, sessions (streaks) and check-ins.
	const { weekday } = local(now);
	const plan = async (
		studentId: string,
		days: number[],
		hhmm: number,
		minutes: number,
		subject: string,
		topic: string
	) => {
		for (const d of days)
			await db.insert(studyPlanItem).values({
				studentId,
				weekday: d,
				startMinute: hhmm,
				minutes,
				subject,
				topic,
				createdBy: studentId
			});
	};
	await plan(tatenda, [1, 2, 3, 4, 5], 16 * 60, 45, 'Mathematics', 'Fractions');
	await plan(tatenda, [2, 4], 18 * 60 + 30, 30, 'Physics', 'Forces');
	await plan(tatenda, [0, 6], 10 * 60, 40, 'Mathematics', 'Equations');
	await plan(tatenda, [weekday], 15 * 60 + 30, 30, 'English', 'Reading');
	if (anesu) await plan(anesu, [1, 3, 5], 15 * 60, 20, 'English', 'Reading');
	const session = async (
		studentId: string,
		daysAgo: number,
		subject: string,
		topic: string,
		minutes: number
	) => {
		const start = fromLocal(localDate(addDays(now, -daysAgo)), 16 * 60);
		await db.insert(studySession).values({
			studentId,
			subject,
			topic,
			plannedMinutes: minutes,
			startedAt: start,
			endedAt: addMinutes(start, minutes),
			status: 'done'
		});
	};
	for (const d of [1, 2, 3]) await session(tatenda, d, 'Mathematics', 'Fractions', 45);
	await session(tatenda, 5, 'Physics', 'Forces', 30);
	if (anesu) for (const d of [1, 2, 3, 4]) await session(anesu, d, 'English', 'Reading', 20);
	// a week of check-ins (fake): how each day started and, on some days, how it ended
	const ckDay = (daysAgo: number, minute: number) =>
		fromLocal(localDate(addDays(now, -daysAgo)), minute);
	const week: [number, CheckinMood, CheckinMood | null, boolean][] = [
		[6, 'motivated', 'confident', true],
		[5, 'need_break', null, false],
		[4, 'finding_hard', 'motivated', true],
		[3, 'need_break', 'need_break', false],
		[2, 'finding_hard', 'confident', true],
		[1, 'finding_hard', null, true]
	];
	for (const [ago, startMood, endMood, shared] of week) {
		const [st] = await db
			.insert(checkin)
			.values({
				studentId: tatenda,
				mood: startMood,
				subject: 'Mathematics',
				sharedWithFamily: shared,
				note: ago === 3 ? 'Tired after sports (private test note)' : null,
				createdAt: ckDay(ago, 9 * 60)
			})
			.returning({ id: checkin.id });
		if (endMood)
			await db.insert(checkin).values({
				studentId: tatenda,
				mood: endMood,
				subject: 'Mathematics',
				sharedWithFamily: shared,
				kind: 'followup',
				followupOf: st.id,
				createdAt: ckDay(ago, 18 * 60)
			});
	}
	if (anesu)
		await db.insert(checkin).values({
			studentId: anesu,
			mood: 'motivated',
			sharedWithFamily: true,
			createdAt: addDays(now, -1)
		});

	// 6. Results (tests, daily checks, homework) and an exam.
	const result = (
		studentId: string,
		tutorId: string | null,
		source: 'test' | 'daily_check' | 'homework' | 'quiz',
		title: string,
		subject: string,
		topic: string,
		score: number,
		max: number,
		daysAgo: number,
		feedback?: string
	) =>
		recordResult(db, {
			studentId,
			tutorId,
			source,
			title,
			subject,
			topic,
			score,
			maxScore: max,
			takenOn: localDate(addDays(now, -daysAgo)),
			feedback: feedback ?? null,
			createdBy: tutorId
		});
	await result(
		tatenda,
		chipo,
		'test',
		'Geometry test',
		'Mathematics',
		'Geometry',
		17,
		20,
		6,
		'Good use of angle rules. Label your diagrams.'
	);
	await result(tatenda, chipo, 'quiz', 'Equations quiz', 'Mathematics', 'Equations', 7, 10, 4);
	await result(
		tatenda,
		chipo,
		'homework',
		'Equations worksheet',
		'Mathematics',
		'Equations',
		6,
		10,
		9
	);
	await result(
		tatenda,
		null,
		'daily_check',
		'Daily knowledge check',
		'Mathematics',
		'Fractions',
		2,
		5,
		3
	);
	await result(
		tatenda,
		null,
		'daily_check',
		'Daily knowledge check',
		'Mathematics',
		'Fractions',
		2,
		5,
		2
	);
	await result(
		tatenda,
		chipo,
		'test',
		'Fractions test',
		'Mathematics',
		'Fractions',
		9,
		20,
		1,
		'Common denominators first. We will practise this on Tuesday.'
	);
	await result(tatenda, chipo, 'test', 'Term test', 'Mathematics', 'Equations', 10, 20, 40);
	await addExam(db, tatenda, chipo, {
		subject: 'Mathematics',
		title: 'Mid-year Mathematics',
		examOn: localDate(addDays(now, 21)),
		topics: ['Fractions', 'Equations', 'Geometry']
	});
	if (anesu) {
		await result(
			anesu,
			tendai,
			'test',
			'Reading comprehension',
			'English Language',
			'Comprehension',
			8,
			10,
			5
		);
		await result(
			anesu,
			null,
			'daily_check',
			'Daily knowledge check',
			'English Language',
			'Spelling',
			3,
			3,
			1
		);
	}

	// 7. Chipo's quizzes (used by daily knowledge checks) and one quiz set for Tatenda.
	const [fr] = await db
		.insert(questionSet)
		.values({
			tutorId: chipo,
			kind: 'quiz',
			title: 'Fractions basics',
			subject: 'Mathematics',
			topic: 'Fractions',
			level: 'Form 3'
		})
		.returning();
	await db.insert(question).values([
		{
			setId: fr.id,
			prompt: 'What is 1/2 + 1/4?',
			choices: ['2/6', '3/4', '1/6', '2/4'],
			answer: 1,
			explanation: 'Make the bottoms the same: 2/4 + 1/4 = 3/4.',
			sortOrder: 1
		},
		{
			setId: fr.id,
			prompt: 'Simplify 6/8.',
			choices: ['3/4', '2/3', '6/8', '1/2'],
			answer: 0,
			explanation: 'Divide top and bottom by 2.',
			sortOrder: 2
		},
		{
			setId: fr.id,
			prompt: 'What is 2/3 of 12?',
			choices: ['6', '8', '9', '4'],
			answer: 1,
			explanation: '12 ÷ 3 = 4, and 4 × 2 = 8.',
			sortOrder: 3
		},
		{
			setId: fr.id,
			prompt: 'Which is bigger: 3/5 or 2/3?',
			choices: ['3/5', '2/3', 'They are equal'],
			answer: 1,
			explanation: '3/5 = 9/15 and 2/3 = 10/15.',
			sortOrder: 4
		}
	]);
	const [eq1] = await db
		.insert(questionSet)
		.values({
			tutorId: chipo,
			kind: 'quiz',
			title: 'Equations warm-up',
			subject: 'Mathematics',
			topic: 'Equations',
			level: 'Form 3'
		})
		.returning();
	await db.insert(question).values([
		{
			setId: eq1.id,
			prompt: 'Solve x + 5 = 12.',
			choices: ['5', '7', '17', '12'],
			answer: 1,
			explanation: 'Take 5 from both sides.',
			sortOrder: 1
		},
		{
			setId: eq1.id,
			prompt: 'Solve 3x = 18.',
			choices: ['6', '15', '21', '3'],
			answer: 0,
			explanation: 'Divide both sides by 3.',
			sortOrder: 2
		},
		{
			setId: eq1.id,
			prompt: 'Solve 2x − 4 = 10.',
			choices: ['3', '5', '7', '12'],
			answer: 2,
			explanation: 'Add 4, then divide by 2.',
			sortOrder: 3
		}
	]);
	await db
		.insert(quizAssignment)
		.values({ setId: eq1.id, studentId: tatenda, dueOn: localDate(addDays(now, 3)) });

	// 8. Homework topics, lesson materials, revision resources and a note after a lesson.
	await db
		.update(homework)
		.set({ subject: 'Mathematics', topic: 'Fractions' })
		.where(and(eq(homework.userId, tatenda), eq(homework.tutorId, chipo)));
	const places = await db
		.select({
			attendeeId: attendee.id,
			lessonId: lesson.id,
			startsAt: lesson.startsAt,
			tutorId: lesson.tutorId
		})
		.from(attendee)
		.innerJoin(lesson, eq(lesson.id, attendee.lessonId))
		.where(and(eq(attendee.userId, tatenda), eq(lesson.tutorId, chipo)))
		.orderBy(asc(lesson.startsAt));
	const next = places.find((p) => p.startsAt > now);
	if (next)
		await db.insert(lessonMaterial).values([
			{
				lessonId: next.lessonId,
				tutorId: chipo,
				kind: 'link',
				title: 'Fractions practice sheet (test link)',
				url: 'https://example.com/fractions-sheet'
			},
			{
				lessonId: next.lessonId,
				tutorId: chipo,
				kind: 'kahoot',
				title: 'Warm-up quiz · 8 questions (test)',
				url: 'https://kahoot.it/'
			}
		]);
	const last = [...places].reverse().find((p) => p.startsAt < now);
	if (last)
		await db
			.insert(lessonFeedback)
			.values({
				attendeeId: last.attendeeId,
				text: 'We practised adding fractions with different denominators. Next: mixed numbers. (test note)'
			})
			.onConflictDoNothing();
	await db.insert(resource).values([
		{
			tutorId: chipo,
			subject: 'Mathematics',
			level: 'Form 3',
			kind: 'link',
			title: 'Fractions summary notes (test)',
			url: 'https://example.com/fractions-notes'
		},
		{
			tutorId: chipo,
			subject: 'Mathematics',
			level: 'Form 3',
			kind: 'link',
			title: 'Past paper, June 2025 (test)',
			url: 'https://example.com/past-paper'
		}
	]);

	// make sure the converted children are on their tutors' lists with a level
	const converted = kids.map((k) => k.studentId).filter((x): x is string => !!x);
	if (converted.length)
		await db
			.update(enrollment)
			.set({ level: 'Grade 7' })
			.where(and(inArray(enrollment.userId, converted), gt(enrollment.createdAt, new Date(0))));

	// Study Buddies (fake): Tatenda and Kuda are buddies through a one-time code; both profiles are
	// checked. Kuda's new bio is waiting in the owner's profile-check queue.
	const born = (yearsAgo: number) => `${now.getUTCFullYear() - yearsAgo}-03-04`;
	await saveCard(
		db,
		tatenda,
		{
			displayName: 'Tatenda M.',
			bio: 'Form 3. I love fractions now (honestly). Aiming for an A in maths.',
			grade: 'Form 3',
			school: 'Test High School',
			subjects: ['Mathematics', 'Physics', 'English'],
			favouriteSubject: 'Mathematics',
			goals: 'Get 70% or more in the end-of-term maths test',
			birthDate: born(15)
		},
		now
	);
	await moderate(db, tatenda, 'bio', true);
	await saveCard(
		db,
		kuda,
		{
			displayName: 'Kuda C.',
			bio: '',
			grade: 'Form 2',
			school: 'Test College',
			subjects: ['Mathematics', 'Geography'],
			favouriteSubject: 'Geography',
			goals: '',
			birthDate: born(14)
		},
		now
	);
	const bc = await myCode(db, tatenda, now);
	await connectByCode(db, kuda, bc.code, { me: 'Kuda C.', other: 'Tatenda M.' }, now);
	await sendPreset(db, kuda, tatenda, 'good_luck', now);
	await saveCard(
		db,
		kuda,
		{
			displayName: 'Kuda C.',
			bio: 'Geography fan. Revising maths every evening.',
			grade: 'Form 2',
			school: 'Test College',
			subjects: ['Mathematics', 'Geography'],
			favouriteSubject: 'Geography',
			goals: '',
			birthDate: born(14)
		},
		now
	);

	// Messages (fake): Tatenda and her maths tutor; the last one from the tutor is unread.
	const tm = { tutorId: chipo, studentId: tatenda };
	await sendMessage(db, tatenda, tm, 'Hi! Can we go over fractions again on Thursday?');
	await sendMessage(db, chipo, tm, 'Of course. Try questions 1 to 5 of the worksheet first.');
	await sendMessage(db, tatenda, tm, 'Done, number 4 was hard.');
	await sendMessage(db, chipo, tm, 'Great! Let me know if you need help.');
	return { invite: TEST_INVITE_CODE };
}
