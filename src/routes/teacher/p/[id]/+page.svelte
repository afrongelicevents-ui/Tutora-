<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDate } from '#lib/tz.ts';
	import PartnershipWork from '#lib/components/schoolplus/PartnershipWork.svelte';
	let { data, form } = $props();
	const f = $derived(form as { error?: string; done?: string } | null);
</script>

<svelte:head><title>School+ · Tutora</title></svelte:head>

<div class="screen" data-testid="teacher-partnership" data-status={data.status}>
	<a class="back" href="/teacher" aria-label={m.v3_back()}>←</a>
	<span class="eyebrow">School+</span>
	<h1>{data.child} · {data.subject}</h1>
	<p class="small muted">
		{m.spx_with({ tutor: data.tutor, school: data.school })}{data.since
			? ` · ${m.spt_since({ date: fmtDate(new Date(data.since)) })}`
			: ''}
	</p>
	<span class="pill p-info">{t(`sp3_status_${data.status}`)}</span>
	{#if data.welcome}<p class="notice" role="status">{m.spx_welcome()}</p>{/if}
	{#if f?.error}<p class="alert" role="alert">{t(f.error)}</p>{/if}
	{#if f?.done}<p class="notice" role="status">{t(`spt_done_${f.done}`)}</p>{/if}
	{#if data.status === 'teacher_accepted'}
		<p class="softcard small">{m.spx_waiting_consent()}</p>
	{/if}
	{#if data.consentText}
		<details class="small">
			<summary>{m.sp3_consent_h()}</summary>
			<p>{data.consentText}</p>
		</details>
	{/if}
	<section class="card stack">
		<PartnershipWork
			id={data.id}
			status={data.status}
			log={data.log}
			plan={data.plan}
			reports={data.reports}
			who="teacher"
		/>
	</section>
</div>

<style>
	h1 {
		margin: 0;
		font-size: 1.75rem;
	}
</style>
