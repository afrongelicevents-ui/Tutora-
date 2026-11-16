/**
 * Connected Tools are SHORTCUTS: each button just opens the app or website. Tutora never
 * signs in to these accounts, makes meetings through their APIs or syncs anything, so no
 * API keys are needed. Lesson links are the tutor's own pasted links (meeting-links.ts).
 */
import type { Tool } from '#lib/components/tools/ToolLogo.svelte';

export type ShortcutRole = 'student' | 'tutor';

/** Where each shortcut opens. Students join Kahoot! games with a PIN at kahoot.it. */
export function shortcutUrl(tool: Tool, role: ShortcutRole): string {
	switch (tool) {
		case 'teams':
			return 'https://teams.microsoft.com/';
		case 'meet':
			return 'https://meet.google.com/';
		case 'zoom':
			return 'https://zoom.us/join';
		case 'drive':
			return 'https://drive.google.com/';
		case 'kahoot':
			return role === 'tutor' ? 'https://create.kahoot.it/' : 'https://kahoot.it/';
	}
}

/** The tools shown, in order. */
export const SHORTCUT_TOOLS: Tool[] = ['teams', 'meet', 'zoom', 'drive', 'kahoot'];
