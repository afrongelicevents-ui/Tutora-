<script lang="ts">
	import Field from '#lib/components/Field.svelte';
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	let { data, form } = $props();
	const ae = $derived(
		((form && 'addErrors' in form ? form.addErrors : {}) ?? {}) as Record<string, string>
	);
	const av = $derived(
		((form && 'values' in form ? form.values : {}) ?? {}) as Record<string, string>
	);
	const statusLabel = (s: string) =>
		({
			pending: m.owner_pending(),
			active: m.owner_active(),
			suspended: m.owner_suspended(),
			draft: m.owner_draft(),
			rejected: m.owner_rejected()
		})[s] ?? s;
	const pending = $derived(data.tutors.filter((x) => x.status === 'pending'));
	const others = $derived(data.tutors.filter((x) => x.status !== 'pending'));
</script>

<svelte:head><title>{m.nav_owner()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<h1>{m.nav_owner()}</h1>
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if form?.done}<p class="notice" role="status">{t(form.done)}</p>{/if}

	<div class="money3">
		<div><b>{data.counts.tutors}</b><span>{m.owner_tutors()}</span></div>
		<div><b>{data.counts.pending}</b><span>{m.owner_waiting()}</span></div>
		<div><b>{data.counts.students}</b><span>{m.owner_students()}</span></div>
	</div>

	<h2>{m.owner_to_approve()}</h2>
	{#each pending as tu (tu.tutorId)}
		<div class="card">
			<b>{tu.name ?? '—'}</b>
			<p class="small muted">{tu.email} · {m.owner_joined({ date: fmtDay(tu.createdAt) })}</p>
			{#if !tu.emailConfirmed}<p class="small">{m.owner_check_email()}</p>{/if}
			<div class="row">
				<form method="POST" action="?/status">
					<input type="hidden" name="id" value={tu.tutorId} /><input
						type="hidden"
						name="status"
						value="active"
					/><button class="btn btn-sm" type="submit">{m.owner_approve()}</button>
				</form>
				<a class="btn btn-secondary btn-sm" href="/t/{tu.slug}?preview=1"
					>{m.owner_view_profile()}</a
				>
			</div>
			<details class="small">
				<summary>{m.owner_refuse()}</summary>
				<form method="POST" action="?/reject" class="stack">
					<input type="hidden" name="id" value={tu.tutorId} />
					<label for="why-{tu.tutorId}">{m.owner_reject_why()}</label>
					<input id="why-{tu.tutorId}" name="reason" maxlength="500" required />
					<button class="btn btn-warn btn-sm" type="submit">{m.owner_reject_send()}</button>
				</form>
			</details>
		</div>
	{:else}
		<p class="empty">{m.owner_none_waiting()}</p>
	{/each}

	<h2>{m.owner_all_tutors()}</h2>
	{#each others as tu (tu.tutorId)}
		<div class="card">
			<div class="row">
				<b class="grow">{tu.name ?? '—'}</b>
				<span class="pill {tu.status === 'active' ? 'p-ok' : 'p-no'}">{statusLabel(tu.status)}</span
				>
			</div>
			<p class="small muted">
				{tu.email}{#if tu.status === 'active'}
					· <a href="/t/{tu.slug}">/t/{tu.slug}</a>{/if}
			</p>
			<p class="small">
				{m.owner_counts({ students: tu.students, lessons: tu.lessons, payments: tu.payments })}
				· {tu.setupDone ? m.owner_setup_done() : m.owner_setup_not_done()} · {m.owner_plan({
					plan: tu.plan
				})}
			</p>
			<form method="POST" action="?/status">
				<input type="hidden" name="id" value={tu.tutorId} />
				{#if tu.status === 'active'}<input type="hidden" name="status" value="suspended" /><button
						class="btn btn-secondary btn-sm"
						type="submit">{m.owner_suspend()}</button
					>{:else}<input type="hidden" name="status" value="active" /><button
						class="btn btn-sm"
						type="submit">{m.owner_reactivate()}</button
					>{/if}
			</form>
		</div>
	{:else}
		<p class="empty">{m.owner_no_tutors()}</p>
	{/each}

	<h2>{m.owner_add_tutor()}</h2>
	{#if form && 'added' in form && form.added}
		<p class="notice" role="status">
			{m.owner_added({
				name: form.added.name,
				email: form.added.email,
				password: form.added.password
			})}
		</p>
	{/if}
	<form method="POST" action="?/addTutor" class="card stack" novalidate>
		<p class="small muted">{m.owner_add_lead()}</p>
		<Field name="name" label={m.set_name()} value={av.name ?? ''} error={ae.name} required />
		<Field
			name="email"
			type="email"
			label={m.field_email()}
			value={av.email ?? ''}
			error={ae.email}
			required
		/>
		<button class="btn btn-block" type="submit">{m.owner_add_tutor()}</button>
	</form>

	<h2>{m.owner_reset_h()}</h2>
	{#if form && 'reset' in form && form.reset}
		<p class="notice" role="status">
			{m.owner_reset_done({ name: form.reset.name, password: form.reset.password })}
		</p>
	{/if}
	<form method="POST" action="?/resetStudent" class="card stack" novalidate>
		<p class="small muted">{m.owner_reset_lead()}</p>
		<Field name="email" type="email" label={m.field_email()} required />
		<button class="btn btn-secondary btn-block" type="submit">{m.owner_reset_btn()}</button>
	</form>

	{#if data.testSite}
		<h2>{m.owner_test_h()}</h2>
		<form method="POST" action="?/resetTest" class="card stack">
			<p class="small">{m.owner_test_lead()}</p>
			<button class="btn btn-warn btn-block" type="submit">{m.owner_test_reset()}</button>
		</form>
	{/if}

	<p style="margin-top:16px"><a href="/owner/account">{m.owner_my_account()}</a></p>
</section>
