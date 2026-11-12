<script lang="ts">
	import AppShell from '#lib/components/AppShell.svelte';
	import { m } from '#lib/i18n.ts';
	let { children, data } = $props();
</script>

<AppShell
	tag={m.v3_tag_student()}
	label={m.nav_dashboard()}
	unread={data.unread}
	tabs={[
		{ href: '/student', label: m.v3_nav_home(), icon: 'home', also: ['/student/subjects'] },
		{
			href: '/student/find',
			label: m.v3_nav_find(),
			icon: 'search',
			also: ['/student/book', '/student/tutor']
		},
		{ href: '/student/lessons', label: m.v3_nav_lessons(), icon: 'lessons' },
		{ href: '/student/progress', label: m.v3_nav_progress(), icon: 'progress' },
		{ href: '/student/me', label: m.v3_nav_you(), icon: 'user', also: ['/student/family'] }
	]}
	more={[
		{ href: '/student/homework', label: m.v3_nav_homework() },
		{ href: '/student/study', label: m.v3_nav_study() },
		{ href: '/student/payments', label: m.v3_nav_payments() },
		{ href: '/student/tools', label: m.v3_nav_tools() }
	]}
>
	{@render children()}
</AppShell>
