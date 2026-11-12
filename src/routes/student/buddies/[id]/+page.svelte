<script lang="ts">
	// A buddy's profile, read-only: the same layout as your own, plus encouragement and safety.
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	import ProfileCard from '#lib/components/profile/ProfileCard.svelte';
	let { data, form } = $props();
	const v = $derived(data.view);
</script>

<svelte:head><title>{v.displayName} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/student/buddies">← {m.bd_title()}</a>
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if form?.sent}<p class="notice" role="status">{m.bv_sent()}</p>{/if}
	{#if form?.reported}<p class="notice" role="status">{m.bv_reported()}</p>{/if}

	<ProfileCard
		photoUrl={v.photoVersion ? `/profile-photo/${v.id}?v=${v.photoVersion}` : null}
		displayName={v.displayName}
		grade={v.grade}
		bio={v.bio}
		streak={v.streak}
		badges={v.badges}
		subjects={v.subjects}
	/>

	<section class="card stack">
		<h2 class="h3">{m.bv_encourage()}</h2>
		<form method="POST" action="?/send" class="chips">
			{#each data.presets as p (p)}
				<button class="chip" type="submit" name="preset" value={p}>{t(`bp_${p}`)}</button>
			{/each}
		</form>
		{#if data.messages.length}
			<h3 class="small muted">{m.bv_recent()}</h3>
			<ul class="msgs">
				{#each data.messages as msg, i (i)}
					<li class:mine={msg.fromMe}>
						<span>{t(`bp_${msg.preset}`)}</span>
						<span class="small muted"
							>{msg.fromMe ? m.bv_from_you() : v.displayName} · {fmtDay(msg.at)}</span
						>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="card stack safety">
		<h2 class="h3">{m.bv_safety_title()}</h2>
		<details>
			<summary class="btn btn-secondary">{m.bv_report()}</summary>
			<form method="POST" action="?/report" class="stack">
				<fieldset class="field">
					<legend>{m.bv_report_what()}</legend>
					{#each [['photo', m.bv_report_photo()], ['bio', m.bv_report_bio()], ['behaviour', m.bv_report_behaviour()], ['other', m.bv_report_other()]] as [val, label] (val)}
						<label class="check"
							><input type="radio" name="what" value={val} required /> {label}</label
						>
					{/each}
				</fieldset>
				<div class="field">
					<label for="bv-note">{m.bv_report_note()}</label>
					<textarea id="bv-note" name="note" maxlength="300" rows="2"></textarea>
				</div>
				<button class="btn" type="submit">{m.bv_report_send()}</button>
			</form>
		</details>
		<form method="POST" action="?/block" class="stack">
			<p class="small muted">{m.bv_block_hint()}</p>
			<button class="btn btn-warn" type="submit">{m.bv_block()}</button>
		</form>
		<form method="POST" action="?/remove">
			<button class="btn-link" type="submit">{m.bv_remove()}</button>
		</form>
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
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.msgs {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.msgs li {
		display: flex;
		flex-direction: column;
		padding: 8px 12px;
		border-radius: 14px;
		background: var(--ice);
		align-self: flex-start;
		max-width: 85%;
	}
	.msgs li.mine {
		align-self: flex-end;
		background: #fff;
		border: 1px solid var(--border);
	}
	.safety summary {
		list-style: none;
		cursor: pointer;
		display: inline-flex;
	}
	.safety details[open] summary {
		margin-bottom: 12px;
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
	}
</style>
