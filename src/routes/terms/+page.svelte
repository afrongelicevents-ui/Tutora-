<script lang="ts">
	import { m } from '#lib/i18n.ts';
</script>

<svelte:head><title>{m.terms_title()} · Tutora</title></svelte:head>

<!-- Legal text is kept in one language until reviewed; translations will follow. -->
<article class="wrap narrow">
	<h1>{m.terms_title()}</h1>
	<p class="notice small">{m.draft_notice()}</p>
	<h2>What Tutora is</h2>
	<p>
		Tutora is a website that connects students and parents in Zimbabwe with independent tutors, and
		gives both sides tools to book and manage lessons. Tutora is not the tutor's employer and does
		not give lessons itself. Each tutor is responsible for their own lessons.
	</p>
	<h2>Tutors</h2>
	<p>
		Tutors set their own subjects, prices, free times and cancellation rules. A tutor's page goes
		public only after the Tutora team has approved it. Tutora may pause or remove a tutor who breaks
		these terms.
	</p>
	<h2>Bookings</h2>
	<p>
		A booking request stays "pending" until the tutor accepts it. Only then is the lesson confirmed.
		The tutor's cancellation rule is shown when you book. The free intro chat (if the tutor offers
		it) costs nothing.
	</p>
	<h2>Payments</h2>
	<p>
		Tutora does not take or hold any money and does not process payments. Students pay the tutor
		directly (EcoCash, InnBucks, bank transfer or cash) and record the payment on Tutora. A receipt
		is made once the tutor confirms the money arrived. Questions about a payment are between the
		student and the tutor; the Tutora team can help look at the records.
	</p>
	<h2>Children</h2>
	<p>
		Students under 18 need a parent or guardian's name and phone number. Parents can book for their
		children. No photos of students are shown publicly.
	</p>
	<h2>Reviews and behaviour</h2>
	<p>
		Reviews can only be written after a completed, paid lesson and must be honest and respectful.
		Tutors can reply and report a review; only the Tutora team can hide a review. Be respectful in
		lessons, chats and messages. Abuse can lead to an account being suspended.
	</p>
	<h2>Your account</h2>
	<p>
		Keep your password private. You can download your data or delete your account in Account at any
		time (see the Privacy notice).
	</p>
	<h2>Contact</h2>
	<p><a href="/contact">Contact the Tutora team</a></p>
</article>
