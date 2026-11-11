/** Digits only, as wa.me expects: "+263 77 000 0001" -> "263770000001". */
export function waDigits(phone: string): string {
	return phone.replace(/\D/g, '');
}

/** Free click-to-chat link (no paid WhatsApp API). */
export function waLink(phone: string, text?: string): string {
	const base = `https://wa.me/${waDigits(phone)}`;
	return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** "+263770000001" -> "+263 77 000 0001" for display. */
export function formatZwPhone(phone: string): string {
	const d = waDigits(phone);
	if (d.startsWith('263') && d.length === 12) {
		return `+263 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
	}
	return phone;
}
