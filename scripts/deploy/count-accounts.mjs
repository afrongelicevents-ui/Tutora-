// Prints COUNTS ONLY (never names, emails or ids) so the deploy log shows that the v3
// migration kept every account: run once before and once after `pnpm db:migrate`.
// Usage: node scripts/deploy/count-accounts.mjs before|after   Env: DATABASE_URL
import pg from 'pg';

const stage = process.argv[2] || 'now';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const one = async (sql) => {
	try {
		return Number((await c.query(sql)).rows[0].n);
	} catch {
		return 'n/a'; // table does not exist yet (before the migration)
	}
};
try {
	const counts = {
		users: await one('select count(*)::int as n from "user"'),
		parents: await one(`select count(*)::int as n from "user" where role = 'parent'`),
		students: await one(`select count(*)::int as n from "user" where role = 'student'`),
		tutors: await one(`select count(*)::int as n from "user" where role = 'tutor'`),
		children: await one('select count(*)::int as n from "child"'),
		children_with_student_account: await one(
			'select count(*)::int as n from "child" where student_id is not null'
		),
		family_links: await one('select count(*)::int as n from "family_link"'),
		bookings: await one('select count(*)::int as n from "booking"'),
		lessons: await one('select count(*)::int as n from "lesson"'),
		payments: await one('select count(*)::int as n from "payment"')
	};
	console.log(`Account counts ${stage}: ${JSON.stringify(counts)}`);
} finally {
	await c.end();
}
