// Used only by `pnpm auth:schema` to generate the Drizzle schema for Better Auth tables.
import { drizzle } from 'drizzle-orm/node-postgres';
import { createAuth } from '../src/lib/server/auth-config';
import type { DB } from '../src/lib/server/db/types';

export const auth = createAuth({
	db: drizzle.mock() as unknown as DB,
	baseURL: 'http://localhost:5173',
	secret: 'x'.repeat(32),
	tutorEmail: 'tutor@example.com',
	sendEmail: async () => {}
});
