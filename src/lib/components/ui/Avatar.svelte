<script lang="ts">
	/**
	 * A person's photo, or their initials in a coloured circle (any area). Pass only photos
	 * the viewer may see (e.g. a student's approved profile photo).
	 * Example: <Avatar name="Tatenda Sibanda" photo={url} size={64} />
	 */
	let {
		name,
		photo = null,
		size = 64
	}: { name: string; photo?: string | null; size?: number } = $props();
	const COLOURS = ['#1a5fae', '#1f7a4d', '#8a5a12', '#7b3fa0', '#b4433a', '#0f766e'];
	const initials = $derived(
		name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((w) => w[0]?.toUpperCase() ?? '')
			.join('')
	);
	const colour = $derived(
		COLOURS[[...name].reduce((a, c) => (a + c.charCodeAt(0)) % COLOURS.length, 0)]
	);
</script>

{#if photo}
	<img
		class="av"
		src={photo}
		alt=""
		width={size}
		height={size}
		style="width:{size}px;height:{size}px"
		loading="lazy"
		decoding="async"
	/>
{:else}
	<span
		class="av ini"
		aria-hidden="true"
		style="width:{size}px;height:{size}px;background:{colour};font-size:{Math.round(size / 2.6)}px"
		>{initials}</span
	>
{/if}

<style>
	.av {
		border-radius: 50%;
		object-fit: cover;
		flex-shrink: 0;
		border: 3px solid #fff;
		box-shadow: var(--shadow-soft);
	}
	.ini {
		display: grid;
		place-items: center;
		color: #fff;
		font-weight: 700;
		font-family: var(--font-display);
	}
</style>
