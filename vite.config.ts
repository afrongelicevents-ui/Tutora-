import { cspDirectives } from './src/lib/server/security.ts';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// local dev never talks to Cloudflare: no remote bindings (Workers AI is then missing
			// locally and the AI test maker says so; it works on the real sites)
			adapter: adapter({ platformProxy: { remoteBindings: false } }),
			// Content-Security-Policy. SvelteKit adds hashes/nonces for its own inline scripts.
			csp: {
				// hashes, not per-response nonces: public pages can be kept in memory and served again
				mode: 'hash',
				// one source of truth, with tests: src/lib/server/security.ts
				directives: cspDirectives()
			},
			// the installed app's service worker (src/service-worker.ts) is registered by the
			// root layout, and only in the production build: dev and the e2e tests run without it
			serviceWorker: { register: false }
		}),

		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			emitTsDeclarations: true
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
