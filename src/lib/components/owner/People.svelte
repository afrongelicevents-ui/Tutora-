<script lang="ts">
	/** People → Students / Parents / Schoolteachers: search, filters, cards, suspend / restore. */
	import type { IconName } from '#lib/components/LineIcon.svelte';
	import Head from './Head.svelte';
	import Flash from './Flash.svelte';
	import Filters from './Filters.svelte';
	import Pager from './Pager.svelte';
	import Empty from './Empty.svelte';
	import Sure from './Sure.svelte';
	import Pill from './Pill.svelte';
	import Avatar from '#lib/components/ui/Avatar.svelte';
	import Field from '#lib/components/Field.svelte';
	import ResetLink from './ResetLink.svelte';
	import { m } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	interface Person {
		id: string;
		name: string;
		email: string;
		createdAt: Date;
		suspendedAt: Date | null;
		emailConfirmed: boolean;
		extra: number;
	}
	let {
		data,
		form,
		title,
		lead,
		icon,
		tone = 'blue',
		extra,
		reset = false
	}: {
		data: {
			people: Person[];
			counts: { all: number; active: number; suspended: number };
			total: number;
			state: string;
			q: string;
			page: number;
			done: string | null;
		};
		form: Record<string, unknown> | null;
		title: string;
		lead: string;
		icon: IconName;
		tone?: 'navy' | 'blue' | 'green' | 'amber';
		/** what the number means for one person ("2 tutors") */
		extra: (n: number) => string;
		/** show "Reset a password" by email (students and parents) */
		reset?: boolean;
	} = $props();
	const chips = $derived([
		{ value: '', label: m.ow_all(), count: data.counts.all },
		{ value: 'active', label: m.owner_active(), count: data.counts.active },
		{ value: 'suspended', label: m.owner_suspended(), count: data.counts.suspended }
	]);
	// the list's search and filter stay after an action (also after a refused one)
	const keep = $derived(
		(data.q ? `&q=${encodeURIComponent(data.q)}` : '') + (data.state ? `&state=${data.state}` : '')
	);
	type Made = { for: string; name: string; link: string; wa: string };
	const made = $derived(form && 'resetLink' in form ? (form.resetLink as Made) : null);
	// a link made from the "by email" form for someone not on this page of the list
	const madeElsewhere = $derived(made && !data.people.some((p) => p.id === made.for) ? made : null);
</script>

<div class="oa">
	<Head {title} {lead} {icon} {tone}>
		{#if reset}<a class="ui-btn-soft" href="#reset">{m.owner_reset_h()}</a>{/if}
	</Head>
	<Flash error={form?.error as string | undefined} done={data.done} />

	<Filters {chips} name="state" search placeholder={m.owner_search()} label={title} />

	{#if data.people.length}
		<ul class="oa-cards two">
			{#each data.people as p (p.id)}
				<li class="ui-card oa-card" data-person={p.id}>
					<div class="who">
						<Avatar name={p.name} size={44} />
						<div class="grow">
							<span class="name">{p.name}</span>
							<p class="meta">{p.email}</p>
						</div>
						<Pill
							tone={p.suspendedAt ? 'no' : 'ok'}
							text={p.suspendedAt ? m.owner_suspended() : m.owner_active()}
						/>
					</div>
					<p class="meta">
						{m.owner_joined({ date: fmtDay(p.createdAt) })} · {extra(
							p.extra
						)}{#if !p.emailConfirmed}
							· {m.ow_email_unconfirmed()}{/if}
					</p>
					<div class="oa-acts">
						{#if p.suspendedAt}
							<form method="POST" action="?/suspend{keep}">
								<input type="hidden" name="id" value={p.id} />
								<input type="hidden" name="suspend" value="false" />
								<input type="hidden" name="q" value={data.q} />
								<input type="hidden" name="state" value={data.state} />
								<button class="ui-btn sm" type="submit">{m.owner_reactivate()}</button>
							</form>
						{:else}
							<!-- two steps: suspending logs them out at once -->
							<Sure
								label={m.owner_suspend()}
								action="?/suspend{keep}"
								fields={{ id: p.id, suspend: 'true', q: data.q, state: data.state }}
								lead={m.owner_suspend_student_lead()}
								sure={m.owner_suspend_sure()}
								open={!!(form && form.suspendFor === p.id)}
							/>
						{/if}
						<ResetLink id={p.id} result={made} />
					</div>
				</li>
			{/each}
		</ul>
		<Pager page={data.page} total={data.total} />
	{:else}
		<Empty {icon} text={data.q ? m.ow_search_none({ q: data.q }) : m.ow_people_none()} />
	{/if}

	{#if reset}
		<section id="reset" class="ui-card oa-sec" aria-labelledby="reset-h">
			<h2 id="reset-h">{m.owner_reset_h()}</h2>
			{#if madeElsewhere}<ResetLink id={madeElsewhere.for} result={madeElsewhere} />{/if}
			<form method="POST" action="?/resetStudent" class="oa-form" novalidate>
				<p class="small muted">{m.owner_reset_lead()}</p>
				<Field
					id="reset-email"
					name="email"
					type="email"
					label={m.owner_reset_email()}
					value={(form?.resetEmail as string | undefined) ?? ''}
					error={form && 'resetError' in form ? (form.resetError as string) : undefined}
					required
				/>
				<button class="ui-btn" type="submit">{m.owner_reset_btn()}</button>
			</form>
		</section>
	{/if}
</div>
