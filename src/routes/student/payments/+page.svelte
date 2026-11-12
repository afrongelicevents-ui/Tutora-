<script lang="ts">
	import PaymentsPage from '#lib/components/payments/PaymentsPage.svelte';
	let { data, form } = $props();
</script>

<PaymentsPage {data} {form} receiptBase="/student/payments" />
