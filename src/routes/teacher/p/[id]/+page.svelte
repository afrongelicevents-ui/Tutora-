<script lang="ts">
	import Hero from '#lib/components/ui/Hero.svelte';
	import { m, t } from '#lib/i18n.ts';
	import { fmtDate } from '#lib/tz.ts';
	import PartnershipWork from '#lib/components/schoolplus/PartnershipWork.svelte';
	let { data, form } = $props();
	const f = $derived(form as { error?: string; done?: string } | null);
</script>

<svelte:head><title>School+ · Tutora</title></svelte:head>

<div class="screen tskin ui-page tpage" data-testid="teacher-partnership" data-status={data.status}>
	<Hero
		dark
		title={`${data.child} · ${data.subject}`}
		lead={`${m.spx_with({ tutor: data.tutor, school: data.school })}${
			data.since ? ` · ${m.spt_since({ date: fmtDate(new Date(data.since)) })}` : ''
		}`}
	>
		{#snippet badge()}<span class="ui-pill gold">School+</span>{/snippet}
		<a class="back-l" href="/teacher?all=1">← {m.v3_back()}</a>
	</Hero>
	<span class="ui-pill">{t(`sp3_status_${data.status}`)}</span>
	{#if data.welcome}<p class="notice" role="status">{m.spx_welcome()}</p>{/if}
	{#if f?.error}<p class="alert" role="alert">{t(f.error)}</p>{/if}
	{#if f?.done}<p class="notice" role="status">{t(`spt_done_${f.done}`)}</p>{/if}
	{#if data.status === 'teacher_accepted'}
		<p class="softcard small">{m.spx_waiting_consent()}</p>
	{/if}
	{#if data.consentText}
		<details class="card small">
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
	/* centred like the rest of the site (this area has no side menu) */
	.tpage {
		max-width: 760px;
		margin-inline: auto;
	}

	.back-l {
		color: #fff;
		font-weight: 600;
		text-decoration: none;
	}
	.ui-pill {
		align-self: flex-start;
	}
</style>
