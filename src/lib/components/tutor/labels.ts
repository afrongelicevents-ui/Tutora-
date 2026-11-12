import { m } from '#lib/i18n.ts';

/** How a payment was made, in words. */
export function methodLabel(k: string): string {
	switch (k) {
		case 'bank':
			return m.method_bank();
		case 'ecocash':
			return 'EcoCash';
		case 'innbucks':
			return 'InnBucks';
		case 'cash':
			return m.method_cash();
		case 'other':
			return m.method_other();
		default:
			return k;
	}
}

/** The meeting tool's name (product names are not translated). */
export function toolLabel(k: string): string {
	return k === 'teams' ? 'Teams' : k === 'meet' ? 'Google Meet' : k;
}
