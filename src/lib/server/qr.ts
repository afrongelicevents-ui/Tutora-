import { renderSVG } from 'uqr';

/**
 * Server-rendered QR code as an SVG data URL, shown with <img> (no JavaScript sent to the
 * phone, and an <img> cannot run scripts even if the input were hostile).
 */
export function qrDataUrl(text: string): string {
	const svg = renderSVG(text, { border: 2, ecc: 'M', pixelSize: 6 });
	return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/** The secret key from an otpauth:// URI, grouped for typing by hand. */
export function totpSecret(uri: string): string {
	const secret = new URL(uri).searchParams.get('secret') ?? '';
	return secret.replace(/(.{4})/g, '$1 ').trim();
}
