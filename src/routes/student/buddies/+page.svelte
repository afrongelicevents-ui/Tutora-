<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	import { avatarColour, initialsOf } from '#lib/components/profile/ProfileCard.svelte';
	let { data, form } = $props();
</script>

<svelte:head><title>{m.bd_title()} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/student/me/edit">← {m.me_edit()}</a>
	<h1>{m.bd_title()}</h1>
	<p class="lead">{m.bd_lead()}</p>
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if form?.added}<p class="notice" role="status">
			{form.added === 'active' ? m.bd_added() : m.bd_added_wait()}
		</p>{/if}
	{#if form?.removed}<p class="notice" role="status">{m.bv_removed()}</p>{/if}

	<section class="card code-card">
		<h2 class="h3">{m.bd_your_code()}</h2>
		<p class="code" aria-live="polite">{data.code.code}</p>
		<p class="small muted">{m.bd_code_hint({ date: fmtDay(data.code.expiresAt) })}</p>
		<form method="POST" action="?/newCode">
			<button class="btn btn-secondary" type="submit">{m.bd_new_code()}</button>
		</form>
	</section>

	<form method="POST" action="?/add" class="card stack">
		<h2 class="h3">{m.bd_add()}</h2>
		<div class="field">
			<label for="bd-code">{m.bd_add_label()}</label>
			<input
				id="bd-code"
				name="code"
				required
				autocomplete="off"
				autocapitalize="characters"
				placeholder="ABCDE-FGH23"
				maxlength="16"
			/>
		</div>
		<button class="btn" type="submit">{m.bd_add_btn()}</button>
		<p class="small muted">{m.bd_safety()}</p>
	</form>

	<section>
		<div class="section-h"><h2>{m.bd_title()}</h2></div>
		{#if data.active.length}
			<ul class="list">
				{#each data.active as b (b.id)}
					<li>
						<a href="/student/buddies/{b.id}">
							{#if b.photoVersion}<img
									src="/profile-photo/{b.id}?v={b.photoVersion}"
									alt=""
									width="48"
									height="48"
								/>{:else}<span class="ini" style="background:{avatarColour(b.displayName)}"
									>{initialsOf(b.displayName)}</span
								>{/if}
							<span class="who"
								><strong>{b.displayName}</strong><span class="small muted"
									>{[b.grade, m.bd_streak({ n: b.streak })].filter(Boolean).join(' · ')}</span
								></span
							>
							<span aria-hidden="true" class="go">›</span>
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted">{m.bd_none()}</p>
		{/if}
		{#if data.pending.length}
			<ul class="list pending">
				{#each data.pending as pnd (pnd.linkId)}
					<li>
						<span class="who"
							><strong>{pnd.displayName}</strong><span class="small muted"
								>{pnd.waitingForMine ? m.bd_pending_mine() : m.bd_pending_theirs()}</span
							></span
						>
						<form method="POST" action="?/remove">
							<input type="hidden" name="link" value={pnd.linkId} /><button
								class="btn-link small"
								type="submit">{m.pe_cancel()}</button
							>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<style>
	.back {
		align-self: flex-start;
		color: var(--ocean);
		font-weight: 600;
		text-decoration: none;
		padding: 8px 0;
	}
	.code-card {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}
	.code {
		margin: 0;
		font:
			700 1.75rem ui-monospace,
			Menlo,
			Consolas,
			monospace;
		letter-spacing: 0.08em;
		color: var(--navy);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 18px;
	}
	.list li + li {
		border-top: 1px solid var(--border);
	}
	.list a,
	.pending li {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 64px;
		padding: 8px 14px;
		color: var(--text);
		text-decoration: none;
	}
	.list img,
	.ini {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		object-fit: cover;
		flex: none;
	}
	.ini {
		display: grid;
		place-items: center;
		color: #fff;
		font: 600 1.125rem var(--font-display);
	}
	.who {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}
	.go {
		color: var(--muted);
		font-size: 1.25rem;
	}
	.pending {
		margin-top: 10px;
		background: var(--snow);
	}
</style>
