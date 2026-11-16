<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	/** "Free during the pilot" / "Active until 12 Dec" … as a small pill. */
	let {
		reason,
		until
	}: {
		reason: 'pilot' | 'gift' | 'trial' | 'paid' | 'grace' | 'free';
		until: Date | string | null;
	} = $props();
	const d = $derived(until ? fmtDay(new Date(until)) : '');
	const text = $derived(
		reason === 'pilot'
			? m.fb_state_pilot()
			: reason === 'gift'
				? until
					? m.fb_state_gift_until({ date: d })
					: m.fb_state_gift()
				: reason === 'trial'
					? m.fb_state_trial({ date: d })
					: reason === 'paid'
						? m.fb_state_paid({ date: d })
						: reason === 'grace'
							? m.fb_state_grace({ date: d })
							: m.fb_state_free()
	);
</script>

<span
	class="ui-pill"
	class:ok={reason === 'paid' || reason === 'pilot' || reason === 'trial' || reason === 'gift'}
	class:warn={reason === 'grace'}>{text}</span
>
