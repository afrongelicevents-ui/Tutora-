import { eq } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { user } from './db/auth.schema.ts';
import { sendEmail } from './auth.ts';

/** Email someone about their booking/payment. Never fails the action if email is down. */
export async function notifyUser(db: DB, userId: string, subject: string, body: string) {
	try {
		const [u] = await db
			.select({ email: user.email, name: user.name })
			.from(user)
			.where(eq(user.id, userId));
		if (!u) return;
		await sendEmail({ to: u.email, subject, text: `Hello ${u.name},\n\n${body}\n\nTutora` });
	} catch (e) {
		console.error('notifyUser failed', e);
	}
}

/** Email the tutor (their contact email, or their login email). */
export async function notifyTutor(db: DB, subject: string, body: string) {
	try {
		const [t] = await db
			.select({ email: user.email })
			.from(user)
			.where(eq(user.role, 'tutor'))
			.limit(1);
		if (!t) return;
		await sendEmail({ to: t.email, subject, text: `${body}\n\nTutora` });
	} catch (e) {
		console.error('notifyTutor failed', e);
	}
}
