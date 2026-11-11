// Builds docs/demo/tutora-demo.html: one self-contained file (no internet needed).
// Usage: node scripts/build-demo.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const b64 = (p) => Buffer.from(readFileSync(p)).toString('base64');
const src = readFileSync('docs/demo/src/demo.html', 'utf8');
const out = src
	.replaceAll('{{WORDMARK_B64}}', b64('brand/wordmark.svg'))
	.replaceAll('{{ICON_B64}}', b64('brand/icon.svg'));
if (/\{\{[A-Z_]+\}\}/.test(out)) throw new Error('unreplaced placeholder');
if (/(src|href)=["']https?:/i.test(out))
	throw new Error('demo must not load anything from the internet');
writeFileSync('docs/demo/tutora-demo.html', out);
console.log(`docs/demo/tutora-demo.html: ${(out.length / 1024).toFixed(1)} KB`);
