<script lang="ts">
	import Head from '#lib/components/owner/Head.svelte';
	import Flash from '#lib/components/owner/Flash.svelte';
	import Filters from '#lib/components/owner/Filters.svelte';
	import Pager from '#lib/components/owner/Pager.svelte';
	import Empty from '#lib/components/owner/Empty.svelte';
	import Sure from '#lib/components/owner/Sure.svelte';
	import ResetLink from '#lib/components/owner/ResetLink.svelte';
	import Pill from '#lib/components/owner/Pill.svelte';
	import Avatar from '#lib/components/ui/Avatar.svelte';
	import Field from '#lib/components/Field.svelte';
	import { m } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	let { data, form } = $props();
	const ae = $derived(
		((form && 'addErrors' in form ? form.addErrors : {}) ?? {}) as Record<string, string>
	);
	const av = $derived(
		((form && 'values' in form ? form.values : {}) ?? {}) as Record<string, string>
	);
	const opened = (k: 'suspendFor' | 'rejectFor', id: string) =>
		!!(form && k in form && (form as Record<string, unknown>)[k] === id);
	const statusLabel = (s: string) =>
		({
			pending: m.owner_pending(),
			active: m.owner_active(),
			suspended: m.owner_suspended(),
			draft: m.owner_draft(),
			rejected: m.owner_rejected()
		})[s] ?? s;
	const tone = (s: string) =>
		s === 'active' ? 'ok' : s === 'pending' ? 'wait' : s === 'suspended' ? 'no' : 'info';
	// the search and filter stay after an action
	const keep = $derived(
		(data.q ? `&q=${encodeURIComponent(data.q)}` : '') +
			(data.status ? `&status=${data.status}` : '')
	);
	const chips = $derived(
		['', 'pending', 'active', 'suspended', 'draft', 'rejected'].map((v) => ({
			value: v,
			label: v ? statusLabel(v) : m.ow_all(),
			count: data.counts[v] ?? 0
		}))
	);
</script>

<svelte:head><title>{m.ow_tutors()} · {m.ow_label()} · Tutora</title></svelte:head>

<div class="oa">
	<Head title={m.ow_tutors()} lead={m.ow_tutors_lead()} icon="tutors" tone="blue">
		<a class="ui-btn-soft" href="#add">+ {m.owner_add_tutor()}</a>
	</Head>
	<Flash error={form?.error} done={data.done} />
	{#if form && 'added' in form && form.added}
		<p class="notice" role="status">
			{m.owner_added({
				name: form.added.name,
				email: form.added.email,
				password: form.added.password
			})}
		</p>
	{/if}

	<Filters {chips} search placeholder={m.owner_search()} label={m.ow_tutors()} />

	{#if data.tutors.length}
		<ul class="oa-cards two">
			{#each data.tutors as tu (tu.tutorId)}
				<li class="ui-card oa-card" data-tutor={tu.tutorId}>
					<div class="who">
						<Avatar name={tu.name ?? tu.accountName ?? '?'} size={48} />
						<div class="grow">
							<span class="name">{tu.name ?? tu.accountName ?? '—'}</span>
							<p class="meta">{tu.email}</p>
						</div>
						<Pill tone={tone(tu.status)} text={statusLabel(tu.status)} />
					</div>
					<p class="meta">
						{m.owner_joined({ date: fmtDay(tu.createdAt) })} · {m.owner_counts2({
							students: tu.students,
							bookings: tu.bookings,
							accepted: tu.bookingsAccepted,
							payments: tu.payments,
							confirmed: tu.paymentsConfirmed
						})} · {tu.setupDone ? m.owner_setup_done() : m.owner_setup_not_done()} · {m.owner_plan({
							plan: tu.plan
						})}
					</p>
					{#if tu.status === 'pending' && !tu.emailConfirmed}
						<p class="small">{m.owner_check_email()}</p>
					{/if}
					{#if tu.status === 'pending' && !tu.findable}
						<!-- warned before approving: students could not find this page yet -->
						<p class="small warn-t" role="note">
							{tu.activeSubjects ? m.owner_not_ready_name() : m.owner_not_ready_subjects()}
						</p>
					{/if}
					{#if tu.status === 'active' && !tu.findable}
						<p class="small warn-t">{m.owner_not_findable()}</p>
					{/if}
					<div class="oa-acts">
						{#if tu.status === 'pending'}
							<form method="POST" action="?/status{keep}">
								<input type="hidden" name="id" value={tu.tutorId} />
								<input type="hidden" name="status" value="active" />
								<button class="ui-btn sm" type="submit" disabled={!tu.findable}
									>{m.owner_approve()}</button
								>
							</form>
							<a class="ui-btn-soft sm" href="/t/{tu.slug}?preview=1">{m.owner_view_profile()}</a>
							<Sure
								label={m.owner_refuse()}
								action="?/reject{keep}"
								fields={{ id: tu.tutorId }}
								sure={m.ow_refuse_sure()}
								button={m.owner_reject_send()}
								open={opened('rejectFor', tu.tutorId)}
							>
								<label for="why-{tu.tutorId}">{m.owner_reject_why()}</label>
								<input id="why-{tu.tutorId}" name="reason" maxlength="500" required />
							</Sure>
						{:else if tu.status === 'active'}
							<a class="ui-btn-soft sm" href="/t/{tu.slug}">{m.ow_view_page()}</a>
							<!-- Tutora recommended tutors: only the owner decides, never for money -->
							<form
								method="POST"
								action="?/recommend{keep}"
								class="rec"
								data-rec={tu.recommend ?? 'normal'}
							>
								<input type="hidden" name="id" value={tu.tutorId} />
								{#if tu.recommend}<Pill
										tone={tu.recommend === 'pinned' ? 'ok' : 'no'}
										text={tu.recommend === 'pinned' ? m.rec_pinned() : m.rec_hidden()}
									/>{/if}
								{#if tu.recommend !== 'pinned'}<button
										class="ui-btn-soft sm"
										name="mode"
										value="pinned">{m.rec_pin()}</button
									>{/if}
								{#if tu.recommend !== 'hidden'}<button
										class="ui-btn-soft sm"
										name="mode"
										value="hidden">{m.rec_hide()}</button
									>{/if}
								{#if tu.recommend}<button class="ui-btn-soft sm" name="mode" value="normal"
										>{m.rec_normal()}</button
									>{/if}
							</form>
							<!-- two steps: suspending logs the tutor out at once -->
							<Sure
								label={m.owner_suspend()}
								action="?/status{keep}"
								fields={{ id: tu.tutorId, status: 'suspended' }}
								lead={m.owner_suspend_lead()}
								sure={m.owner_suspend_sure()}
								open={opened('suspendFor', tu.tutorId)}
							/>
						{:else if tu.status === 'suspended'}
							<form method="POST" action="?/status{keep}">
								<input type="hidden" name="id" value={tu.tutorId} />
								<input type="hidden" name="status" value="active" />
								<button class="ui-btn sm" type="submit">{m.owner_reactivate()}</button>
							</form>
						{:else}
							<span class="small muted">{m.ev_owner_not_submitted()}</span>
						{/if}
						<ResetLink
							id={tu.tutorId}
							result={form && 'resetLink' in form
								? (form.resetLink as { for: string; name: string; link: string; wa: string })
								: null}
						/>
					</div>
				</li>
			{/each}
		</ul>
		<Pager page={data.page} total={data.total} />
	{:else}
		<Empty
			icon="tutors"
			text={data.q
				? m.ow_search_none({ q: data.q })
				: data.status === 'pending'
					? m.owner_none_waiting()
					: m.owner_no_tutors()}
		/>
	{/if}

	<section id="add" class="ui-card oa-sec" aria-labelledby="add-h">
		<h2 id="add-h">{m.owner_add_tutor()}</h2>
		<form method="POST" action="?/addTutor" class="oa-form" novalidate>
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
			<button class="ui-btn" type="submit">{m.owner_add_tutor()}</button>
		</form>
	</section>
</div>
