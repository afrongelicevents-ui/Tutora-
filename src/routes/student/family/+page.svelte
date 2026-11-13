<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDayTime } from '#lib/tz.ts';
	import { shortName } from '#lib/names.ts';
	let { data, form } = $props();
	const shown = $derived(form && 'code' in form ? (form.code as string) : null);
</script>

<svelte:head><title>{m.fc3_title()} · Tutora</title></svelte:head>

<div class="screen wide-2">
	<div class="full">
		<h1>{m.fc3_title()}</h1>
		<p class="lead">{m.fc3_lead()}</p>
	</div>
	{#if form && 'error' in form && form.error}<p class="alert full" role="alert">
			{t(form.error as string, { minutes: 60 })}
		</p>{/if}
	{#if form && 'shared' in form}<p class="notice full" role="status">{m.fc_done_shared()}</p>
	{:else if form && 'revoked' in form}<p class="notice full" role="status">
			{m.fc_done_revoked()}
		</p>
	{:else if form && 'removed' in form}<p class="notice full" role="status">
			{m.fc_done_removed()}
		</p>{/if}

	<div class="navycard code">
		<span class="eyebrow">{m.fc3_your_code()}</span>
		{#if shown}
			<strong class="codebox" aria-live="polite">{shown}</strong>
			<span class="sub small">{m.fc3_works()}</span>
			<span class="sub small">{m.fc3_tell()}</span>
		{:else if data.invite}
			<strong class="hint">{m.fc3_active({ hint: data.invite.hint })}</strong>
			<span class="sub small">{m.fc3_until({ when: fmtDayTime(data.invite.expiresAt) })}</span>
		{:else}
			<span class="sub small">{m.fc3_none()}</span>
		{/if}
		<form method="POST" action="?/invite">
			<button class="btn btn-block" type="submit"
				>{data.invite || shown ? m.fc3_new() : m.fc3_make()}</button
			>
		</form>
		{#if data.invite || shown}
			<form method="POST" action="?/revoke">
				<button class="btn btn-ghost btn-block" type="submit">{m.fc3_cancel()}</button>
			</form>
		{/if}
	</div>

	<section class="side">
		{#each data.family as f (f.parentId)}
			<div class="person">
				<div class="section-h">
					<h2>{f.label ?? shortName(f.name)}{f.guardian ? ` · ${m.par_guardian()}` : ''}</h2>
				</div>
				{#if f.status === 'pending_guardian'}
					<p class="note">{m.fc3_pending()}</p>
				{:else}
					<p class="small muted">{m.fc3_sees({ name: f.label ?? shortName(f.name) })}</p>
					<form method="POST" action="?/share">
						<input type="hidden" name="parentId" value={f.parentId} />
						<label class="toggle-row"
							><span>{m.fc3_progress()}</span><input
								type="checkbox"
								name="progress"
								checked={f.progress || f.locked}
								disabled={f.locked}
							/></label
						>
						<label class="toggle-row"
							><span>{m.fc3_lessons()}</span><input
								type="checkbox"
								name="lessons"
								checked={f.lessons || f.locked}
								disabled={f.locked}
							/></label
						>
						<label class="toggle-row"
							><span>{m.fc3_homework()}</span><input
								type="checkbox"
								name="homework"
								checked={f.homework || f.locked}
								disabled={f.locked}
							/></label
						>
						<label class="toggle-row"
							><span>{m.fc3_study()}</span><input
								type="checkbox"
								name="study"
								checked={f.study || f.locked}
								disabled={f.locked}
							/></label
						>
						<div class="toggle-row">
							<span>{m.fc3_checkins()}</span><span class="ok-t small">{m.fc3_you_choose()}</span>
						</div>
						<div class="toggle-row">
							<span>{m.fc3_messages()}</span><span class="muted small"
								>{f.readsMessages ? m.fc3_can_read() : m.fc3_private()}</span
							>
						</div>
						<div class="toggle-row">
							<span>{m.fc3_notes()}</span><span class="muted small">{m.fc3_private()}</span>
						</div>
						{#if f.locked}<p class="note">{m.fc3_locked()}</p>{/if}
						<label class="field"
							><span class="label">{m.fc3_label()}</span><input
								name="label"
								value={f.label ?? ''}
								maxlength="30"
								placeholder={m.fc3_label_ph()}
							/></label
						>
						<button class="btn btn-ghost btn-sm" type="submit">{m.sw3_save()}</button>
					</form>
				{/if}
				{#if !f.locked}
					<form method="POST" action="?/remove">
						<input type="hidden" name="parentId" value={f.parentId} />
						<button class="btn-link small danger-link" type="submit">{m.fc3_remove()}</button>
					</form>
				{/if}
			</div>
		{:else}
			<div class="rows top">
				<div><span>{m.fc3_progress()}</span><span class="ok-t">{m.fc3_shared()}</span></div>
				<div><span>{m.fc3_lessons()}</span><span class="ok-t">{m.fc3_shared()}</span></div>
				<div><span>{m.fc3_checkins()}</span><span class="ok-t">{m.fc3_shared()}</span></div>
				<div>
					<span>{m.fc3_messages()}</span><span class="muted"
						>{data.minor ? m.fc3_guardian_reads() : m.fc3_private()}</span
					>
				</div>
			</div>
			<p class="note">{m.fc3_defaults()}</p>
		{/each}
	</section>
</div>

<style>
	h1 {
		margin: 0;
		font-size: 1.875rem;
	}
	.code {
		align-items: center;
		text-align: center;
		gap: 10px;
		padding: 22px;
	}
	.code form {
		width: 100%;
	}
	.hint {
		font-size: 1.125rem;
	}
	.person {
		padding-bottom: 12px;
		border-bottom: 1px solid var(--border);
		margin-bottom: 12px;
	}
	.danger-link {
		color: var(--danger-700);
	}
</style>
