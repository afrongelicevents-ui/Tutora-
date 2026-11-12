<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import MaterialList from '#lib/components/tools/MaterialList.svelte';
	import DrivePickButton from '#lib/components/tools/DrivePickButton.svelte';
	import type { PageData } from './$types';
	type Res = PageData['resources'][number];
	let { data, form } = $props();
	const share = $derived(form && 'share' in form ? (form.share as string) : null);
	let subjectName = $state('');
	let level = $state('');
	let studentId = $state('');
	let kind = $state<'link' | 'kahoot'>('link');
	const groups = $derived.by(() => {
		const out: Record<string, Res[]> = {};
		for (const r of data.resources) (out[r.subject] ??= []).push(r);
		return Object.entries(out);
	});
	const forWhom = (r: Res) => r.studentName ?? m.tools6_all_students();
</script>

<svelte:head><title>{m.tools6_res_title()} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/tutor/more" aria-label={m.tools6_back()}>←</a>
	<h1>{m.tools6_res_title()}</h1>
	<p class="lead">{m.tools6_res_lead()}</p>
	{#if form && 'error' in form && form.error}<p class="alert" role="alert">
			{t(form.error as string)}
		</p>{/if}
	{#if form && 'added' in form && share !== 'failed'}<p class="notice" role="status">
			{share === 'skipped' ? m.tools6_drive_share_yourself() : m.saved()}
		</p>{/if}
	{#if share === 'failed'}<p class="alert" role="alert">{m.tools6_drive_share_failed()}</p>{/if}

	<section class="block">
		<div class="section-h"><h2>{m.tools6_res_add()}</h2></div>
		<label class="field"
			><span class="label">{m.tools6_subject()}</span><input
				bind:value={subjectName}
				list="res-subjects"
				maxlength="60"
				required
			/></label
		>
		<datalist id="res-subjects">
			{#each data.subjects as s (s)}<option value={s}></option>{/each}
		</datalist>
		<label class="field"
			><span class="label">{m.tools6_level()}</span><input
				bind:value={level}
				maxlength="40"
				placeholder={m.tools6_level_ph()}
			/></label
		>
		<label class="field"
			><span class="label">{m.tools6_for_whom()}</span>
			<select bind:value={studentId}>
				<option value="">{m.tools6_all_students()}</option>
				{#each data.students as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
			</select></label
		>
		{#if subjectName.trim()}
			<DrivePickButton
				config={data.picker}
				action="?/attachDrive"
				fields={{ subject: subjectName, level, studentId }}
			/>
		{:else if data.picker}
			<p class="note">{m.tools6_res_subject_first()}</p>
		{/if}
		{#if !data.picker}<p class="note">{m.tools6_drive_connect_hint()}</p>{/if}
		<form method="POST" action="?/addLink" class="stack">
			<input type="hidden" name="subject" value={subjectName} />
			<input type="hidden" name="level" value={level} />
			<input type="hidden" name="studentId" value={studentId} />
			{#if data.kahootOn}
				<div class="chips" role="radiogroup" aria-label={m.tools6_kind()}>
					<label class="chip"
						><input
							type="radio"
							name="kind"
							value="link"
							bind:group={kind}
						/>{m.tools6_src_link()}</label
					>
					<label class="chip"
						><input type="radio" name="kind" value="kahoot" bind:group={kind} />Kahoot!</label
					>
				</div>
			{:else}
				<input type="hidden" name="kind" value="link" />
			{/if}
			<label class="field"
				><span class="label">{m.tools6_link_title()}</span><input
					name="title"
					maxlength="160"
					required
				/></label
			>
			<label class="field"
				><span class="label">{m.tools6_link_url()}</span><input
					name="url"
					type="url"
					inputmode="url"
					maxlength="2000"
					required
					placeholder={kind === 'kahoot' ? 'https://create.kahoot.it/…' : 'https://…'}
				/></label
			>
			<button class="btn btn-sm" type="submit" disabled={!subjectName.trim()}
				>{m.tools6_add()}</button
			>
		</form>
	</section>

	{#each groups as [subj, items] (subj)}
		<section class="block">
			<div class="section-h"><h2>{subj}</h2></div>
			<MaterialList
				items={items.map((r: Res) => ({
					...r,
					title: `${r.title} · ${forWhom(r)}${r.level ? ` · ${r.level}` : ''}`
				}))}
				removeAction="?/remove"
			/>
		</section>
	{:else}
		<p class="note">{m.tools6_res_none()}</p>
	{/each}
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
		align-items: flex-start;
	}
	.stack .field,
	.block > .field {
		width: 100%;
	}
	select {
		min-height: 44px;
		border: 1.5px solid #a08ca6;
		border-radius: 14px;
		padding: 0 12px;
		background: var(--white);
		font: inherit;
	}
</style>
