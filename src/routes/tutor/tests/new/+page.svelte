<script lang="ts">
	import { onMount } from 'svelte';
	import { m, t } from '#lib/i18n.ts';
	let { data, form } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
	let subject = $state('');
	let form_ = $state('');
	let picked = $state<string[]>([]);
	const chapters = $derived(
		data.tags.chapters.filter(
			(c) =>
				(!subject || c.subject.toLowerCase() === subject.toLowerCase()) &&
				(!form_ || (c.form ?? '').toLowerCase() === form_.toLowerCase())
		)
	);
	// several forms can share a chapter name: add their counts together
	const byName = $derived([
		...chapters.reduce(
			(acc, c) => acc.set(c.chapter, (acc.get(c.chapter) ?? 0) + c.n),
			new Map<string, number>()
		)
	]);
	const available = $derived(
		byName.filter(([c]) => !picked.length || picked.includes(c)).reduce((s, [, n]) => s + n, 0)
	);
</script>

<svelte:head><title>{m.qb_build_title()} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/tutor/assessments" aria-label={m.st5_tutor_title()}>‹</a>
	<h1>{m.qb_build_title()}</h1>
	<p class="lead">{m.qb_build_lead()}</p>
	{#if form?.error}
		<p class="alert" role="alert">
			{form.error === 'qb_err_not_enough'
				? m.qb_err_not_enough_n({ n: form.n ?? 0 })
				: t(form.error)}
		</p>
	{/if}

	{#if !data.tags.subjects.length}
		<div class="ui-card sky">
			<p>{m.qb_build_empty()}</p>
			<p><a class="ui-btn" href="/tutor/bank">{m.qb_go_bank()}</a></p>
		</div>
	{:else}
		<form method="POST" class="stack" data-ready={ready || undefined}>
			<div class="field">
				<label for="b-title">{m.qb_test_name()}</label>
				<input
					id="b-title"
					name="title"
					required
					maxlength="120"
					placeholder={m.qb_test_name_ph()}
				/>
			</div>
			<div class="row2">
				<div class="field">
					<label for="b-subject">{m.qb_subject()}</label>
					<select id="b-subject" name="subject" required bind:value={subject}>
						<option value="" disabled>{m.qb_choose()}</option>
						{#each data.tags.subjects as s (s)}<option value={s}>{s}</option>{/each}
					</select>
				</div>
				<div class="field">
					<label for="b-form">{m.qb_form()}</label>
					<select id="b-form" name="form" bind:value={form_}>
						<option value="">{m.qb_any()}</option>
						{#each data.tags.forms as s (s)}<option value={s}>{s}</option>{/each}
					</select>
				</div>
			</div>
			<fieldset class="chaps">
				<legend class="label">{m.qb_chapters()}</legend>
				<span class="hint">{m.qb_chapters_hint()}</span>
				{#if subject}
					<div class="chips">
						{#each byName as [c, n] (c)}
							<label class="chip"
								><input type="checkbox" name="chapters" value={c} bind:group={picked} />
								{c} <span class="small muted">({n})</span></label
							>
						{/each}
					</div>
					<span class="small muted">{m.qb_available({ n: available })}</span>
				{:else}
					<span class="small muted">{m.qb_pick_subject()}</span>
				{/if}
			</fieldset>
			<div class="row2">
				<div class="field">
					<label for="b-count">{m.qb_how_many()}</label>
					<input id="b-count" name="count" type="number" min="1" max="40" required value="10" />
				</div>
				<div class="field">
					<label for="b-term">{m.qb_term()}</label>
					<select id="b-term" name="term">
						<option value="">{m.qb_term_auto()}</option>
						{#each ['Term 1', 'Term 2', 'Term 3'] as tm (tm)}<option value={tm}>{tm}</option>{/each}
					</select>
				</div>
			</div>
			<details class="more">
				<summary>{m.qb_mix()}</summary>
				<p class="hint">{m.qb_mix_hint()}</p>
				<div class="row3">
					{#each ['easy', 'medium', 'hard'] as d (d)}
						<div class="field">
							<label for="b-{d}">{t(`qb_diff_${d}`)}</label>
							<input id="b-{d}" name={d} type="number" min="0" max="40" placeholder="0" />
						</div>
					{/each}
				</div>
			</details>
			<div class="field">
				<label for="b-timer">{m.qb_timer()}</label>
				<input
					id="b-timer"
					name="timer"
					type="number"
					min="1"
					max="180"
					placeholder={m.qb_no_timer()}
				/>
				<span class="hint">{m.qb_timer_hint()}</span>
			</div>
			<fieldset class="chaps">
				<legend class="label">{m.qb_give_to()}</legend>
				{#if data.students.length}
					<div class="chips">
						{#each data.students as s (s.id)}
							<label class="chip"
								><input type="checkbox" name="students" value={s.id} /> {s.name}</label
							>
						{/each}
					</div>
					<span class="hint">{m.qb_give_hint()}</span>
				{:else}
					<span class="small muted">{m.st5_no_students()}</span>
				{/if}
			</fieldset>
			<div class="field">
				<label for="b-due">{m.st5_due_opt()}</label>
				<input id="b-due" name="dueOn" type="date" min={data.today} />
			</div>
			<button class="btn btn-block" type="submit">{m.qb_build_btn()}</button>
		</form>
	{/if}
</div>

<style>
	.row2,
	.row3 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.row3 {
		grid-template-columns: 1fr 1fr 1fr;
	}
	.chaps {
		border: 0;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.chaps legend {
		padding: 0;
	}
	.more summary {
		cursor: pointer;
		font-weight: 600;
		color: var(--ocean);
		min-height: 44px;
		display: flex;
		align-items: center;
	}
</style>
