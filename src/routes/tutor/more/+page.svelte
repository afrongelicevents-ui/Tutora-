<script lang="ts">
	import { m } from '#lib/i18n.ts';
</script>

<svelte:head><title>{m.tnav_more()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<h1>{m.tnav_more()}</h1>
	<a class="big-opt" href="/tutor/settings"
		>{m.settings_title()}<small>{m.more_settings_hint()}</small></a
	>
	<a class="big-opt" href="/tutor/setup/1"
		>{m.setup_wizard_title()}<small>{m.more_wizard_hint()}</small></a
	>
	<a class="big-opt" href="/tutor/reviews"
		>{m.reviews_title()}<small>{m.more_reviews_hint()}</small></a
	>
	<a class="big-opt" href="/">{m.more_public()}<small>{m.more_public_hint()}</small></a>
	<a class="big-opt" href="/account/2fa">{m.account_2fa()}<small>{m.more_2fa_hint()}</small></a>
	<form method="POST" action="/logout">
		<button class="btn btn-secondary btn-block" type="submit">{m.nav_logout()}</button>
	</form>
</section>
