import { eq } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { fileBlob } from './db/app.schema.ts';
import type { FileStore } from './files.ts';

/** Files kept in the Postgres database (no separate storage account needed). */
export class DbStore implements FileStore {
	constructor(private db: DB) {}
	async put(key: string, body: Uint8Array, contentType: string) {
		await this.db
			.insert(fileBlob)
			.values({ key, contentType, data: body })
			.onConflictDoUpdate({ target: fileBlob.key, set: { contentType, data: body } });
	}
	async get(key: string) {
		const [row] = await this.db.select().from(fileBlob).where(eq(fileBlob.key, key));
		return row ? { body: row.data, contentType: row.contentType } : null;
	}
	async delete(key: string) {
		await this.db.delete(fileBlob).where(eq(fileBlob.key, key));
	}
}
