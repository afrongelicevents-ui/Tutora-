<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDayTime } from '#lib/tz.ts';
	let { data, form } = $props();
	const whatLabel = (w: string) =>
		w === 'photo'
			? m.bv_report_photo()
			: w === 'bio'
				? m.bv_report_bio()
				: w === 'behaviour'
					? m.bv_report_behaviour()
					: m.bv_report_other();
</script>

<svelte:head><title>{m.om_title()} · Tutora</title></svelte:head>

<section class="wrap stack">
	<h1>{m.om_title()}</h1>
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if form?.done}<p class="notice" role="status">{m.om_done()}</p>{/if}

	<h2>{m.om_items()}</h2>
	{#each data.cards as c (c.userId)}
		<div class="card stack">
			<strong>{c.displayName ?? c.name} <span class="muted small">({c.name})</span></strong>
			{#if c.photoStatus === 'pending'}
				<div class="row">
					<img
						src="/profile-photo/{c.userId}?v={c.photoVersion}"
						alt=""
						width="96"
						height="96"
						class="ph"
					/>
					<form method="POST" action="?/check">
						<input type="hidden" name="student" value={c.userId} /><input
							type="hidden"
							name="what"
							value="photo"
						/><input type="hidden" name="approve" value="1" /><button
							class="btn btn-sm"
							type="submit">{m.om_approve()} · {m.om_photo()}</button
						>
					</form>
					<form method="POST" action="?/check">
						<input type="hidden" name="student" value={c.userId} /><input
							type="hidden"
							name="what"
							value="photo"
						/><input type="hidden" name="approve" value="0" /><button
							class="btn btn-warn btn-sm"
							type="submit">{m.om_reject()} · {m.om_photo()}</button
						>
					</form>
				</div>
			{/if}
			{#if c.bioStatus === 'pending' && c.bio}
				<blockquote>{c.bio}</blockquote>
				<div class="row">
					<form method="POST" action="?/check">
						<input type="hidden" name="student" value={c.userId} /><input
							type="hidden"
							name="what"
							value="bio"
						/><input type="hidden" name="approve" value="1" /><button
							class="btn btn-sm"
							type="submit">{m.om_approve()} · {m.om_bio()}</button
						>
					</form>
					<form method="POST" action="?/check">
						<input type="hidden" name="student" value={c.userId} /><input
							type="hidden"
							name="what"
							value="bio"
						/><input type="hidden" name="approve" value="0" /><button
							class="btn btn-warn btn-sm"
							type="submit">{m.om_reject()} · {m.om_bio()}</button
						>
					</form>
				</div>
			{/if}
		</div>
	{:else}
		<p class="muted">{m.om_none()}</p>
	{/each}

	<h2>{m.om_reports()}</h2>
	{#each data.reports as r (r.id)}
		<div class="card stack">
			<strong>{m.om_reported({ reporter: r.reporter, reported: r.reported })}</strong>
			<span class="small muted">{whatLabel(r.what)} · {fmtDayTime(r.createdAt)}</span>
			{#if r.note}<p class="prewrap">{r.note}</p>{/if}
			<form method="POST" action="?/resolve">
				<input type="hidden" name="report" value={r.id} /><button
					class="btn btn-secondary btn-sm"
					type="submit">{m.om_resolve()}</button
				>
			</form>
		</div>
	{:else}
		<p class="muted">{m.om_reports_none()}</p>
	{/each}
</section>

<style>
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}
	.ph {
		border-radius: 50%;
		object-fit: cover;
	}
	blockquote {
		margin: 0;
		padding: 8px 12px;
		border-left: 3px solid var(--border-strong);
		background: var(--snow);
	}
</style>
