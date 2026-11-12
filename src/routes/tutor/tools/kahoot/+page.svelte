<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	let { data, form } = $props();
	const players = $derived(form && 'players' in form ? form.players : null);
</script>

<svelte:head><title>{m.tools6_kahoot_title()} · Tutora</title></svelte:head>

{#snippet details(prefix: string)}
	<label class="field"
		><span class="label">{m.tools6_subject()}</span><input
			name="subject"
			list="{prefix}-subjects"
			maxlength="60"
			required
		/></label
	>
	<datalist id="{prefix}-subjects">
		{#each data.subjects as s (s)}<option value={s}></option>{/each}
	</datalist>
	<label class="field"
		><span class="label">{m.tools6_topic()}</span><input
			name="topic"
			maxlength="80"
			required
			placeholder={m.tools6_topic_ph()}
		/></label
	>
	<label class="field"
		><span class="label">{m.tools6_quiz_title()}</span><input
			name="title"
			maxlength="120"
			required
			placeholder={m.tools6_quiz_title_ph()}
		/></label
	>
	<label class="field"
		><span class="label">{m.tools6_played_on()}</span><input
			name="takenOn"
			type="date"
			value={data.today}
			max={data.today}
		/></label
	>
{/snippet}

<div class="screen">
	<a class="back" href="/tutor/tools" aria-label={m.tools6_back()}>←</a>
	<h1>{m.tools6_kahoot_title()}</h1>
	<p class="lead">{m.tools6_kahoot_lead()}</p>
	{#if form && 'error' in form && form.error}<p class="alert" role="alert">
			{t(form.error as string)}
		</p>{/if}
	{#if form && 'savedCount' in form}<p class="notice" role="status">
			{m.tools6_kahoot_saved({ n: form.savedCount as number })}
		</p>{/if}

	{#if players}
		<section class="block">
			<div class="section-h"><h2>{m.tools6_kahoot_match()}</h2></div>
			<p class="note">
				{m.tools6_kahoot_match_lead({
					file: form && 'fileName' in form ? String(form.fileName) : ''
				})}
			</p>
			<form method="POST" action="?/save" class="stack">
				<input type="hidden" name="count" value={players.length} />
				<ul class="rows top players">
					{#each players as p, i (i)}
						<li>
							<div class="who">
								<strong>{p.player}</strong>
								<span class="small muted"
									>{m.tools6_kahoot_score({
										correct: p.correct,
										total: p.correct + p.incorrect
									})}</span
								>
							</div>
							<input type="hidden" name="correct_{i}" value={p.correct} />
							<input type="hidden" name="incorrect_{i}" value={p.incorrect} />
							<select
								name="student_{i}"
								aria-label={m.tools6_kahoot_who({ player: p.player })}
								value={p.match}
							>
								<option value="">{m.tools6_kahoot_skip()}</option>
								{#each data.students as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
							</select>
						</li>
					{/each}
				</ul>
				{@render details('save')}
				<button class="btn btn-block" type="submit">{m.tools6_kahoot_confirm()}</button>
			</form>
		</section>
	{:else}
		<section class="block">
			<div class="section-h"><h2>{m.tools6_kahoot_upload()}</h2></div>
			<ol class="steps small">
				<li>{m.tools6_kahoot_step1()}</li>
				<li>{m.tools6_kahoot_step2()}</li>
				<li>{m.tools6_kahoot_step3()}</li>
			</ol>
			<form method="POST" action="?/parse" enctype="multipart/form-data" class="stack">
				<label class="field"
					><span class="label">{m.tools6_kahoot_file()}</span><input
						type="file"
						name="report"
						required
						accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
					/></label
				>
				<p class="note">{m.tools6_kahoot_file_note()}</p>
				<button class="btn" type="submit">{m.tools6_kahoot_read()}</button>
			</form>
		</section>
	{/if}

	<details class="block manual">
		<summary>{m.tools6_kahoot_manual()}</summary>
		<form method="POST" action="?/manual" class="stack">
			<label class="field"
				><span class="label">{m.tools6_student()}</span>
				<select name="studentId" required>
					<option value="">{m.tools6_choose()}</option>
					{#each data.students as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
				</select></label
			>
			<div class="pair">
				<label class="field"
					><span class="label">{m.tools6_correct()}</span><input
						name="correct"
						type="number"
						min="0"
						max="1000"
						inputmode="numeric"
						required
					/></label
				>
				<label class="field"
					><span class="label">{m.tools6_questions()}</span><input
						name="total"
						type="number"
						min="1"
						max="1000"
						inputmode="numeric"
						required
					/></label
				>
			</div>
			{@render details('manual')}
			<button class="btn btn-ghost" type="submit">{m.tools6_kahoot_add_score()}</button>
		</form>
	</details>

	<p class="note">{m.tools6_kahoot_no_api()}</p>
</div>

<style>
	.block {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.players li {
		flex-wrap: wrap;
	}
	.who {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	select {
		min-height: 44px;
		border: 1.5px solid var(--border-strong);
		border-radius: 14px;
		padding: 0 12px;
		background: var(--white);
		font: inherit;
		max-width: 100%;
	}
	.steps {
		margin: 0;
		padding-left: 20px;
		line-height: 1.6;
	}
	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.manual summary {
		cursor: pointer;
		font-weight: 600;
		color: var(--ocean);
		min-height: 44px;
		display: flex;
		align-items: center;
	}
</style>
