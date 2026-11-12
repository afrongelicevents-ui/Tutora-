<script lang="ts">
	import BookingForm from '#lib/components/booking/BookingForm.svelte';
	import { m } from '#lib/i18n.ts';
	let { data, form } = $props();
</script>

<svelte:head><title>{data.intro ? m.intro_title() : m.book_lesson()} · Tutora</title></svelte:head>

<div class="screen">
	<BookingForm
		site={data.site}
		intro={data.intro}
		days={data.days}
		groups={data.groups}
		preselect={data.subject}
		error={form?.error ?? null}
		back="/student/tutor/{data.site.slug}"
	/>
</div>
