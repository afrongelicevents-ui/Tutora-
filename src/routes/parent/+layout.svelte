<script lang="ts">
	import AppShell from '#lib/components/AppShell.svelte';
	import { m } from '#lib/i18n.ts';
	let { children, data } = $props();
</script>

<AppShell
	tag={m.v3_tag_family()}
	label={m.v3_tag_family()}
	unread={data.unread}
	tabs={[
		{ href: '/parent', label: m.v3_nav_overview() },
		{ href: '/parent/updates', label: m.v3_nav_updates() },
		{ href: '/parent/school-plus', label: m.v3_nav_schoolplus() },
		{ href: '/parent/children', label: m.v3_nav_children() }
	]}
	more={[{ href: '/parent/payments', label: m.v3_nav_payments() }]}
>
	{@render children()}
</AppShell>
