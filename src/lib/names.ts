const TITLES = /^(mr|mrs|ms|miss|mx|dr|prof|sir|madam|mai|baba|amai)\.?$/i;

/**
 * How to address someone briefly: "Mrs Memory Sibanda" → "Mrs Sibanda", "Tatenda Sibanda" →
 * "Tatenda". People who wrote a title get title + surname, everyone else their first name.
 */
export function shortName(full: string): string {
	const parts = full.trim().split(/\s+/).filter(Boolean);
	if (!parts.length) return '';
	if (TITLES.test(parts[0]) && parts.length > 1) return `${parts[0]} ${parts.at(-1)}`;
	return parts[0];
}
