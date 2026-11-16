/**
 * Cloudflare bindings (Workers AI, …). With this adapter they are not on `event.platform`:
 * they come from the `cloudflare:workers` module. Returns null where there is no binding
 * (local dev, tests).
 */
import { env } from 'cloudflare:workers';

export function cfBinding<T>(name: string): T | null {
	try {
		return ((env as unknown as Record<string, unknown>)[name] as T | undefined) ?? null;
	} catch {
		return null;
	}
}
