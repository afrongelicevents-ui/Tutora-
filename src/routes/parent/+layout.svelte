<script lang="ts">
	import AppShell from '#lib/components/AppShell.svelte';
	import { page } from '$app/state';
	import { m } from '#lib/i18n.ts';
	let { children, data } = $props();
</script>

<AppShell
	tag={m.v3_tag_family()}
	label={m.v3_tag_family()}
	unread={(page.data as { unreadNow?: number }).unreadNow ?? data.unread}
	bellHref="/parent/notifications"
	accountHref="/parent/settings"
	initial={data.initial}
	tabs={[
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
			also: ['/parent/payments', '/parent/buddies']
		}
	]}
>
	{@render children()}
</AppShell>
