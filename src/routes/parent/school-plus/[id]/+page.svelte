<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDayTime } from '#lib/tz.ts';
	let { data, form } = $props();
	const p = $derived(data.p);
	const live = $derived(['requested', 'school_invited', 'active'].includes(p.status));
</script>

<svelte:head><title>{m.sp3_title()} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/parent/school-plus" aria-label={m.v3_back()}>←</a>
	<span class="eyebrow">{t(`sp3_status_${p.status}`)}</span>
	<h1>{p.subject} · {p.schoolName}</h1>
	<p class="lead">{m.sp3_with_teacher({ teacher: p.teacherName })}</p>
	{#if form?.stopped}<p class="notice" role="status">{m.sp3_stopped_done()}</p>{/if}
	<details class="softcard">
		<summary
			><strong
				>{m.sp3_consent_signed({ name: p.consentName, when: fmtDayTime(p.consentAt) })}</strong
			></summary
		>
		<p class="small">{p.consentText}</p>
	</details>
	<section>
		<div class="section-h"><h2>{m.sp3_log()}</h2></div>
		<div class="rows">
			{#each data.log as l (l.id)}
				<div class="logrow">
					<span class="muted tiny"
						>{fmtDayTime(l.createdAt)} · {l.fromName} ({t(`sp3_role_${l.fromRole}`)})</span
					>
					<span class:event={l.kind === 'event'} class="prewrap">{l.body}</span>
				</div>
			{/each}
		</div>
	</section>
	{#if live}
		<form
			method="POST"
			action="?/stop"
			onsubmit={(e) => {
				if (!confirm(m.sp3_stop_confirm())) e.preventDefault();
			}}
		>
			<button class="btn btn-warn btn-block" type="submit">{m.sp3_stop()}</button>
		</form>
		<p class="note">{m.sp3_stop_note()}</p>
	{/if}
</div>

<style>
	h1 {
		margin: 0;
		font-size: 1.625rem;
	}
	.logrow {
		flex-direction: column;
		align-items: flex-start !important;
		gap: 2px !important;
	}
	.tiny {
		font-size: 0.75rem;
	}
	.event {
		color: var(--muted);
		font-style: italic;
	}
	summary {
		cursor: pointer;
	}
</style>
