import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { SPLASH } from './pwa.ts';

const manifest = JSON.parse(fs.readFileSync('static/manifest.webmanifest', 'utf8'));
const png = (p: string) => {
	const b = fs.readFileSync(`static${p}`);
	return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};

describe('installed app (PWA)', () => {
	it('manifest: name, start page, full screen, navy', () => {
		expect(manifest.name).toBe('Tutora');
		expect(manifest.short_name).toBe('Tutora');
		expect(manifest.start_url).toBe('/app?source=pwa');
		expect(manifest.display).toBe('standalone');
		expect(manifest.theme_color).toBe('#0B2545');
		expect(manifest.background_color).toBe('#0B2545');
	});

	it('every icon exists at its stated size, with maskable 192 and 512', () => {
		for (const i of manifest.icons) {
			const [w, h] = i.sizes.split('x').map(Number);
			expect(png(i.src)).toEqual({ w, h });
		}
		const masks = manifest.icons.filter((i: { purpose: string }) => i.purpose === 'maskable');
		expect(masks.map((i: { sizes: string }) => i.sizes).sort()).toEqual(['192x192', '512x512']);
		expect(png('/icons/apple-touch-icon.png')).toEqual({ w: 180, h: 180 });
	});

	it('every iPhone splash screen exists at its size and stays small', () => {
		for (const [w, h, dw, dh, r] of SPLASH) {
			const f = `/splash/splash-${w}x${h}.png`;
			expect(png(f)).toEqual({ w, h });
			expect(dw * r).toBe(w);
			expect(dh * r).toBe(h);
			expect(fs.statSync(`static${f}`).size).toBeLessThan(60_000);
		}
	});
});
