import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end flows: several real accounts (student, tutor, parent, owner) pressing real
 * buttons against a server with the fake TEST data (scripts/deploy/seed-test.ts).
 *   E2E_BASE      the site to test (default: a local dev server on :5173)
 *   E2E_PASSWORD  the shared test password the seed used
 *   E2E_DB        the same database, so a test can move time forward (e.g. a lesson to now)
 * See e2e/README.md.
 */
export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	timeout: 90_000,
	workers: 1,
	fullyParallel: false,
	reporter: [['list']],
	use: {
		baseURL: process.env.E2E_BASE ?? 'http://localhost:5173',
		trace: 'off',
		// a stuck click fails fast with its own line instead of the whole test timing out
		actionTimeout: 15_000,
		navigationTimeout: 30_000,
		// use a browser that is already installed when one is given
		launchOptions: process.env.E2E_CHROMIUM
			? { executablePath: process.env.E2E_CHROMIUM }
			: undefined
	},
	projects: [
		{ name: 'phone', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } }
	]
});
