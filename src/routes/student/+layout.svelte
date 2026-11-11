<script lang="ts">
	import AppNav from '#lib/components/AppNav.svelte';
	import { m } from '#lib/i18n.ts';
	let { children } = $props();
</script>

{@render children()}
<AppNav
	label={m.nav_dashboard()}
	items={[
		{ href: '/student', label: m.snav_lessons(), icon: 'home' },
		{ href: '/student/book', label: m.snav_book(), icon: 'plus' },
		{ href: '/student/payments', label: m.snav_payments(), icon: 'money' },
		{ href: '/student/homework', label: m.snav_homework(), icon: 'book' }
	]}
/>
