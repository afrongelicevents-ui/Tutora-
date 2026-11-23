// Makes the app icons and the iPhone splash screens from the Tutora wordmark (Fraunces 600,
// the same font as the site header). Re-run after a brand change:
//   node scripts/pwa-assets.mjs
// Output: static/icons/*.png (icons) and static/splash/*.png (iPhone start-up images).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FONT = path.join(
	ROOT,
	'node_modules/@fontsource/fraunces/files/fraunces-latin-600-normal.woff2'
);
const NAVY = '#0B2545';
const SNOW = '#FFFFFF';
const SKY = '#6FB3EA';

/** icon sizes: purpose "any" (rounded square) and the iPhone/maskable full-bleed ones */
export const ICONS = [48, 72, 96, 128, 144, 152, 192, 256, 384, 512];
export const MASKABLE = [192, 512];
/** iPhone start-up images: [width, height, device width, device height, pixel ratio] */
export const SPLASH = [
	[750, 1334, 375, 667, 2], // SE 2nd/3rd, 8
	[1242, 2208, 414, 736, 3], // 8 Plus
	[1125, 2436, 375, 812, 3], // X, XS, 11 Pro, 12 mini, 13 mini
	[828, 1792, 414, 896, 2], // XR, 11
	[1242, 2688, 414, 896, 3], // XS Max, 11 Pro Max
	[1170, 2532, 390, 844, 3], // 12, 13, 14
	[1284, 2778, 428, 926, 3], // 12–13 Pro Max, 14 Plus
	[1179, 2556, 393, 852, 3], // 14 Pro, 15, 15 Pro, 16
	[1290, 2796, 430, 932, 3], // 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
	[1206, 2622, 402, 874, 3], // 16 Pro
	[1320, 2868, 440, 956, 3] // 16 Pro Max
];

const font = fs.readFileSync(FONT).toString('base64');

/**
 * The wordmark on navy. `kind`: 'any' (rounded square with a margin, for Android/desktop),
 * 'full' (full-bleed square: iPhone rounds it itself), 'mask' (full-bleed, wordmark inside the
 * maskable safe circle), 'splash' (a phone screen).
 */
function html(w, h, kind) {
	const short = Math.min(w, h);
	// width of the word as a share of the square, chosen so it stays readable at 48 px
	const share = { any: 0.66, full: 0.7, mask: 0.54, splash: 0.46 }[kind];
	const fontPx = Math.round((short * share) / 3.05);
	const radius = kind === 'any' ? Math.round(short * 0.22) : 0;
	const inset = kind === 'any' ? Math.round(short * 0.04) : 0;
	const dot = Math.max(2, Math.round(fontPx * 0.16));
	return `<!doctype html><html><head><style>
@font-face{font-family:F;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:600}
html,body{margin:0;width:${w}px;height:${h}px;background:transparent}
.bg{position:absolute;inset:${inset}px;background:${NAVY};border-radius:${radius}px;
display:flex;align-items:center;justify-content:center}
.w{font-family:F;font-weight:600;font-size:${fontPx}px;color:${SNOW};letter-spacing:-0.01em;
line-height:1;position:relative;transform:translateY(0.07em)}
.d{position:absolute;width:${dot}px;height:${dot}px;border-radius:50%;background:${SKY};
right:${-dot * 1.15}px;top:${Math.round(fontPx * 0.08)}px}
</style></head><body><div class="bg"><span class="w">Tutora<i class="d"></i></span></div></body></html>`;
}

async function shot(page, w, h, kind, out) {
	await page.setViewportSize({ width: w, height: h });
	await page.setContent(html(w, h, kind));
	await page.evaluate(() => document.fonts.ready);
	await page.screenshot({ path: out, omitBackground: kind === 'any' });
}

async function main() {
	const icons = path.join(ROOT, 'static/icons');
	const splash = path.join(ROOT, 'static/splash');
	fs.mkdirSync(icons, { recursive: true });
	fs.mkdirSync(splash, { recursive: true });
	// a Chromium that is already installed can be given with E2E_CHROMIUM (as for the e2e tests)
	const browser = await chromium.launch(
		process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}
	);
	const page = await browser.newPage({ deviceScaleFactor: 1 });
	for (const s of ICONS) await shot(page, s, s, 'any', path.join(icons, `icon-${s}.png`));
	for (const s of MASKABLE) await shot(page, s, s, 'mask', path.join(icons, `maskable-${s}.png`));
	await shot(page, 180, 180, 'full', path.join(icons, 'apple-touch-icon.png'));
	for (const [w, h] of SPLASH)
		await shot(page, w, h, 'splash', path.join(splash, `splash-${w}x${h}.png`));
	await browser.close();
	console.log(`icons: ${ICONS.length + MASKABLE.length + 1}, splash screens: ${SPLASH.length}`);
}

if (process.argv[1] && process.argv[1].endsWith('pwa-assets.mjs')) await main();
