import type { RequestHandler } from './$types';
import { requireUser } from '#lib/server/guards.ts';
import { exportMyData } from '#lib/server/student.ts';
import { localDate } from '#lib/tz.ts';

/** "Download my data": everything Tutora holds about me, as a JSON file. */
export const GET: RequestHandler = async ({ locals, url }) => {
	const u = requireUser(locals.user, url);
	const data = await exportMyData(locals.db, u.id);
	return new Response(JSON.stringify(data, null, 2), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="tutora-my-data-${localDate(new Date())}.json"`,
			'cache-control': 'private, no-store'
		}
	});
};
