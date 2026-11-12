<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDayTime } from '#lib/tz.ts';
	let { data, form } = $props();
	type F = { error?: string; id?: number; link?: string | null; sent?: boolean } | null;
	const f = $derived(form as F);
</script>

<svelte:head><title>{m.sp3_title()} · Tutora</title></svelte:head>

<div class="screen">
	<h1>{m.sp3_title()}</h1>
	<p class="lead">{m.sp3_tutor_lead()}</p>
	{#if f?.error}<p class="alert" role="alert">{t(f.error)}</p>{/if}
	{#each data.items as p (p.id)}
		<section class="card stack">
			<div class="row">
				<strong class="grow">{p.child} · {p.subject}</strong><span class="pill p-info"
					>{t(`sp3_status_${p.status}`)}</span
				>
			</div>
			<span class="small muted"
				>{p.school} · {p.teacher}{p.teacherEmail ? ` · ${p.teacherEmail}` : ''}</span
			>
			{#if f?.link && f.id === p.id}
				<div class="softcard small">
					<strong>{m.sp3_link_h()}</strong>
					<input
						readonly
						value={f.link}
						onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
					/>
					<span>{m.sp3_link_note()}</span>
				</div>
			{/if}
			{#if p.status === 'requested' || p.status === 'school_invited'}
				<div class="row">
					<form method="POST" action="?/decide">
						<input type="hidden" name="id" value={p.id} /><input
							type="hidden"
							name="accept"
							value="1"
						/><button class="btn btn-sm"
							>{p.status === 'requested' ? m.sp3_agree() : m.sp3_new_link()}</button
						>
					</form>
					<form method="POST" action="?/decide">
						<input type="hidden" name="id" value={p.id} /><input
							type="hidden"
							name="accept"
							value="0"
						/><button class="btn btn-ghost btn-sm">{m.par_decline()}</button>
					</form>
				</div>
			{/if}
			{#if p.log.length}
				<div class="rows">
					{#each p.log as l (l.id)}<div class="logrow">
							<span class="muted tiny">{fmtDayTime(l.createdAt)} · {l.fromName}</span><span
								class="prewrap">{l.body}</span
							>
						</div>{/each}
				</div>
			{/if}
			{#if p.status === 'active'}
				<form method="POST" action="?/message" class="stack">
					<input type="hidden" name="id" value={p.id} />
					<label class="field"
						><span class="label">{m.sp3_message_teacher()}</span><textarea
							name="body"
							rows="3"
							maxlength="2000"
							required></textarea></label
					>
					<button class="btn btn-ghost btn-sm" type="submit">{m.sp3_send()}</button>
					<span class="note">{m.sp3_logged_note()}</span>
				</form>
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
	.logrow {
		flex-direction: column;
		align-items: flex-start !important;
		gap: 2px !important;
	}
	.tiny {
		font-size: 0.75rem;
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
