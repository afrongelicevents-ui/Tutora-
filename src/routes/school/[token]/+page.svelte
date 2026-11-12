<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDayTime } from '#lib/tz.ts';
	let { data, form } = $props();
	const p = $derived(data.p);
</script>

<svelte:head
	><title>{m.sp3_title()} · Tutora</title><meta name="robots" content="noindex" /></svelte:head
>

<div class="screen">
	<span class="eyebrow">{m.sp3_title()}</span>
	<h1>{m.sp3_school_h({ child: p.child, subject: p.subject })}</h1>
	{#if (form as { error?: string } | null)?.error}<p class="alert" role="alert">
			{t((form as { error: string }).error)}
		</p>{/if}
	{#if p.status === 'school_invited'}
		<p class="lead">{m.sp3_school_lead({ school: p.school, child: p.child })}</p>
		<div class="softcard small">
			<strong>{m.sp3_consent_h()}</strong><span>{p.consentText}</span>
		</div>
		<form method="POST" action="?/respond" class="stack">
			<label class="field"
				><span class="label">{m.sp3_your_name()}</span><input
					name="teacher"
					value={p.teacher}
					maxlength="80"
				/></label
			>
			<button class="btn btn-block" name="accept" value="1">{m.sp3_school_yes()}</button>
			<button class="btn btn-ghost btn-block" name="accept" value="0">{m.sp3_school_no()}</button>
		</form>
		<p class="note">{m.sp3_school_note()}</p>
	{:else}
		<div class="rows">
			{#each data.log as l (l.id)}<div class="logrow">
					<span class="muted tiny">{fmtDayTime(l.createdAt)} · {l.fromName}</span><span
						class="prewrap">{l.body}</span
					>
				</div>{/each}
		</div>
		<form method="POST" action="?/message" class="stack">
			<label class="field"
				><span class="label">{m.sp3_message_tutor()}</span><textarea
					name="body"
					rows="4"
					maxlength="2000"
					required></textarea></label
			>
			<button class="btn" type="submit">{m.sp3_send()}</button>
		</form>
		<p class="note">{m.sp3_logged_note()}</p>
	{/if}
</div>

<style>
	h1 {
		margin: 0;
		font-size: 1.75rem;
	}
	.logrow {
		flex-direction: column;
		align-items: flex-start !important;
		gap: 2px !important;
	}
	.tiny {
		font-size: 0.75rem;
	}
</style>
