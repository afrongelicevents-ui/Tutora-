/**
 * Svelte action for <input type="file">: when the phone supports it, photos are made
 * smaller before upload (saves mobile data) and re-drawn, which drops hidden photo data.
 * PDFs and anything the browser can't draw are left alone. The server still checks and
 * strips everything, so this is only a data saver.
 */
export function shrink(input: HTMLInputElement, opts: { max?: number; quality?: number } = {}) {
	const max = opts.max ?? 1600;
	const quality = opts.quality ?? 0.78;
	async function onChange() {
		const files = input.files;
		if (!files?.length || typeof DataTransfer === 'undefined') return;
		const out = new DataTransfer();
		let changed = false;
		for (const f of Array.from(files)) {
			if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
				out.items.add(f);
				continue;
			}
			try {
				const bmp = await createImageBitmap(f);
				const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
				const c = document.createElement('canvas');
				c.width = Math.round(bmp.width * scale);
				c.height = Math.round(bmp.height * scale);
				c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
				const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/webp', quality));
				if (blob && blob.size < f.size) {
					out.items.add(
						new File([blob], f.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' })
					);
					changed = true;
				} else out.items.add(f);
			} catch {
				out.items.add(f);
			}
		}
		if (changed) input.files = out.files;
	}
	input.addEventListener('change', onChange);
	return { destroy: () => input.removeEventListener('change', onChange) };
}
