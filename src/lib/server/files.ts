/**
 * Private file storage (Cloudflare R2 in production, a local folder in development,
 * memory in tests) with type checking by content, photo metadata removal and
 * short-lived signed links.
 */

export interface StoredFile {
	body: Uint8Array;
	contentType: string;
}

export interface FileStore {
	put(key: string, body: Uint8Array, contentType: string): Promise<void>;
	get(key: string): Promise<StoredFile | null>;
	delete(key: string): Promise<void>;
}

export class MemoryStore implements FileStore {
	files = new Map<string, StoredFile>();
	async put(key: string, body: Uint8Array, contentType: string) {
		this.files.set(key, { body, contentType });
	}
	async get(key: string) {
		return this.files.get(key) ?? null;
	}
	async delete(key: string) {
		this.files.delete(key);
	}
}

export class R2Store implements FileStore {
	constructor(private bucket: R2Bucket) {}
	async put(key: string, body: Uint8Array, contentType: string) {
		await this.bucket.put(key, body, { httpMetadata: { contentType } });
	}
	async get(key: string) {
		const obj = await this.bucket.get(key);
		if (!obj) return null;
		return {
			body: new Uint8Array(await obj.arrayBuffer()),
			contentType: obj.httpMetadata?.contentType ?? 'application/octet-stream'
		};
	}
	async delete(key: string) {
		await this.bucket.delete(key);
	}
}

/** Development only: files in ./.data/files (git-ignored). */
export class LocalStore implements FileStore {
	constructor(private dir = '.data/files') {}
	private async fs() {
		const fs = await import('node:fs/promises');
		const path = await import('node:path');
		return { fs, path };
	}
	async put(key: string, body: Uint8Array, contentType: string) {
		const { fs, path } = await this.fs();
		const p = path.join(this.dir, key);
		await fs.mkdir(path.dirname(p), { recursive: true });
		await fs.writeFile(p, body);
		await fs.writeFile(p + '.type', contentType);
	}
	async get(key: string) {
		const { fs, path } = await this.fs();
		const p = path.join(this.dir, key);
		try {
			return {
				body: new Uint8Array(await fs.readFile(p)),
				contentType: await fs.readFile(p + '.type', 'utf8')
			};
		} catch {
			return null;
		}
	}
	async delete(key: string) {
		const { fs, path } = await this.fs();
		await fs.rm(path.join(this.dir, key), { force: true });
	}
}

/* ---------- content checks ---------- */

export type FileKind = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
export const IMAGE_KINDS: FileKind[] = ['image/jpeg', 'image/png', 'image/webp'];
export const DOC_KINDS: FileKind[] = [...IMAGE_KINDS, 'application/pdf'];
const EXT: Record<FileKind, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'application/pdf': 'pdf'
};

/** Decide the type from the first bytes, never from the file name or browser. */
export function sniff(b: Uint8Array): FileKind | null {
	if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
	if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v))
		return 'image/png';
	if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'image/webp';
	if (b.length >= 5 && ascii(b, 0, 5) === '%PDF-') return 'application/pdf';
	return null;
}

function ascii(b: Uint8Array, at: number, len: number) {
	return String.fromCharCode(...b.subarray(at, at + len));
}

/**
 * Remove hidden data (EXIF location, camera details, comments) from photos.
 * JPEG: drop APP1-APP15 and COM segments. PNG: drop text/EXIF/time chunks.
 * WebP: drop EXIF and XMP chunks.
 */
export function stripMetadata(b: Uint8Array, kind: FileKind): Uint8Array {
	if (kind === 'image/jpeg') return stripJpeg(b);
	if (kind === 'image/png') return stripPng(b);
	if (kind === 'image/webp') return stripWebp(b);
	return b;
}

function stripJpeg(b: Uint8Array): Uint8Array {
	const out: Uint8Array[] = [b.subarray(0, 2)];
	let i = 2;
	while (i + 4 <= b.length) {
		if (b[i] !== 0xff) break;
		const marker = b[i + 1];
		if (marker === 0xda) {
			// start of scan: the rest is image data
			out.push(b.subarray(i));
			return concat(out);
		}
		if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
			out.push(b.subarray(i, i + 2));
			i += 2;
			continue;
		}
		const len = (b[i + 2] << 8) | b[i + 3];
		if (len < 2 || i + 2 + len > b.length) break;
		const drop = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
		if (!drop) out.push(b.subarray(i, i + 2 + len));
		i += 2 + len;
	}
	out.push(b.subarray(i));
	return concat(out);
}

const PNG_DROP = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);
function stripPng(b: Uint8Array): Uint8Array {
	const out: Uint8Array[] = [b.subarray(0, 8)];
	let i = 8;
	while (i + 12 <= b.length) {
		const len = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
		const type = ascii(b, i + 4, 4);
		const end = i + 12 + len;
		if (end > b.length) break;
		if (!PNG_DROP.has(type)) out.push(b.subarray(i, end));
		i = end;
		if (type === 'IEND') break;
	}
	return concat(out);
}

function stripWebp(b: Uint8Array): Uint8Array {
	const chunks: Uint8Array[] = [];
	let i = 12;
	while (i + 8 <= b.length) {
		const type = ascii(b, i, 4);
		const len = b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24);
		const end = i + 8 + len + (len & 1);
		if (end > b.length + 1) break;
		if (type !== 'EXIF' && type !== 'XMP ') {
			const c = b.slice(i, Math.min(end, b.length));
			if (type === 'VP8X') c[8] &= ~(0x08 | 0x04); // clear "has EXIF" and "has XMP" flags
			chunks.push(c);
		}
		i = end;
	}
	const body = concat(chunks);
	const head = new Uint8Array(12);
	head.set(b.subarray(0, 12));
	const size = body.length + 4;
	head[4] = size & 0xff;
	head[5] = (size >> 8) & 0xff;
	head[6] = (size >> 16) & 0xff;
	head[7] = (size >> 24) & 0xff;
	return concat([head, body]);
}

function concat(parts: Uint8Array[]): Uint8Array {
	const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
	let at = 0;
	for (const p of parts) {
		out.set(p, at);
		at += p.length;
	}
	return out;
}

export const MB = 1024 * 1024;

export type UploadResult =
	| { ok: true; bytes: Uint8Array; kind: FileKind; ext: string; name: string }
	| { ok: false; error: 'err_file_missing' | 'err_file_big' | 'err_file_type' };

/** Validate an uploaded file: size, real type, and strip photo metadata. */
export async function readUpload(
	file: unknown,
	opts: { maxBytes: number; allowed: FileKind[]; required?: boolean }
): Promise<UploadResult | null> {
	if (!(file instanceof File) || file.size === 0) {
		return opts.required ? { ok: false, error: 'err_file_missing' } : null;
	}
	if (file.size > opts.maxBytes) return { ok: false, error: 'err_file_big' };
	const raw = new Uint8Array(await file.arrayBuffer());
	const kind = sniff(raw);
	if (!kind || !opts.allowed.includes(kind)) return { ok: false, error: 'err_file_type' };
	const bytes = stripMetadata(raw, kind);
	return { ok: true, bytes, kind, ext: EXT[kind], name: safeName(file.name, EXT[kind]) };
}

/** A tidy display name: letters, digits, dash, underscore, dot; with the real extension. */
export function safeName(name: string, ext: string): string {
	const base =
		name
			.replace(/\.[^.]*$/, '')
			.replace(/[^\w.-]+/g, '-')
			.replace(/^[-.]+|[-.]+$/g, '')
			.slice(0, 60) || 'file';
	return `${base}.${ext}`;
}

export function newKey(folder: string, ext: string): string {
	return `${folder}/${crypto.randomUUID()}.${ext}`;
}

/* ---------- signed links ---------- */

const enc = new TextEncoder();
async function hmac(secret: string, data: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		enc.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
	return btoa(String.fromCharCode(...sig))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

/**
 * A link to a private file that works for `ttlSeconds` (default 10 minutes).
 * Only call this after checking the person may see the file.
 */
export async function signedUrl(
	secret: string,
	key: string,
	name: string,
	ttlSeconds = 600,
	now = Date.now()
) {
	const exp = Math.floor(now / 1000) + ttlSeconds;
	const sig = await hmac(secret, `file:${key}:${exp}:${name}`);
	const q = new URLSearchParams({ k: key, e: String(exp), n: name, s: sig });
	return `/files?${q}`;
}

export async function verifySignedUrl(secret: string, params: URLSearchParams, now = Date.now()) {
	const key = params.get('k') ?? '';
	const exp = Number(params.get('e'));
	const name = params.get('n') ?? 'file';
	const sig = params.get('s') ?? '';
	if (!key || !Number.isFinite(exp) || exp * 1000 < now) return null;
	const expected = await hmac(secret, `file:${key}:${exp}:${name}`);
	if (!timingSafeEqual(expected, sig)) return null;
	return { key, name };
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let r = 0;
	for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return r === 0;
}
