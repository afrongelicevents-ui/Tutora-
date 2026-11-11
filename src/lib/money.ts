export type Currency = 'USD' | 'ZWG';

/** Amounts are always integer cents. */
export function formatMoney(cents: number, currency: Currency = 'USD'): string {
	const v = (cents / 100).toFixed(2);
	return currency === 'ZWG' ? `ZiG ${v}` : `$${v}`;
}

/** "12", "12.5", "12.50", "$12.50" -> 1250. Returns null for anything else. */
export function parseMoney(input: string): number | null {
	const s = input
		.trim()
		.replace(/^(\$|zig\s*)/i, '')
		.replace(/,/g, '');
	if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return null;
	const [whole, frac = ''] = s.split('.');
	return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

export const currencyLabel = (c: Currency) => (c === 'ZWG' ? 'ZiG' : 'USD');
