/**
 * Each area's tabs (phone tab bar + side navigation), in one place so the area layouts and
 * the shared pages (/notifications, /account) show the same shell.
 */
import type { NavItem } from '#lib/components/AppShell.svelte';
import { m } from '#lib/i18n.ts';

export type NavGroup = { title: string; items: NavItem[] };
export type Area = {
	tag: string;
	label: string;
	tabs: NavItem[];
	more?: NavItem[];
	/** side navigation in titled sections (wide screens), instead of tabs + more */
	groups?: NavGroup[];
};

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

/** Tutora admin: five tabs on phones, eight titled sections in the side navigation. */
export const ownerArea = (): Area => ({
	tag: m.ow_tag(),
	label: m.ow_label(),
	tabs: [
		{ href: '/owner', label: m.ow_nav_overview(), icon: 'home' },
		{
			href: '/owner/tutors',
			label: m.ow_nav_people(),
			icon: 'tutors',
			also: ['/owner/students', '/owner/parents', '/owner/teachers']
		},
		{ href: '/owner/payments', label: m.ow_nav_money(), icon: 'wallet' },
		{
			href: '/owner/safety',
			label: m.ow_nav_safety(),
			icon: 'eye',
			also: ['/owner/reports', '/owner/moderation']
		},
		{
			href: '/owner/more',
			label: m.ow_nav_more(),
			icon: 'more',
			also: [
				'/owner/bookings',
				'/owner/subjects',
				'/owner/school-plus',
				'/owner/content',
				'/owner/photos',
				'/owner/limits',
				'/owner/audit',
				'/owner/settings',
				'/account',
				'/notifications'
			]
		}
	],
	groups: [
		{ title: '', items: [{ href: '/owner', label: m.ow_nav_overview(), icon: 'home' }] },
		{
			title: m.ow_g_people(),
			items: [
				{ href: '/owner/tutors', label: m.ow_tutors(), icon: 'tutors' },
				{ href: '/owner/students', label: m.ow_students(), icon: 'user' },
				{ href: '/owner/parents', label: m.ow_parents(), icon: 'family' },
				{ href: '/owner/teachers', label: m.ow_teachers(), icon: 'school' }
			]
		},
		{
			title: m.ow_g_learning(),
			items: [
				{ href: '/owner/bookings', label: m.ow_bookings(), icon: 'calendar' },
				{ href: '/owner/subjects', label: m.ow_subjects(), icon: 'book' }
			]
		},
		{
			title: m.ow_g_money(),
			items: [{ href: '/owner/payments', label: m.ow_payments(), icon: 'wallet' }]
		},
		{
			title: m.ow_g_school(),
			items: [{ href: '/owner/school-plus', label: m.ow_partnerships(), icon: 'link' }]
		},
		{
			title: m.ow_g_safety(),
			items: [
				{ href: '/owner/safety', label: m.ow_safety(), icon: 'eye' },
				{ href: '/owner/reports', label: m.ow_reports(), icon: 'chat' },
				{ href: '/owner/moderation', label: m.ow_checks(), icon: 'check' }
			]
		},
		{
			title: m.ow_g_content(),
			items: [
				{ href: '/owner/content', label: m.ow_texts(), icon: 'pencil' },
				{ href: '/owner/photos', label: m.ow_photos(), icon: 'sun' }
			]
		},
		{
			title: m.ow_g_system(),
			items: [
				{ href: '/owner/limits', label: m.ow_limits(), icon: 'progress' },
				{ href: '/owner/audit', label: m.ow_log(), icon: 'clipboard' },
				{ href: '/owner/settings', label: m.ow_settings(), icon: 'cog', also: ['/account'] }
			]
		}
	]
});

/** The shell for a role on the shared pages; null where the role uses the top header. */
export function areaFor(role: string | undefined): Area | null {
	if (role === 'owner') return ownerArea();
	if (role === 'student') return studentArea();
	if (role === 'tutor') return tutorArea();
	if (role === 'parent') return parentArea();
	return null;
}
