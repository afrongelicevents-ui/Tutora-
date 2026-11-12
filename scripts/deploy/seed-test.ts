// Fills the TEST database with fake data from the deploy job (fallback when the test website
// itself cannot do it). Refuses to run unless TEST_SITE=1 is set explicitly.
// Env: DATABASE_URL (the TEST branch), BETTER_AUTH_SECRET, TEST_PASSWORD, TEST_SITE=1, IF_EMPTY=1.
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, notLike } from 'drizzle-orm';
import pg from 'pg';
import * as schema from '../../src/lib/server/db/schema.ts';
import type { DB } from '../../src/lib/server/db/types.ts';
import { createAuth } from '../../src/lib/server/auth-config.ts';
import { seedTestData } from '../../src/lib/server/seed.ts';

async function main() {
	if (process.env.TEST_SITE !== '1') throw new Error('Refusing: TEST_SITE=1 is not set');
	const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
	const db = drizzle(pool, { schema }) as unknown as DB;
	try {
		if (process.env.IF_EMPTY === '1') {
			// keep earlier fake data only if it is ALL fake (our test owner, and no address outside
			// example.com); anything else, e.g. a copy of live data, is wiped
			const [seeded] = await db
				.select({ id: schema.user.id })
				.from(schema.user)
				.where(eq(schema.user.id, 'test_owner_example_com'));
			const [real] = await db
				.select({ id: schema.user.id })
				.from(schema.user)
				.where(notLike(schema.user.email, '%@example.com'))
				.limit(1);
			// v3 fake data (Family Connection etc.) is there too? Otherwise refill the fake data.
			const [v3] = await db
				.select({ id: schema.user.id })
				.from(schema.user)
				.where(eq(schema.user.id, 'test_sibanda'));
			// Study Buddies fake data is there too?
			const [buddies] = await db
				.select({ id: schema.studentCard.userId })
				.from(schema.studentCard)
				.limit(1);
			if (seeded && !real && v3 && buddies) {
				console.log('Test data already there: kept.');
				return;
			}
		}
		const auth = createAuth({
			db,
			secret: process.env.BETTER_AUTH_SECRET ?? 'x'.repeat(32),
			sendEmail: async () => {},
			emailEnabled: false,
			transactions: true
		});
		const logins = await seedTestData(db, auth, {
			testSite: true,
			password: process.env.TEST_PASSWORD
		});
		console.log(`Test data made: ${logins.length} logins.`);
	} finally {
		await pool.end();
	}
}

main().catch((e) => {
	// never print the error text: it can contain query values (logs are public)
	const code = (e as { cause?: { code?: string } })?.cause?.code ?? (e as Error)?.name ?? 'error';
	console.log(`::error::Test seed failed (${code}).`);
	process.exit(1);
});
