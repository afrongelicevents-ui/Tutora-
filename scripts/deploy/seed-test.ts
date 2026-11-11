// Fills the TEST database with fake data from the deploy job (fallback when the test website
// itself cannot do it). Refuses to run unless TEST_SITE=1 is set explicitly.
// Env: DATABASE_URL (the TEST branch), BETTER_AUTH_SECRET, TEST_SITE=1, IF_EMPTY=1 (optional).
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
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
			const [owner] = await db
				.select({ id: schema.user.id })
				.from(schema.user)
				.where(eq(schema.user.role, 'owner'));
			if (owner) {
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
		const logins = await seedTestData(db, auth, { testSite: true });
		console.log(`Test data made: ${logins.length} logins.`);
	} finally {
		await pool.end();
	}
}

main().catch((e) => {
	console.log(`::error::Test seed: ${e.message}`);
	process.exit(1);
});
