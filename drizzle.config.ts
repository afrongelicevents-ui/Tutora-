import { defineConfig } from 'drizzle-kit';

// Neon's copy button may add `channel_binding=require`; not every driver understands it.
function dbUrl(raw = '') {
	try {
		const u = new URL(raw);
		u.searchParams.delete('channel_binding');
		return u.toString();
	} catch {
		return raw;
	}
}

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: { url: dbUrl(process.env.DATABASE_URL) },
	verbose: true,
	strict: true
});
