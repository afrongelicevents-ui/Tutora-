<script lang="ts">
	import PaymentsPage from '#lib/components/payments/PaymentsPage.svelte';
	import { m } from '#lib/i18n.ts';
	import { shortName } from '#lib/names.ts';
	let { data, form } = $props();
</script>

<PaymentsPage
	{data}
	{form}
	receiptBase="/parent/payments"
	extra={data.child ? `child=${encodeURIComponent(data.child)}` : ''}
	title={data.payerName ? m.par3_pay_for({ name: shortName(data.payerName) }) : null}
/>
