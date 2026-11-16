import { m } from '#lib/i18n.ts';

export type JoinProvider = 'meet' | 'teams' | 'zoom';

/** "Join on Google Meet / Teams / Zoom" for a lesson's meeting link. */
export function joinLabel(p: JoinProvider): string {
	return p === 'meet' ? m.ld3_join_meet() : p === 'teams' ? m.ld3_join_teams() : m.ml_join_zoom();
}

export function providerName(p: JoinProvider): string {
	return p === 'meet' ? 'Google Meet' : p === 'teams' ? 'Microsoft Teams' : 'Zoom';
}
