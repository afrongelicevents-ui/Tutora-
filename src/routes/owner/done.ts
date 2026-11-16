import { redirect } from '@sveltejs/kit';

/**
 * After an owner action: back to the same page with a short "done" note in the address
 * (?done=…), so refreshing the page never sends the form again.
 */
export function doneRedirect(url: URL, key: string): never {
	// the list's search, filter and page stay (forms send them along: "?/action&status=…")
	const back = new URLSearchParams();
	back.set('done', key);
	for (const k of ['q', 'status', 'state', 'when', 'page']) {
		const v = url.searchParams.get(k);
		if (v) back.set(k, v.slice(0, 60));
	}
	redirect(303, `${url.pathname}?${back}`);
}

/** The note to show, only from our own list of message keys (never free text). */
export function doneFrom(url: URL): string | null {
	const k = url.searchParams.get('done') ?? '';
	return /^(owner_done_|or_done_|oc_done_|saved$)[a-z_]*$/.test(k) ? k : null;
}
