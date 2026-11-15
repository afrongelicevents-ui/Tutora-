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
	{#if data.done}<p class="notice" role="status">{t(data.done)}</p>{/if}

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
			{#if !tu.findable}
				<!-- warned before approving: students could not find this page yet -->
				<p class="small warn-t" role="note">
					{tu.activeSubjects ? m.owner_not_ready_name() : m.owner_not_ready_subjects()}
				</p>
			{/if}
			<div class="row">
				<form method="POST" action="?/status">
					<input type="hidden" name="id" value={tu.tutorId} /><input
						type="hidden"
						name="status"
						value="active"
					/><button class="btn btn-sm" type="submit" disabled={!tu.findable}
						>{m.owner_approve()}</button
					>
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
				{m.owner_counts2({
					students: tu.students,
					bookings: tu.bookings,
					accepted: tu.bookingsAccepted,
					payments: tu.payments,
					confirmed: tu.paymentsConfirmed
				})}
				· {tu.setupDone ? m.owner_setup_done() : m.owner_setup_not_done()} · {m.owner_plan({
					plan: tu.plan
				})}
			</p>
			{#if tu.status === 'active' && !tu.findable}
				<p class="small warn-t">{m.owner_not_findable()}</p>
			{/if}
			{#if tu.status === 'active'}
				<!-- two steps: suspending logs the tutor out at once -->
				<details
					class="small"
					open={!!(form && 'suspendFor' in form && form.suspendFor === tu.tutorId)}
				>
					<summary>{m.owner_suspend()}</summary>
					<form method="POST" action="?/status" class="stack">
						<input type="hidden" name="id" value={tu.tutorId} />
						<input type="hidden" name="status" value="suspended" />
						<p class="small">{m.owner_suspend_lead()}</p>
						<label class="check"
							><input type="checkbox" name="sure" /> <span>{m.owner_suspend_sure()}</span></label
						>
						<button class="btn btn-warn btn-sm" type="submit">{m.owner_suspend()}</button>
					</form>
				</details>
			{:else if tu.status === 'suspended'}
				<form method="POST" action="?/status">
					<input type="hidden" name="id" value={tu.tutorId} />
					<input type="hidden" name="status" value="active" /><button
						class="btn btn-sm"
						type="submit">{m.owner_reactivate()}</button
					>
				</form>
			{:else}
				<span class="small muted">{m.ev_owner_not_submitted()}</span>
			{/if}
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
		<Field
			id="add-name"
			name="name"
			label={m.owner_tutor_name()}
			value={av.name ?? ''}
			error={ae.name ? (ae.name === 'err_name' ? 'owner_err_tutor_name' : ae.name) : undefined}
			required
		/>
		<Field
			id="add-email"
			name="email"
			type="email"
			label={m.owner_tutor_email()}
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
		<Field
			id="reset-email"
			name="email"
			type="email"
			label={m.owner_reset_email()}
			error={form && 'resetError' in form ? (form.resetError as string) : undefined}
			required
		/>
		<button class="btn btn-secondary btn-block" type="submit">{m.owner_reset_btn()}</button>
	</form>

	{#if data.testSite}
		<h2>{m.owner_test_h()}</h2>
		<details class="card">
			<summary>{m.owner_test_reset()}</summary>
			<form method="POST" action="?/resetTest" class="stack">
				<p class="small">{m.owner_test_lead()}</p>
				<label class="check"
					><input type="checkbox" name="sure" /> <span>{m.owner_test_sure()}</span></label
				>
				<button class="btn btn-warn btn-block" type="submit">{m.owner_test_reset()}</button>
			</form>
		</details>
	{/if}

	<p style="margin-top:16px"><a href="/owner/account">{m.owner_my_account()}</a></p>
</section>
