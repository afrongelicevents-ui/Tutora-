import { redirect } from '@sveltejs/kit';

/**
 * After an owner action: back to the same page with a short "done" note in the address
 * (?done=…), so refreshing the page never sends the form again.
 */
export function doneRedirect(url: URL, key: string): never {
	redirect(303, `${url.pathname}?done=${encodeURIComponent(key)}`);
}

/** The note to show, only from our own list of message keys (never free text). */
export function doneFrom(url: URL): string | null {
	const k = url.searchParams.get('done') ?? '';
	return /^(owner_done_|or_done_|oc_done_|saved$)[a-z_]*$/.test(k) ? k : null;
}
