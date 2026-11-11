// TEST database only: Neon's "schema only" copy has the tables but not the record of which
// migrations ran, so migrating would fail. In that case start from an empty database
// (the test data is fake and is loaded again right after).
// Env: DATABASE_URL (the TEST branch), TEST_SITE=1.
import pg from 'pg';

async function main() {
	if (process.env.TEST_SITE !== '1') throw new Error('Refusing: TEST_SITE=1 is not set');
	const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
	await c.connect();
	try {
		const hasTables = (await c.query(`select to_regclass('public."user"') as t`)).rows[0].t;
		let ran = 0;
		try {
			ran = Number(
				(await c.query('select count(*)::int as n from drizzle.__drizzle_migrations')).rows[0].n
			);
		} catch {
			ran = 0;
		}
		if (hasTables && ran === 0) {
			console.log('Test database has tables but no migration record: starting it empty.');
			await c.query('drop schema if exists drizzle cascade');
			await c.query('drop schema public cascade');
			await c.query('create schema public');
		} else {
			console.log('Test database is fine.');
		}
	} finally {
		await c.end();
	}
}

main().catch((e) => {
	console.log(`::error::Test schema check failed (${e?.code ?? e?.name ?? 'error'}).`);
	process.exit(1);
});
