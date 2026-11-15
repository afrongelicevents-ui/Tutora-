<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDate } from '#lib/tz.ts';
	import PartnershipWork from '#lib/components/schoolplus/PartnershipWork.svelte';
	let { data, form } = $props();
	type F = {
		error?: string;
		id?: number;
		link?: string | null;
		emailed?: boolean;
		done?: string;
	} | null;
	const f = $derived(form as F);
</script>

<svelte:head><title>{m.sp3_title()} · Tutora</title></svelte:head>

<div class="screen">
	<h1>{m.sp3_title()}</h1>
	<p class="lead">{m.spt_lead()}</p>
	{#if f?.error}<p class="alert" role="alert">{t(f.error)}</p>{/if}
	{#if f?.done}<p class="notice" role="status">{t(`spt_done_${f.done}`)}</p>{/if}
	{#each data.items as p (p.id)}
		<section class="card stack" data-testid="sp-item" data-status={p.status}>
			<div class="row">
				<strong class="grow">{p.child} · {p.subject}</strong><span class="pill p-info"
					>{t(`sp3_status_${p.status}`)}</span
				>
			</div>
			<span class="small muted"
				>{p.school} · {p.teacher}{p.teacherEmail && !p.teacherHasAccount
					? ` · ${p.teacherEmail}`
					: ''}{p.since ? ` · ${m.spt_since({ date: fmtDate(new Date(p.since)) })}` : ''}</span
			>

			{#if f?.link && f.id === p.id}
				<div class="softcard small" data-testid="sp-invite-link">
					<strong>{m.spt_link_h()}</strong>
					<input
						readonly
						value={f.link}
						onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
					/>
					<span>{f.emailed ? m.spt_link_emailed() : m.spt_link_note()}</span>
				</div>
			{/if}

			{#if p.status === 'requested'}
				<div class="row">
					<form method="POST" action="?/decide" data-testid="sp-accept">
						<input type="hidden" name="id" value={p.id} /><input
							type="hidden"
							name="accept"
							value="1"
						/><button class="btn btn-sm">{m.spt_agree()}</button>
					</form>
					<form method="POST" action="?/decide" data-testid="sp-decline">
						<input type="hidden" name="id" value={p.id} /><input
							type="hidden"
							name="accept"
							value="0"
						/><button class="btn btn-ghost btn-sm">{m.par_decline()}</button>
					</form>
				</div>
			{:else if p.status === 'tutor_accepted' || p.status === 'teacher_invited'}
				<form method="POST" action="?/invite" data-testid="sp-invite">
					<input type="hidden" name="id" value={p.id} />
					<button class="btn btn-sm"
						>{p.status === 'tutor_accepted' ? m.spt_invite() : m.spt_new_link()}</button
					>
				</form>
				{#if p.status === 'teacher_invited'}<p class="note">{m.spt_waiting_teacher()}</p>{/if}
			{:else if p.status === 'teacher_accepted'}
				<p class="note">{m.spt_waiting_consent()}</p>
			{/if}

			{#if p.steps}
				<PartnershipWork
					id={p.id}
					status={p.status}
					log={p.log}
					plan={p.plan}
					reports={p.reports}
					who="tutor"
				/>
			{/if}
		</section>
	{:else}
		<p class="note">{m.sp3_tutor_none()}</p>
	{/each}
</div>

<style>
	h1 {
		margin: 0;
		font-size: 1.875rem;
	}
	input[readonly] {
		width: 100%;
		min-height: 44px;
		padding: 0 10px;
		border: 1px solid var(--border-strong);
		border-radius: 10px;
		font: inherit;
		font-size: 0.8125rem;
	}
</style>
