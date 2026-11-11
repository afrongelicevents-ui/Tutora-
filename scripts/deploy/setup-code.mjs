// Makes the one-time code the owner needs to create the tutor account at /setup.
// Only its SHA-256 fingerprint goes into the database. The code itself is printed ENCRYPTED
// with setup-code.pub.pem, so the public logs reveal nothing; only the holder of the private
// key (the person deploying) can read it.
// Env: DATABASE_URL (required), NEW_SETUP_CODE=true to replace a code that hasn't been used yet.
import { createHash, publicEncrypt, randomInt, constants } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const DAYS = 14;
const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

async function main() {
	const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
	await client.connect();
	try {
		const tutor = await client.query(`select 1 from "user" where role = 'tutor' limit 1`);
		if (tutor.rowCount) {
			console.log('The tutor account already exists: no setup code needed.');
			return;
		}
		const existing = await client.query(
			`select 1 from setup_code where id = 1 and expires_at > now()`
		);
		if (existing.rowCount && process.env.NEW_SETUP_CODE !== 'true') {
			console.log('A setup code is already waiting to be used: keeping it.');
			return;
		}
		const raw = Array.from({ length: 12 }, () => abc[randomInt(abc.length)]).join('');
		const code = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
		const hash = createHash('sha256').update(raw).digest('hex');
		await client.query(
			`insert into setup_code (id, code_hash, expires_at) values (1, $1, now() + ($2 || ' days')::interval)
			 on conflict (id) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at, created_at = now()`,
			[hash, String(DAYS)]
		);
		const key = readFileSync(new URL('./setup-code.pub.pem', import.meta.url));
		const sealed = publicEncrypt(
			{ key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
			Buffer.from(code)
		).toString('base64');
		console.log(`New setup code made (valid ${DAYS} days, works once).`);
		console.log(`SETUP_CODE_SEALED=${sealed}`);
	} finally {
		await client.end();
	}
}

main().catch((e) => {
	console.log(`::error::Setup code: ${e.message}`);
	process.exit(1);
});
