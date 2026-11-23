/**
 * The installed app (PWA). Icons and splash screens are made by scripts/pwa-assets.mjs;
 * keep SPLASH here in step with the list there.
 */

/** iPhone start-up images: [width, height, device width, device height, pixel ratio] */
export const SPLASH: readonly (readonly [number, number, number, number, number])[] = [
	[750, 1334, 375, 667, 2],
	[1242, 2208, 414, 736, 3],
	[1125, 2436, 375, 812, 3],
	[828, 1792, 414, 896, 2],
	[1242, 2688, 414, 896, 3],
	[1170, 2532, 390, 844, 3],
	[1284, 2778, 428, 926, 3],
	[1179, 2556, 393, 852, 3],
	[1290, 2796, 430, 932, 3],
	[1206, 2622, 402, 874, 3],
	[1320, 2868, 440, 956, 3]
];

/** localStorage key: the person closed the "Install Tutora" card (or installed the app) */
export const INSTALL_DISMISSED = 'tutora-install-dismissed';
