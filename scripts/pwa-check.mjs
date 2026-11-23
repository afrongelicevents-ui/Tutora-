// Checks the installed-app setup against the PRODUCTION build (the service worker only runs
// there), in Chromium:
//   1. Chrome's own installability check finds no errors and the manifest parses cleanly;
//   2. the service worker registers and controls the page;
//   3. offline, opening a page shows the "You're offline" page;
//   4. a private page (/student) is never served from the store: offline it is the offline
//      page, not yesterday's lessons;
//   5. nothing private is in the store at all.
// With SHOTS=dir it also takes the phone screenshots (Android and iPhone sizes).
//
//   pnpm build && node scripts/perf/wsproxy.mjs &  node scripts/pwa-preview.mjs &
//   PREVIEW_PASSWORD=Shot-pass-123 node scripts/pwa-check.mjs
import { chromium } from '@playwright/test';

const BASE = process.env.PREVIEW_URL ?? 'http://127.0.0.1:4173';
const PW = process.env.PREVIEW_PASSWORD ?? 'Shot-pass-123';
const SHOTS = process.env.SHOTS;
let failed = 0;
const ok = (cond, msg) => {
	console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
	if (!cond) failed++;
};

const browser = await chromium.launch(
	process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}
);

async function login(ctx, email) {
	const p = await ctx.newPage();
	await p.goto(`${BASE}/login`);
	await p.fill('input[name=email]', email);
	await p.fill('input[type=password]', PW);
	await Promise.all([
		p.waitForURL((u) => !u.pathname.startsWith('/login')),
		p.click('form button[type=submit]')
	]);
	return p;
}

// 1 + 2: installability and the worker (a normal profile: Chrome never installs in incognito)
{
	const fs = await import('node:fs');
	const os = await import('node:os');
	const dir = fs.mkdtempSync(`${os.tmpdir()}/tutora-pwa-`);
	const ctx = await chromium.launchPersistentContext(dir, {
		viewport: { width: 412, height: 915 },
		...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {})
	});
	const p = await ctx.newPage();
	await p.goto(`${BASE}/`);
	await p
		.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
			timeout: 20_000
		})
		.catch(() => {});
	await p.reload();
	const cdp = await ctx.newCDPSession(p);
	const inst = await cdp.send('Page.getInstallabilityErrors');
	ok(
		inst.installabilityErrors.length === 0,
		`installable (errors: ${JSON.stringify(inst.installabilityErrors)})`
	);
	const man = await cdp.send('Page.getAppManifest');
	ok(man.errors.length === 0, `manifest parses (errors: ${JSON.stringify(man.errors)})`);
	const m = JSON.parse(man.data);
	ok(m.start_url === '/app?source=pwa' && m.display === 'standalone', 'start page and standalone');
	ok(
		m.icons.some((i) => i.purpose === 'maskable'),
		'has a maskable icon'
	);
	const sw = await p.evaluate(() => !!navigator.serviceWorker.controller);
	ok(sw, 'service worker controls the page');
	await ctx.close();
	fs.rmSync(dir, { recursive: true, force: true });
}

// 3 + 4 + 5: offline
{
	const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
	const p = await login(ctx, 'nyasha@example.com');
	await p.goto(`${BASE}/app?source=pwa`);
	ok(new URL(p.url()).pathname === '/student', `/app opens the student home (${p.url()})`);
	await p.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
		timeout: 20_000
	});
	await p.goto(`${BASE}/student`);
	await ctx.setOffline(true);
	await p.goto(`${BASE}/student`).catch(() => {});
	const text = await p.locator('body').innerText();
	ok(/You're offline/.test(text), 'offline: /student shows the offline page');
	ok(!/Nyasha/.test(text), 'offline: no private data from yesterday');
	await p.goto(`${BASE}/parent/billing`).catch(() => {});
	ok(
		/You're offline/.test(await p.locator('body').innerText()),
		'offline: payments page shows the offline page'
	);
	const stored = await p.evaluate(async () => {
		const out = [];
		for (const k of await caches.keys()) {
			const c = await caches.open(k);
			for (const r of await c.keys()) out.push(new URL(r.url).pathname);
		}
		return out;
	});
	const privateHit = stored.filter(
		(u) =>
			!u.startsWith('/_app/immutable/') &&
			!/\.(png|webp|svg|woff2|js|css|webmanifest)$/.test(u) &&
			u !== '/offline'
	);
	ok(
		privateHit.length === 0,
		`store holds only the shell (${stored.length} files; others: ${privateHit.join(', ') || 'none'})`
	);
	if (SHOTS) {
		await p.screenshot({ path: `${SHOTS}/pwa_offline_iphone.png` });
	}
	await ctx.setOffline(false);
	await ctx.close();
}

await browser.close();
console.log(failed ? `${failed} check(s) failed` : 'all PWA checks passed');
process.exit(failed ? 1 : 0);
