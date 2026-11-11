<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	let { data, form } = $props();
</script>

<svelte:head><title>{m.on_students()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<h1>{m.on_students()}</h1>
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	<form method="GET" class="row" role="search">
		<input
			class="grow"
			name="q"
			value={data.q}
			placeholder={m.owner_search()}
			aria-label={m.owner_search()}
		/>
		<button class="btn btn-sm" type="submit">{m.find_show()}</button>
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
			<form method="POST" action="?/suspend">
				<input type="hidden" name="id" value={s.id} />
				<input type="hidden" name="suspend" value={s.suspendedAt ? 'false' : 'true'} />
				<button class="btn btn-secondary btn-sm" type="submit"
					>{s.suspendedAt ? m.owner_reactivate() : m.owner_suspend()}</button
				>
			</form>
		</div>
	{:else}
		<p class="empty">{m.none_yet()}</p>
	{/each}
</section>
