<script lang="ts" module>
	/** One small, consistent line-icon set (24px grid, 1.8 stroke). Only for navigation and
	 *  subject tiles: Tutora deliberately uses few icons. */
	export const ICONS = {
		home: 'M4 10.5 12 4l8 6.5V20h-5.5v-6h-5v6H4z',
		search: 'M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13Zm4.7-1.8L20 20',
		lessons: 'M8 5.5v13l10.5-6.5z',
		progress: 'M5 20V13M10 20V8M15 20v-9M20 20V5',
		family:
			'M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.5-.5a2.5 2.5 0 1 0 0-5M3.5 19.5c.6-3 2.6-4.8 5-4.8s4.4 1.8 5 4.8M15.5 14.8c2.2.1 3.9 1.8 4.4 4.7',
		flame:
			'M12 21c3.6 0 6-2.5 6-6 0-3.2-2.2-5.4-3.6-7-.3 1.8-1.2 3-2.4 3.6.2-2.9-1.1-5.4-3.4-7.1.1 2.9-1.4 4.6-2.7 6.2C4.8 12.2 6 21 12 21Zm0 0c-1.7 0-2.8-1.2-2.8-2.8 0-1.8 1.6-2.8 2.8-4.2 1.2 1.4 2.8 2.4 2.8 4.2 0 1.6-1.1 2.8-2.8 2.8Z',
		clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13.5V12l3 2',
		calendar: 'M4 6.5h16V20H4zM4 10.5h16M8.5 4v4M15.5 4v4',
		check: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-4-9.2 2.8 2.8L16 9.5',
		link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2',
		user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c.7-3.4 3.5-5.5 7-5.5s6.3 2.1 7 5.5',
		mail: 'M4 6h16v12H4zM4.5 6.5l7.5 6 7.5-6',
		school: 'M3 9.5 12 5l9 4.5-9 4.5zM7 11.5V16c1.4 1.3 3.1 2 5 2s3.6-.7 5-2v-4.5',
		pencil: 'M15 5l4 4-10 10H5v-4zM13 7l4 4',
		target:
			'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
		trophy:
			'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4',
		eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
		// subjects
		maths: 'M5 4h14v16H5zM8 8h8M9 12.5h0M12 12.5h0M15 12.5h0M9 16h0M12 16h0M15 16h0',
		language:
			'M4 5.5c2.6-1 5.3-1 8 .8 2.7-1.8 5.4-1.8 8-.8v13c-2.6-1-5.3-1-8 .8-2.7-1.8-5.4-1.8-8-.8zM12 6.3v13',
		science:
			'M9.5 4h5M10.5 4v5.2L5.6 17.6A1.6 1.6 0 0 0 7 20h10a1.6 1.6 0 0 0 1.4-2.4L13.5 9.2V4M8 14.5h8',
		humanities:
			'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM4.5 9.5h15M4.5 14.5h15M12 4c-2.2 2.3-3.2 5-3.2 8s1 5.7 3.2 8c2.2-2.3 3.2-5 3.2-8s-1-5.7-3.2-8Z',
		computing: 'M4 5h16v10H4zM9 19h6M12 15v4',
		business: 'M5 19V11M10 19V7M15 19v-5M20 19V4',
		book: 'M6 4h11a1 1 0 0 1 1 1v15H7a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1Zm-1 14a2 2 0 0 1 2-2h11',
		more: 'M6 12h0M12 12h0M18 12h0',
		clipboard: 'M9 3.5h6v3H9zM8 5H5.5v15.5h13V5H16M8.5 13.5 11 16l4.5-5',
		chat: 'M4 5h11v8H8.5L4 16.5zM9 15.5v1h6.5L20 20V9.5h-2.5',
		plus: 'M12 5v14M5 12h14',
		wallet: 'M4 7.5h14.5a1.5 1.5 0 0 1 1.5 1.5v9.5a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 18.5zM4 7.5 15.5 4v3.5M15 13.75h.01M20 11h-4.5a2.75 2.75 0 0 0 0 5.5H20',
		bell: 'M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0',
		star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z',
		cog: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-1.6 1.6 1.3-2 3.4-2-.7a7.6 7.6 0 0 1-2 1.2L14.7 21h-4l-.4-2.4a7.6 7.6 0 0 1-2-1.2l-2 .7-2-3.4 1.6-1.3a7.8 7.8 0 0 1 0-2.4L4.3 9.7l2-3.4 2 .7a7.6 7.6 0 0 1 2-1.2L10.7 3h4l.4 2.4a7.6 7.6 0 0 1 2 1.2l2-.7 2 3.4-1.6 1.3a7.8 7.8 0 0 1 0 2.4Z',
		palm: 'M12 21v-9M12 12c-1-3-4-4.5-7-3.5 2.5.5 4 2 5 4M12 12c1-3 4-4.5 7-3.5-2.5.5-4 2-5 4M12 12c-2-2-2.5-5-1-7.5.5 2.5 1.5 4.5 1 7.5M8 21h8',
		refresh: 'M19.5 8.5A8 8 0 0 0 5 7.5M4.5 15.5A8 8 0 0 0 19 16.5M19.5 4v4.5H15M4.5 20v-4.5H9',
		doc: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
		video: 'M3.5 7h11v10h-11zM14.5 10.5 20.5 7v10l-6-3.5',
		sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 2.5V4.5M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
		meal: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 21V3c-2 1.5-3 4-3 7v3h3',
		cup: 'M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8.5 3.5v2.5M12 3.5v2.5',
		ball: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13.5 3.3 2.4-1.3 3.9h-4l-1.3-3.9zM12 3v4.5M15.3 9.9l4.6-1.4M14 13.8l2.8 4M10 13.8l-2.8 4M8.7 9.9 4.1 8.5',
		moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
		chevron: 'M9.5 6l6 6-6 6',
		tutors:
			'M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11Zm7-.6a2.6 2.6 0 1 0 0-5.2M3 19.5c.6-3.1 2.9-5 6-5s5.4 1.9 6 5M16.2 14.4c2.4.2 4.2 2 4.8 5.1'
	} as const;
	export type IconName = keyof typeof ICONS;

	/** Pick the subject icon from the subject's name (unknown subjects get a book). */
	export function subjectIcon(name: string): IconName {
		const n = name.toLowerCase();
		if (/math|algebra|geometr|statist|calculus|arithm/.test(n)) return 'maths';
		if (/english|shona|ndebele|french|portugu|literat|language|reading|writing|kiswahili/.test(n))
			return 'language';
		if (/science|physic|chemi|biolog|agricult/.test(n)) return 'science';
		if (/histor|geograph|religio|heritage|social/.test(n)) return 'humanities';
		if (/computer|ict|coding|programm/.test(n)) return 'computing';
		if (/account|business|commerce|econom/.test(n)) return 'business';
		return 'book';
	}
</script>

<script lang="ts">
	let { name, size = 22 }: { name: IconName; size?: number } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={name === 'more' ? 3 : 1.8}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"><path d={ICONS[name]} /></svg
>
