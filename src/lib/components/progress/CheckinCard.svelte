<script lang="ts">
	// Learning check-in. Tap a feeling → a response card right away (an encouraging message and
	// one small next step, both from the reviewed list in checkin-copy.ts), "Share with my
	// parent?" (remembered), an optional subject + short note. Later: "How did it go?".
	import { m, t } from '#lib/i18n.ts';
	import { CHECKIN_MOODS } from '#lib/checkin-moods.ts';
	import { NEXT_STEP, followupKey, responseKey, type Mood } from '#lib/checkin-copy.ts';
	interface Ck {
		start: {
			id: number;
			mood: string;
			shared: boolean;
			subject: string | null;
			note: string | null;
			planSubject: string | null;
		} | null;
		followup: { id: number; mood: string; shared: boolean } | null;
		askFollowup: boolean;
		studying: string | null;
	}
	let {
		family,
		ck,
		talk = false,
		form
	}: {
		/** labels of active family members (who would see a shared check-in) */
		family: string[];
		ck: Ck;
		/** gently suggest talking to someone (3 tough days in a row) */
		talk?: boolean;
		form: Record<string, unknown> | null | undefined;
	} = $props();

	const names = $derived(
		family.length <= 1
			? (family[0] ?? '')
			: `${family.slice(0, -1).join(', ')} ${m.and_word()} ${family.at(-1)}`
	);
	const start = $derived(ck.start);
	const mood = $derived(start?.mood as Mood | undefined);
	const step = $derived(mood ? NEXT_STEP[mood] : null);
	// the check-in the share question is about: the follow-up if there is one
	const current = $derived(ck.followup ?? start);
</script>

<section class="softcard checkin" id="checkin">
	{#if talk}
		<div class="talk" role="note">
			<strong>{m.hn_title()}</strong>
			<p>{m.hn_body()}</p>
			<a class="btn" href="/student/talk">{m.hn_talk()}</a>
		</div>
	{/if}

	{#if !start}
		<!-- 1. the question -->
		<strong>{m.sh_checkin_q()}</strong>
		<form method="POST" action="?/checkin" class="chips">
			{#each CHECKIN_MOODS as md (md)}
				<button class="chip" type="submit" name="mood" value={md}>{t(`ci_${md}`)}</button>
			{/each}
		</form>
	{:else}
		<!-- 2. the response card -->
		<div class="resp" role="status">
			<span class="feel"
				>{t(`ci_${start.mood}`)}{#if ck.followup}
					→ {t(`ci_${ck.followup.mood}`)}{/if}</span
			>
			{#if ck.followup}
				<p class="msg">{t(followupKey(ck.followup.mood as Mood))}</p>
			{:else}
				<p class="msg">
					{t(responseKey(mood!, !!start.planSubject), { subject: start.planSubject ?? '' })}
				</p>
				{#if step}
					<div class="step">
						<span class="lbl">{m.cs_label()}</span>
						<span class="what">{t(step.key)}</span>
						{#if step.href}<a class="go" href={step.href}>{m.cs_go()} →</a>{/if}
					</div>
				{/if}
			{/if}

			{#if family.length && current}
				<form method="POST" action="?/shareAnswer" class="share">
					<input type="hidden" name="id" value={current.id} />
					<span>{m.ck_share_q()}</span>
					<span class="yn">
						<button
							class="yn-b"
							class:on={current.shared}
							type="submit"
							name="answer"
							value="yes"
							aria-pressed={current.shared}>{m.ck_yes()}</button
						><button
							class="yn-b"
							class:on={!current.shared}
							type="submit"
							name="answer"
							value="no"
							aria-pressed={!current.shared}>{m.ck_no()}</button
						>
					</span>
				</form>
				<span class="small muted"
					>{current.shared ? m.ck_shared_yes({ names }) : m.ck_shared_no()}</span
				>
			{:else if !family.length}
				<span class="small muted">{m.sh_checkin_saved()} {m.sh_no_family_note()}</span>
			{/if}
			<span class="small muted">{m.ck_tutor_sees()}</span>
		</div>

		<!-- 3. what they're studying + an optional short note -->
		{#if !ck.followup}
			<details class="note" open={!!form?.noteSaved}>
				<summary>{m.ck_note_label()}</summary>
				<form method="POST" action="?/note" class="stack-s">
					<input type="hidden" name="id" value={start.id} />
					<label class="field"
						><span>{m.ck_subject_label()}</span><input
							name="subject"
							maxlength="60"
							value={start.subject ?? ck.studying ?? ''}
						/></label
					>
					<label class="field"
						><span class="sr-only">{m.ck_note_label()}</span><textarea
							name="note"
							maxlength="200"
							rows="2"
							aria-describedby="ck-note-h">{start.note ?? ''}</textarea
						></label
					>
					<span class="small muted" id="ck-note-h">{m.ck_note_hint()}</span>
					<button class="btn btn-secondary" type="submit">{m.ck_save_note()}</button>
					{#if form?.noteSaved}<span class="small ocean-t" role="status">{m.ck_note_saved()}</span
						>{/if}
				</form>
			</details>
		{/if}

		<!-- 4. later the same day: "How did it go?" -->
		{#if ck.askFollowup}
			<div class="fu">
				<strong>{m.ck_followup_q()}</strong>
				<span class="small muted">{m.ck_followup_lead({ mood: t(`ci_${start.mood}`) })}</span>
				<form method="POST" action="?/checkin" class="chips">
					<input type="hidden" name="followupOf" value={start.id} />
					{#each CHECKIN_MOODS as md (md)}
						<button class="chip" type="submit" name="mood" value={md}>{t(`ci_${md}`)}</button>
					{/each}
				</form>
			</div>
		{/if}

		<a class="days" href="/student/days">{m.ck_my_days()} →</a>
	{/if}
</section>

<style>
	.checkin {
		gap: 12px;
	}
	.stack-s {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.resp {
		display: flex;
		flex-direction: column;
		gap: 10px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 18px;
		padding: 14px;
	}
	.feel {
		align-self: flex-start;
		background: var(--ice);
		color: var(--navy);
		font-weight: 700;
		font-size: 0.8125rem;
		border-radius: 99px;
		padding: 4px 12px;
	}
	.msg {
		margin: 0;
		font-size: 1.0625rem;
		line-height: 1.45;
		color: var(--navy);
	}
	.step {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 10px;
		background: var(--snow);
		border-radius: 14px;
		padding: 10px 12px;
	}
	.step .lbl {
		width: 100%;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted);
	}
	.step .what {
		flex: 1;
		font-weight: 600;
		color: var(--text);
	}
	.go {
		font-weight: 700;
		color: var(--ocean);
		text-decoration: none;
		padding: 6px 0;
	}
	.share {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		flex-wrap: wrap;
		font-weight: 600;
	}
	.yn {
		display: inline-flex;
		border: 1.5px solid var(--navy);
		border-radius: 99px;
		overflow: hidden;
	}
	.yn-b {
		min-width: 64px;
		min-height: 40px;
		border: 0;
		background: #fff;
		color: var(--navy);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}
	.yn-b.on {
		background: var(--navy);
		color: #fff;
	}
	.note summary {
		cursor: pointer;
		color: var(--ocean);
		font-weight: 600;
		min-height: 44px;
		display: flex;
		align-items: center;
	}
	.fu {
		display: flex;
		flex-direction: column;
		gap: 8px;
		border-top: 1px solid var(--border);
		padding-top: 12px;
	}
	.talk {
		display: flex;
		flex-direction: column;
		gap: 6px;
		background: #fff;
		border: 1px solid var(--border);
		border-left: 4px solid var(--ocean);
		border-radius: 14px;
		padding: 12px 14px;
	}
	.talk p {
		margin: 0;
		color: var(--text);
		line-height: 1.45;
	}
	.talk .btn {
		align-self: flex-start;
	}
	.days {
		align-self: flex-start;
		font-weight: 600;
		color: var(--ocean);
		padding: 6px 0;
	}
	.ocean-t {
		color: var(--ocean);
	}
</style>
