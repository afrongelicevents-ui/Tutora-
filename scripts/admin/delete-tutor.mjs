// Permanently deletes ONE tutor and everything linked to them, in one transaction.
// Run only by the owner, on purpose, from GitHub: Actions → "Delete a tutor" → Run workflow.
// The logs show counts only (never names, emails or ids): the repository is public.
//
// Env: DATABASE_URL, SLUG (the tutor's page address, e.g. mr-n-chidya),
//      CONFIRM (must equal SLUG), DRY_RUN=1 to count without deleting.
import pg from 'pg';

const slug = (process.env.SLUG ?? '').trim().toLowerCase();
const dry = process.env.DRY_RUN === '1';
if (!slug || process.env.CONFIRM?.trim().toLowerCase() !== slug) {
	console.log('::error::Type the tutor page address twice (SLUG and CONFIRM must match).');
	process.exit(1);
}

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const count = async (sql, args) => Number((await c.query(sql, args)).rows[0].n);

/** Every column that points at a user, so nothing linked to the tutor is missed. */
async function userColumns() {
	const r = await c.query(`
		select tc.table_name as t, kcu.column_name as col, rc.delete_rule as rule
		from information_schema.table_constraints tc
		join information_schema.key_column_usage kcu
			on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
		join information_schema.constraint_column_usage ccu
			on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
		join information_schema.referential_constraints rc
			on rc.constraint_name = tc.constraint_name and rc.constraint_schema = tc.table_schema
		where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
			and ccu.table_name = 'user' and ccu.column_name = 'id'
		order by 1, 2`);
	return r.rows;
}

async function linkedCounts(id, cols) {
	const out = {};
	for (const { t, col } of cols) {
		const n = await count(`select count(*)::int as n from "${t}" where "${col}" = $1`, [id]);
		if (n) out[`${t}.${col}`] = n;
	}
	return out;
}

try {
	const found = await c.query(
		`select p.tutor_id as id, p.tutor_name as name, u.role
		 from tutor_profile p join "user" u on u.id = p.tutor_id
		 where lower(p.slug) = $1`,
		[slug]
	);
	if (found.rowCount !== 1) {
		console.log(`::error::No tutor page "${slug}" found. Nothing was deleted.`);
		process.exit(1);
	}
	const { id, name, role } = found.rows[0];
	if (role !== 'tutor') {
		console.log('::error::That page does not belong to a tutor account. Nothing was deleted.');
		process.exit(1);
	}
	const cols = await userColumns();
	const before = await linkedCounts(id, cols);
	// records that stay after a cascade but are about this tutor
	const extra = {
		marks_he_gave: await count(
			`select count(*)::int as n from assessment_result where tutor_id = $1`,
			[id]
		),
		help_requests: await count(
			`select count(*)::int as n from support_request where user_id = $1`,
			[id]
		),
		notifications_naming_tutor: await count(
			`select count(*)::int as n from notification
			 where user_id <> $1 and ((title || ' ' || body) ilike '%' || $2 || '%'
				or coalesce(link, '') like '/t/' || $3 || '%')`,
			[id, name ?? '\u0000', slug]
		),
		audit_entries: await count(
			`select count(*)::int as n from audit_log
			 where actor_id = $1 or target = $1 or coalesce(detail, '') ilike '%' || $2 || '%'`,
			[id, name ?? '\u0000']
		)
	};
	console.log(`Linked records (counts only): ${JSON.stringify({ ...before, ...extra })}`);
	if (dry) {
		console.log('DRY RUN: nothing was deleted.');
		process.exit(0);
	}

	await c.query('begin');
	await c.query(`delete from assessment_result where tutor_id = $1`, [id]);
	await c.query(`delete from support_request where user_id = $1`, [id]);
	await c.query(
		`delete from notification
		 where user_id <> $1 and ((title || ' ' || body) ilike '%' || $2 || '%'
			or coalesce(link, '') like '/t/' || $3 || '%')`,
		[id, name ?? '\u0000', slug]
	);
	await c.query(
		`delete from audit_log
		 where actor_id = $1 or target = $1 or coalesce(detail, '') ilike '%' || $2 || '%'`,
		[id, name ?? '\u0000']
	);
	// rows whose links to each other don't cascade: remove them in order first
	await c.query(`delete from charge where tutor_id = $1`, [id]);
	await c.query(
		`delete from attendee where lesson_id in (select id from lesson where tutor_id = $1)
			or booking_id in (select id from booking where tutor_id = $1)
			or student_package_id in (select id from student_package where tutor_id = $1)`,
		[id]
	);
	await c.query(`delete from booking where tutor_id = $1`, [id]);
	await c.query(`delete from lesson where tutor_id = $1`, [id]);
	await c.query(`delete from student_package where tutor_id = $1`, [id]);
	// the account itself: its page, subjects, prices, free times, payment details, sessions,
	// bookings, lessons, homework, payments, receipts, reviews, files and links all go with it
	await c.query(`delete from "user" where id = $1`, [id]);

	// check: nothing anywhere still points at the tutor
	const after = await linkedCounts(id, cols);
	const userLeft = await count(`select count(*)::int as n from "user" where id = $1`, [id]);
	const pageLeft = await count(
		`select count(*)::int as n from tutor_profile where lower(slug) = $1`,
		[slug]
	);
	if (userLeft || pageLeft || Object.keys(after).length) {
		await c.query('rollback');
		console.log(
			`::error::Something was still linked (${JSON.stringify(after)}). Rolled back; nothing deleted.`
		);
		process.exit(1);
	}
	await c.query('commit');
	console.log(
		'Deleted: the tutor account and everything linked to it. Nothing points at it any more.'
	);
} catch (e) {
	try {
		await c.query('rollback');
	} catch {
		/* not in a transaction */
	}
	console.log(`::error::Delete failed and was rolled back: ${e.message}`);
	process.exit(1);
} finally {
	await c.end();
}
