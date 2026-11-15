<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	let { data, form } = $props();
</script>

<svelte:head><title>{m.on_students()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<h1>{m.on_students()}</h1>
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if data.done}<p class="notice" role="status">{t(data.done)}</p>{/if}
	<form method="GET" class="row" role="search">
		<input
			class="grow"
			name="q"
			value={data.q}
			placeholder={m.owner_search()}
			aria-label={m.owner_search()}
		/>
		<button class="btn btn-sm" type="submit">{m.owner_search_btn()}</button>
	</form>
	{#each data.students as s (s.id)}
		<div class="card">
			<div class="row">
				<b class="grow">{s.name}</b>
				<span class="pill {s.suspendedAt ? 'p-no' : 'p-ok'}"
					>{s.suspendedAt
						? m.owner_suspended()
						: s.role === 'parent'
							? m.role_parent()
							: m.role_student()}</span
				>
			</div>
			<p class="small muted">{s.email}{s.phone ? ` · ${s.phone}` : ''} · {fmtDay(s.createdAt)}</p>
			{#if s.suspendedAt}
				<form method="POST" action="?/suspend">
					<input type="hidden" name="id" value={s.id} />
					<input type="hidden" name="suspend" value="false" />
					<button class="btn btn-secondary btn-sm" type="submit">{m.owner_reactivate()}</button>
				</form>
			{:else}
				<!-- two steps: suspending logs them out at once -->
				<details class="small" open={!!(form && 'suspendFor' in form && form.suspendFor === s.id)}>
					<summary>{m.owner_suspend()}</summary>
					<form method="POST" action="?/suspend" class="stack">
						<input type="hidden" name="id" value={s.id} />
						<input type="hidden" name="suspend" value="true" />
						<p class="small">{m.owner_suspend_student_lead()}</p>
						<label class="check"
							><input type="checkbox" name="sure" /> <span>{m.owner_suspend_sure()}</span></label
						>
						<button class="btn btn-warn btn-sm" type="submit">{m.owner_suspend()}</button>
					</form>
				</details>
			{/if}
		</div>
	{:else}
		<p class="empty">{data.q ? m.owner_search_none({ q: data.q }) : m.none_yet()}</p>
	{/each}
</section>
