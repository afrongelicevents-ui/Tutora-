<script lang="ts">
	import AppNav from '#lib/components/AppNav.svelte';
	import { m } from '#lib/i18n.ts';
	let { children } = $props();
</script>

{@render children()}
<AppNav
	label={m.nav_tutor()}
	items={[
		{ href: '/tutor', label: m.tnav_today(), icon: 'today' },
		{ href: '/tutor/calendar', label: m.tnav_calendar(), icon: 'cal' },
		{ href: '/tutor/students', label: m.tnav_students(), icon: 'users' },
		{ href: '/tutor/payments', label: m.tnav_money(), icon: 'money' },
		{ href: '/tutor/more', label: m.tnav_more(), icon: 'gear' }
	]}
/>
