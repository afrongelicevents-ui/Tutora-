import { and, asc, eq, gt, inArray, lt } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { lesson, roomFile, roomParticipant, roomSignal } from './db/app.schema.ts';
import { user } from './db/auth.schema.ts';
import { isAttendee } from './bookings.ts';

/** The room opens 30 minutes before the lesson and closes 2 hours after it ends. */
export const OPEN_BEFORE_MIN = 30;
export const CLOSE_AFTER_MIN = 120;
export const MAX_SIGNAL_BYTES = 16_000;
/** A participant counts as present if they polled in the last 30 seconds. */
const PRESENT_MS = 30_000;

export type RoomRole = 'tutor' | 'student';

export interface RoomAccess {
	lesson: typeof lesson.$inferSelect;
	role: RoomRole;
}

/** Who may use this room: the tutor, and students booked on this lesson. */
export async function roomAccess(
	db: DB,
	me: { id: string; role: string },
	lessonId: number,
	now = new Date()
): Promise<RoomAccess | null> {
	const [l] = await db.select().from(lesson).where(eq(lesson.id, lessonId));
	if (!l || l.status !== 'scheduled' || l.mode !== 'online') return null;
	const open = new Date(l.startsAt.getTime() - OPEN_BEFORE_MIN * 60_000);
	const close = new Date(l.endsAt.getTime() + CLOSE_AFTER_MIN * 60_000);
	if (now < open || now > close) return null;
	if (me.role === 'tutor') return { lesson: l, role: 'tutor' };
	if (await isAttendee(db, me.id, lessonId)) return { lesson: l, role: 'student' };
	return null;
}

/** Tutor is let in automatically; students wait until the tutor admits them. */
export async function enter(db: DB, access: RoomAccess, userId: string, now = new Date()) {
	const status = access.role === 'tutor' ? 'admitted' : 'waiting';
	await db
		.insert(roomParticipant)
		.values({ lessonId: access.lesson.id, userId, status, lastSeen: now })
		.onConflictDoUpdate({
			target: [roomParticipant.lessonId, roomParticipant.userId],
			// someone who was already admitted stays admitted when they reconnect
			set: { lastSeen: now, status: access.role === 'tutor' ? 'admitted' : roomParticipant.status }
		});
	const [p] = await db
		.select()
		.from(roomParticipant)
		.where(and(eq(roomParticipant.lessonId, access.lesson.id), eq(roomParticipant.userId, userId)));
	if (p.status === 'left') {
		await db
			.update(roomParticipant)
			.set({ status: access.role === 'tutor' ? 'admitted' : 'waiting' })
			.where(
				and(eq(roomParticipant.lessonId, access.lesson.id), eq(roomParticipant.userId, userId))
			);
	}
}

export async function admit(db: DB, lessonId: number, userId: string) {
	await db
		.update(roomParticipant)
		.set({ status: 'admitted' })
		.where(
			and(
				eq(roomParticipant.lessonId, lessonId),
				eq(roomParticipant.userId, userId),
				eq(roomParticipant.status, 'waiting')
			)
		);
}

export async function leave(db: DB, lessonId: number, userId: string) {
	await db
		.update(roomParticipant)
		.set({ status: 'left' })
		.where(and(eq(roomParticipant.lessonId, lessonId), eq(roomParticipant.userId, userId)));
}

export async function participants(db: DB, lessonId: number, now = new Date()) {
	const rows = await db
		.select({
			userId: roomParticipant.userId,
			name: user.name,
			role: user.role,
			status: roomParticipant.status,
			lastSeen: roomParticipant.lastSeen
		})
		.from(roomParticipant)
		.innerJoin(user, eq(user.id, roomParticipant.userId))
		.where(eq(roomParticipant.lessonId, lessonId));
	return rows
		.filter((r) => r.status !== 'left' && now.getTime() - r.lastSeen.getTime() < PRESENT_MS)
		.map((r) => ({
			userId: r.userId,
			name: r.name.split(/\s+/)[0],
			isTutor: r.role === 'tutor',
			status: r.status
		}));
}

async function isAdmitted(db: DB, lessonId: number, userId: string) {
	const [p] = await db
		.select({ status: roomParticipant.status })
		.from(roomParticipant)
		.where(and(eq(roomParticipant.lessonId, lessonId), eq(roomParticipant.userId, userId)));
	return p?.status === 'admitted';
}

/** Pass a WebRTC set-up message to another admitted person in the same lesson. */
export async function sendSignal(
	db: DB,
	lessonId: number,
	from: string,
	to: string,
	kind: 'offer' | 'answer' | 'ice' | 'bye',
	payload: string
) {
	if (payload.length > MAX_SIGNAL_BYTES) return false;
	if (!(await isAdmitted(db, lessonId, from)) || !(await isAdmitted(db, lessonId, to)))
		return false;
	await db.insert(roomSignal).values({ lessonId, fromUser: from, toUser: to, kind, payload });
	return true;
}

/** Messages for me since `afterId`, plus who is in the room. Also marks me as present. */
export async function poll(
	db: DB,
	lessonId: number,
	me: string,
	afterId: number,
	now = new Date()
) {
	await db
		.update(roomParticipant)
		.set({ lastSeen: now })
		.where(and(eq(roomParticipant.lessonId, lessonId), eq(roomParticipant.userId, me)));
	const admitted = await isAdmitted(db, lessonId, me);
	const signals = admitted
		? await db
				.select({
					id: roomSignal.id,
					from: roomSignal.fromUser,
					kind: roomSignal.kind,
					payload: roomSignal.payload
				})
				.from(roomSignal)
				.where(
					and(
						eq(roomSignal.lessonId, lessonId),
						eq(roomSignal.toUser, me),
						gt(roomSignal.id, afterId)
					)
				)
				.orderBy(asc(roomSignal.id))
				.limit(100)
		: [];
	return { admitted, signals, people: await participants(db, lessonId, now) };
}

export async function addRoomFile(
	db: DB,
	v: { lessonId: number; userId: string; fileKey: string; fileName: string }
) {
	const [row] = await db.insert(roomFile).values(v).returning();
	return row;
}

export const roomFiles = (db: DB, lessonId: number) =>
	db
		.select()
		.from(roomFile)
		.where(eq(roomFile.lessonId, lessonId))
		.orderBy(asc(roomFile.createdAt));

/** Delete set-up messages for lessons that ended more than a day ago. */
export async function cleanupSignals(db: DB, now = new Date()) {
	const old = await db
		.select({ id: lesson.id })
		.from(lesson)
		.where(lt(lesson.endsAt, new Date(now.getTime() - 86_400_000)));
	if (old.length)
		await db.delete(roomSignal).where(
			inArray(
				roomSignal.lessonId,
				old.map((l) => l.id)
			)
		);
}
