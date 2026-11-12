<script lang="ts">
	import { m } from '#lib/i18n.ts';
	let { data } = $props();
	const items = $derived(
		[
			['/tutor/homework', m.v3_nav_marking(), m.tut3_more_marking_hint()],
			['/tutor/assessments', m.v3_nav_assessments(), m.tut3_more_assess_hint()],
			['/tutor/tools', m.v3_nav_tools(), m.tut3_more_tools_hint()],
			['/tutor/settings', m.v3_nav_profile(), m.more_settings_hint()],
			['/tutor/reviews', m.reviews_title(), m.tut3_more_reviews_hint()],
			data.status === 'active' ? [`/t/${data.slug}`, m.more_public(), m.more_public_hint()] : null,
			['/notifications', m.notif_title(), m.more_notif_hint()],
			['/account', m.nav_account(), m.tut3_more_account_hint()],
			['/account/2fa', m.account_2fa(), m.more_2fa_hint()]
		].filter((x): x is string[] => !!x)
	);
</script>

<svelte:head><title>{m.v3_nav_more()} · Tutora</title></svelte:head>

<section class="screen">
	<h1>{m.v3_nav_more()}</h1>
	<nav class="rows top" aria-label={m.v3_nav_more()}>
		{#each items as [href, title, hint] (href)}
			<a {href}
				><span class="item"><span>{title}</span><span class="note">{hint}</span></span><span
					class="go"
					aria-hidden="true">›</span
				></a
			>
		{/each}
	</nav>
	<form method="POST" action="/logout">
		<button class="btn btn-ghost btn-block" type="submit">{m.nav_logout()}</button>
	</form>
</section>

<style>
	.item {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
</style>
