<script lang="ts">
	import { m } from '#lib/i18n.ts';
</script>

<svelte:head><title>{m.terms_title()} · Tutora</title></svelte:head>

<article class="wrap narrow">
	<h1>{m.terms_title()}</h1>
	<p class="notice small">{m.draft_notice()}</p>
	<h2>Bookings</h2>
	<p>
		Lessons are confirmed only when the tutor accepts a booking. Cancellation rules are shown when
		you book.
	</p>
	<h2>Payments</h2>
	<p>
		Tutora does not take card payments. You pay into the tutor's account or in cash and record the
		payment on the site. A receipt is issued once the tutor confirms it.
	</p>
	<h2>Behaviour</h2>
	<p>Be respectful in lessons and reviews. The tutor may hide abusive reviews.</p>
</article>
