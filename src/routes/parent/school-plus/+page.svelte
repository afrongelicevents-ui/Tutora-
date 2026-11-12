<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	let { data, form } = $props();
	const v = $derived(
		((form as { values?: Record<string, string> } | null)?.values ?? {}) as Record<string, string>
	);
	let child = $state('');
	$effect.pre(() => {
		if (!child) child = v.child ?? data.kids[0]?.id ?? '';
	});
	const tutors = $derived(data.tutors.find((x) => x.childId === child)?.list ?? []);
	const kid = $derived(data.kids.find((k) => k.id === child));
	const statusText = (s: string) => t(`sp3_status_${s}`);
</script>

<svelte:head><title>{m.v3_nav_schoolplus()} · Tutora</title></svelte:head>

<div class="screen wide-2">
	<div class="stackish">
		<span class="eyebrow">{m.sp3_premium()}</span>
		<h1>{m.sp3_title()}</h1>
		<p class="lead">{m.sp3_lead()}</p>
		<div class="rows">
			<div>{m.sp3_b1()}</div>
			<div>{m.sp3_b2()}</div>
			<div>{m.sp3_b3()}</div>
			<div>{m.sp3_b4()}</div>
		</div>
		<span class="small muted">{m.sp3_price()}</span>

		{#each data.partnerships as p (p.id)}
			<a class="card prow" href="/parent/school-plus/{p.id}">
				<span
					><strong>{p.child} · {p.subject}</strong><span class="small muted block"
						>{p.school} · {p.teacher}{p.tutor ? ` · ${p.tutor}` : ''}</span
					></span
				>
				<span
					class="pill {p.status === 'active'
						? 'p-ok'
						: p.status === 'stopped' || p.status === 'declined'
							? 'p-info'
							: 'p-wait'}">{statusText(p.status)}</span
				>
			</a>
		{/each}
	</div>

	<section class="side stackish">
		<div class="section-h"><h2>{m.sp3_request()}</h2></div>
		{#if (form as { error?: string } | null)?.error}<p class="alert" role="alert">
				{t((form as { error: string }).error)}
			</p>{/if}
		{#if !data.kids.length}
			<p class="note">{m.par_no_children()}</p>
		{:else}
			<form method="POST" action="?/request" class="stack">
				<label class="field"
					><span class="label">{m.sp3_child()}</span>
					<select name="child" bind:value={child}>
						{#each data.kids as k (k.id)}<option value={k.id}>{k.name}</option>{/each}
					</select>
				</label>
				{#if kid && !kid.canConsent}<p class="note">{m.sp3_err_guardian()}</p>{/if}
				{#if tutors.length}
					<label class="field"
						><span class="label">{m.sp3_tutor()}</span>
						<select name="tutor"
							>{#each tutors as tu (tu.id)}<option value={tu.id} selected={v.tutor === tu.id}
									>{tu.name}</option
								>{/each}</select
						>
					</label>
					<label class="field"
						><span class="label">{m.sw3_subject()}</span><input
							name="subject"
							required
							maxlength="60"
							value={v.subject ?? ''}
						/></label
					>
					<label class="field"
						><span class="label">{m.sw3_school()}</span><input
							name="school"
							required
							maxlength="120"
							value={v.school ?? ''}
						/></label
					>
					<label class="field"
						><span class="label">{m.sp3_teacher()}</span><input
							name="teacher"
							required
							maxlength="80"
							value={v.teacher ?? ''}
						/></label
					>
					<label class="field"
						><span class="label">{m.sp3_teacher_email()}</span><input
							name="teacherEmail"
							type="email"
							maxlength="254"
							value={v.teacherEmail ?? ''}
						/></label
					>
					<div class="softcard small">
						<strong>{m.sp3_consent_h()}</strong>
						<span>{m.sp3_consent_text()}</span>
					</div>
					<label class="check"
						><input type="checkbox" name="consent" required />
						<span>{m.sp3_consent_check()}</span></label
					>
					<label class="field"
						><span class="label">{m.sp3_sign()}</span><input
							name="consentName"
							required
							maxlength="80"
							autocomplete="name"
							value={v.consentName ?? ''}
						/></label
					>
					<button class="btn btn-block" type="submit" disabled={kid && !kid.canConsent}
						>{m.sp3_request_btn()}</button
					>
				{:else}
					<p class="note">{m.sp3_no_tutor()}</p>
				{/if}
			</form>
		{/if}
	</section>
</div>

<style>
	h1 {
		margin: 0;
		font-size: 1.875rem;
	}
	.stackish {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.prow {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		color: var(--text);
		text-decoration: none;
	}
	.block {
		display: block;
	}
	select {
		min-height: 48px;
	}
</style>
