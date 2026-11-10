<script lang="ts">
	import { m } from '#lib/i18n.ts';
</script>

<svelte:head><title>{m.privacy_title()} · Tutora</title></svelte:head>

<!-- Legal text is kept in one language until reviewed; translations will follow. -->
<article class="wrap narrow">
	<h1>{m.privacy_title()}</h1>
	<p class="notice small">{m.draft_notice()}</p>
	<p>
		This notice explains how Tutora collects and uses personal information, in line with the Cyber
		and Data Protection Act [Chapter 12:07] of Zimbabwe.
	</p>
	<h2>What we collect</h2>
	<p>
		Names, email addresses and phone numbers of students and parents; lesson bookings; payment
		records and proof of payment you upload; homework and messages shared in lessons.
	</p>
	<h2>Children</h2>
	<p>
		Many students are under 18. For them, a parent or guardian contact is required. We never publish
		photos of students. Results are only shown with permission, using first names or initials.
	</p>
	<h2>Why we use it</h2>
	<p>To arrange and teach lessons, send reminders, record payments and issue receipts.</p>
	<h2>Who can see it</h2>
	<p>
		Only the tutor and the student (or their parent). Files are stored privately and shared only
		through short-lived links. We do not sell personal information.
	</p>
	<h2>Your rights</h2>
	<p>
		You can ask to see, correct or delete your information by messaging the tutor. Lessons are not
		recorded.
	</p>
</article>
