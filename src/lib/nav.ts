/**
 * Each area's tabs (phone tab bar + side navigation), in one place so the area layouts and
 * the shared pages (/notifications, /account) show the same shell.
 */
import type { NavItem } from '#lib/components/AppShell.svelte';
import { m } from '#lib/i18n.ts';

export type Area = { tag: string; label: string; tabs: NavItem[]; more?: NavItem[] };

export const studentArea = (): Area => ({
	tag: m.v3_tag_student(),
	label: m.nav_dashboard(),
	tabs: [
		{ href: '/student', label: m.v3_nav_home(), icon: 'home', also: ['/student/subjects'] },
		{
			href: '/student/tutors',
			label: m.v3_nav_tutors(),
			icon: 'tutors',
			also: ['/student/find', '/student/book', '/student/tutor', '/student/messages']
		},
		{ href: '/student/lessons', label: m.v3_nav_lessons(), icon: 'lessons' },
		{
			href: '/student/progress',
			label: m.v3_nav_progress(),
			icon: 'progress',
			also: ['/student/days', '/student/talk']
		},
		{
			href: '/student/me',
			label: m.v3_nav_you(),
			icon: 'user',
			also: [
				'/student/family',
				'/student/buddies',
				'/student/schedule',
				'/student/planner',
				'/student/report',
				'/account'
			]
		}
	],
	more: [
		{ href: '/student/homework', label: m.v3_nav_homework() },
		{ href: '/student/study', label: m.v3_nav_study() },
		{ href: '/student/payments', label: m.v3_nav_payments() },
		{ href: '/student/tools', label: m.v3_nav_tools() }
	]
});

export const tutorArea = (): Area => ({
	tag: m.v3_tag_tutor(),
	label: m.nav_tutor(),
	tabs: [
		{ href: '/tutor', label: m.v3_nav_today(), icon: 'home', also: ['/tutor/lessons'] },
		{ href: '/tutor/calendar', label: m.v3_nav_schedule(), icon: 'calendar' },
		{
			href: '/tutor/students',
			label: m.v3_nav_students(),
			icon: 'tutors',
			also: ['/tutor/messages']
		},
		{ href: '/tutor/payments', label: m.v3_nav_earnings(), icon: 'wallet' },
		{
			href: '/tutor/more',
			label: m.v3_nav_more(),
			icon: 'more',
			also: [
				'/tutor/settings',
				'/tutor/reviews',
				'/tutor/photo',
				'/tutor/setup',
				'/tutor/day',
				'/tutor/homework',
				'/tutor/assessments',
				'/tutor/resources',
				'/tutor/school-plus',
				'/tutor/tools',
				'/account'
			]
		}
	],
	more: [
		{ href: '/tutor/messages', label: m.msg_tutor_link() },
		{ href: '/tutor/homework', label: m.v3_nav_marking() },
		{ href: '/tutor/assessments', label: m.v3_nav_assessments() },
		{ href: '/tutor/resources', label: m.res3_nav() },
		{ href: '/tutor/school-plus', label: m.sp3_title() },
		{ href: '/tutor/tools', label: m.v3_nav_tools() },
		{ href: '/tutor/settings', label: m.v3_nav_profile() }
	]
});

export const parentArea = (): Area => ({
	tag: m.v3_tag_family(),
	label: m.v3_tag_family(),
	tabs: [
		{ href: '/parent', label: m.v3_nav_home(), icon: 'home', also: ['/parent/child'] },
		{
			href: '/parent/tutors',
			label: m.v3_nav_tutors(),
			icon: 'tutors',
			also: ['/parent/book', '/parent/messages']
		},
		{ href: '/parent/school-plus', label: m.v3_nav_schoolplus(), icon: 'school' },
		{
			href: '/parent/progress',
			label: m.v3_nav_progress(),
			icon: 'progress',
			also: ['/parent/report', '/parent/personal']
		},
		{
			href: '/parent/settings',
			label: m.nav_settings(),
			icon: 'cog',
			also: ['/parent/payments', '/parent/buddies', '/account']
		}
	]
});

/** The shell for a role on the shared pages; null where the role uses the top header. */
export function areaFor(role: string | undefined): Area | null {
	if (role === 'student') return studentArea();
	if (role === 'tutor') return tutorArea();
	if (role === 'parent') return parentArea();
	return null;
}
