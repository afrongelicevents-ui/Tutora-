import { describe, expect, it } from 'vitest';
import {
	readUpload,
	safeName,
	signedUrl,
	sniff,
	stripMetadata,
	verifySignedUrl,
	MB,
	DOC_KINDS,
	IMAGE_KINDS
} from './files.ts';

const bytes = (...xs: number[]) => new Uint8Array(xs);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

// A tiny JPEG skeleton: SOI, APP0 (JFIF), APP1 (Exif with "GPS"), COM, DQT, SOS + data, EOI
const jpeg = bytes(
	0xff,
	0xd8,
	0xff,
	0xe0,
	0x00,
	0x07,
	...ascii('JFIF\0'),
	0xff,
	0xe1,
	0x00,
	0x0a,
	...ascii('Exif\0GPS'),
	0xff,
	0xfe,
	0x00,
	0x06,
	...ascii('hey!'),
	0xff,
	0xdb,
	0x00,
	0x04,
	0x00,
	0x01,
	0xff,
	0xda,
	0x00,
	0x04,
	0x00,
	0x00,
	0x11,
	0x22,
	0xff,
	0xd9
);

function pngChunk(type: string, data: number[]) {
	const len = data.length;
	return [
		(len >>> 24) & 255,
		(len >>> 16) & 255,
		(len >>> 8) & 255,
		len & 255,
		...ascii(type),
		...data,
		0,
		0,
		0,
		0
	];
}
const png = bytes(
	0x89,
	0x50,
	0x4e,
	0x47,
	0x0d,
	0x0a,
	0x1a,
	0x0a,
	...pngChunk('IHDR', Array(13).fill(0)),
	...pngChunk('tEXt', ascii('GPS\0Harare')),
	...pngChunk('eXIf', [1, 2, 3, 4]),
	...pngChunk('IDAT', [9, 9]),
	...pngChunk('IEND', [])
);

function webpChunk(type: string, data: number[]) {
	const len = data.length;
	return [...ascii(type), len & 255, (len >> 8) & 255, 0, 0, ...data, ...(len % 2 ? [0] : [])];
}
const webpBody = [
	...ascii('WEBP'),
	...webpChunk('VP8X', [0x0c, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
	...webpChunk('VP8 ', [1, 2, 3, 4]),
	...webpChunk('EXIF', ascii('GPS-data'))
];
const webp = bytes(
	...ascii('RIFF'),
	webpBody.length & 255,
	(webpBody.length >> 8) & 255,
	0,
	0,
	...webpBody
);

const has = (b: Uint8Array, s: string) => new TextDecoder('latin1').decode(b).includes(s);

describe('upload type checks', () => {
	it('recognises files by their content', () => {
		expect(sniff(jpeg)).toBe('image/jpeg');
		expect(sniff(png)).toBe('image/png');
		expect(sniff(webp)).toBe('image/webp');
		expect(sniff(bytes(...ascii('%PDF-1.7\n')))).toBe('application/pdf');
		expect(sniff(bytes(...ascii('<svg onload=alert(1)>')))).toBeNull();
		expect(sniff(bytes(...ascii('<html>')))).toBeNull();
	});

	it('rejects wrong types, empty and too-big files, and a fake extension', async () => {
		const html = new File(['<script>alert(1)</script>'], 'proof.jpg', { type: 'image/jpeg' });
		expect(await readUpload(html, { maxBytes: MB, allowed: DOC_KINDS })).toEqual({
			ok: false,
			error: 'err_file_type'
		});
		const pdf = new File([bytes(...ascii('%PDF-1.4 x'))], 'x.pdf');
		expect(await readUpload(pdf, { maxBytes: MB, allowed: IMAGE_KINDS })).toEqual({
			ok: false,
			error: 'err_file_type'
		});
		const big = new File([new Uint8Array(2 * MB)], 'a.jpg');
		expect(await readUpload(big, { maxBytes: MB, allowed: DOC_KINDS })).toEqual({
			ok: false,
			error: 'err_file_big'
		});
		expect(
			await readUpload(new File([], 'e.jpg'), { maxBytes: MB, allowed: DOC_KINDS, required: true })
		).toEqual({ ok: false, error: 'err_file_missing' });
		expect(await readUpload(null, { maxBytes: MB, allowed: DOC_KINDS })).toBeNull();
	});

	it('accepts a real photo and gives it a safe name', async () => {
		const r = await readUpload(new File([jpeg], '../../My Proof (1).PNG'), {
			maxBytes: MB,
			allowed: DOC_KINDS
		});
		expect(r).toMatchObject({ ok: true, kind: 'image/jpeg', ext: 'jpg', name: 'My-Proof-1.jpg' });
		expect(safeName('..', 'pdf')).toBe('file.pdf');
	});
});

describe('photo metadata is removed', () => {
	it('JPEG: drops EXIF and comments, keeps the image', () => {
		const out = stripMetadata(jpeg, 'image/jpeg')!;
		expect(has(jpeg, 'GPS')).toBe(true);
		expect(has(out, 'GPS')).toBe(false);
		expect(has(out, 'hey!')).toBe(false);
		expect(has(out, 'JFIF')).toBe(true);
		expect([...out.slice(-4)]).toEqual([0x11, 0x22, 0xff, 0xd9]);
		expect(out[0]).toBe(0xff);
		expect(sniff(out)).toBe('image/jpeg');
	});
	it('JPEG that cannot be read cleanly is refused, never stored with its data', async () => {
		const broken = jpeg.slice(0, 20);
		expect(stripMetadata(broken, 'image/jpeg')).toBeNull();
		expect(
			await readUpload(new File([broken], 'x.jpg'), { maxBytes: MB, allowed: DOC_KINDS })
		).toEqual({ ok: false, error: 'err_file_type' });
	});
	it('PNG: drops text and EXIF chunks', () => {
		const out = stripMetadata(png, 'image/png')!;
		expect(has(out, 'Harare')).toBe(false);
		expect(has(out, 'eXIf')).toBe(false);
		expect(has(out, 'IDAT')).toBe(true);
		expect(has(out, 'IEND')).toBe(true);
	});
	it('WebP: drops EXIF, clears the flag and fixes the size', () => {
		const out = stripMetadata(webp, 'image/webp')!;
		expect(has(out, 'GPS-data')).toBe(false);
		expect(has(out, 'VP8 ')).toBe(true);
		const size = out[4] | (out[5] << 8);
		expect(size).toBe(out.length - 8);
		const flags = out[20];
		expect(flags & 0x08).toBe(0);
	});
});

describe('signed file links', () => {
	const secret = 'x'.repeat(32);
	it('work until they expire', async () => {
		const url = await signedUrl(secret, 'proofs/a.jpg', 'proof.jpg', 600, 1_000_000);
		const q = new URL(url, 'http://x').searchParams;
		expect(await verifySignedUrl(secret, q, 1_000_000 + 599_000)).toEqual({
			key: 'proofs/a.jpg',
			name: 'proof.jpg'
		});
		expect(await verifySignedUrl(secret, q, 1_000_000 + 601_000)).toBeNull();
	});
	it('cannot be changed to open another file', async () => {
		const q = new URL(await signedUrl(secret, 'proofs/a.jpg', 'a.jpg'), 'http://x').searchParams;
		q.set('k', 'proofs/b.jpg');
		expect(await verifySignedUrl(secret, q)).toBeNull();
		const q2 = new URL(await signedUrl(secret, 'proofs/a.jpg', 'a.jpg'), 'http://x').searchParams;
		expect(await verifySignedUrl('y'.repeat(32), q2)).toBeNull();
	});
});
