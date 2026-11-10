import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type * as schema from './schema';

/** Works for both neon-http (production) and node-postgres (dev and tests). */
export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;
