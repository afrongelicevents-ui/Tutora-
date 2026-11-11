import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { requireUser } from '#lib/server/guards.ts';
import { hitLimit } from '#lib/server/rate-limit.ts';
import {
	admit,
	leave,
	MAX_SIGNAL_BYTES,
	poll,
	roomAccess,
	roomFiles,
	sendSignal
} from '#lib/server/room.ts';
import { fileLink } from '#lib/server/storage.ts';

const body = z.discriminatedUnion('op', [
	z.object({ op: z.literal('poll'), after: z.number().int().min(0) }),
	z.object({
		op: z.literal('send'),
		to: z.string().min(1).max(100),
		kind: z.enum(['offer', 'answer', 'ice', 'bye']),
		payload: z.string().max(MAX_SIGNAL_BYTES)
	}),
	z.object({ op: z.literal('admit'), userId: z.string().min(1).max(100) }),
	z.object({ op: z.literal('leave') })
]);

/** Lesson-room messages. Same-origin JSON only; every call re-checks who may use this room. */
export const POST: RequestHandler = async ({ locals, url, params, request }) => {
	const u = requireUser(locals.user, url);
	if (!request.headers.get('content-type')?.startsWith('application/json')) error(415, 'JSON only');
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) error(403, 'Forbidden');
	const id = Number(params.id) || 0;
	const access = await roomAccess(locals.db, u, id);
	if (!access) error(404, 'Room closed');
	const raw = await request.text();
	if (raw.length > MAX_SIGNAL_BYTES + 500) error(413, 'Too big');
	let parsed;
	try {
		parsed = body.safeParse(JSON.parse(raw));
	} catch {
		error(400, 'Bad request');
	}
	if (!parsed.success) error(400, 'Bad request');
	const b = parsed.data;
	switch (b.op) {
		case 'poll': {
			const r = await poll(locals.db, id, u.id, b.after);
			const files = r.admitted ? await roomFiles(locals.db, id) : [];
			return json({
				...r,
				files: await Promise.all(
					files.map(async (f) => ({
						id: f.id,
						name: f.fileName,
						url: await fileLink(f.fileKey, f.fileName)
					}))
				)
			});
		}
		case 'send':
			if (!(await hitLimit(locals.db, 'signal', `${id}:${u.id}`)).ok)
				error(429, 'Too many messages');
			return json({ ok: await sendSignal(locals.db, id, u.id, b.to, b.kind, b.payload) });
		case 'admit':
			if (access.role !== 'tutor') error(403, 'Only the tutor can let people in');
			await admit(locals.db, id, b.userId);
			return json({ ok: true });
		case 'leave':
			await leave(locals.db, id, u.id);
			return json({ ok: true });
	}
};
