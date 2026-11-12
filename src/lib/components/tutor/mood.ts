import { m } from '#lib/i18n.ts';

/** How a check-in mood reads to the tutor ("finding it hard"). */
export function moodLabel(mood: string): string {
	switch (mood) {
		case 'confident':
			return m.tut3_mood_confident();
		case 'finding_hard':
			return m.tut3_mood_finding_hard();
		case 'need_help':
			return m.tut3_mood_need_help();
		case 'motivated':
			return m.tut3_mood_motivated();
		case 'need_break':
			return m.tut3_mood_need_break();
		default:
			return mood;
	}
}
