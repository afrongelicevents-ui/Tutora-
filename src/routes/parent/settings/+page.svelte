<script lang="ts">
	import Field from '#lib/components/Field.svelte';
	import { m, t } from '#lib/i18n.ts';
	import LineIcon from '#lib/components/LineIcon.svelte';
	import Hero from '#lib/components/ui/Hero.svelte';
	import Avatar from '#lib/components/ui/Avatar.svelte';
	let { data, form } = $props();
	type F = {
		error?: string;
		code?: string;
		errors?: Record<string, string>;
		create?: Record<string, string>;
		loginFor?: string;
		leaveFor?: string;
		created?: string;
		loginSet?: string;
		decided?: boolean;
		permsSaved?: boolean;
		prefsSaved?: boolean;
		left?: boolean;
	} | null;
	const f = $derived(form as F);
	const ce = $derived(f?.create ? (f.errors ?? {}) : {});
</script>

<svelte:head><title>{m.nav_settings()} · Tutora</title></svelte:head>

<div class="screen ui-page">
	<Hero title={m.nav_settings()} lead={m.pf_settings_lead()} />

	{#if data.nopay}<p class="notice" role="status">{m.par_no_payments()}</p>{/if}
	{#if f?.error}<p class="alert" role="alert">{t(f.error, { minutes: 60 })}</p>{/if}
	{#if f?.created}<p class="notice" role="status">{m.par3_created({ username: f.created })}</p>{/if}
	{#if f?.loginSet}<p class="notice" role="status">
			{m.par3_login_set({ username: f.loginSet })}
		</p>{/if}
	{#if f?.permsSaved || f?.decided || f?.left || f?.prefsSaved}<p class="notice" role="status">
			{m.sw3_saved()}
		</p>{/if}

	<section class="ui-card me" aria-labelledby="me-h">
		<span class="ui-ico navy big">{data.me.name.trim()[0]?.toUpperCase() ?? '?'}</span>
		<div>
			<h2 id="me-h" class="ui-serif">{data.me.name}</h2>
			{#if !data.me.email.endsWith('.invalid')}<span class="small muted">{data.me.email}</span>{/if}
		</div>
		<a class="ui-btn-soft" href="/account">{m.pf_account()} ›</a>
	</section>

	<section id="children" aria-labelledby="kids-h" class="stack-s">
		<div class="ui-sec-h"><h2 id="kids-h">{m.pf_children_h()}</h2></div>
		{#each data.kids as k (k.id)}
			<article class="ui-card kid" data-testid="settings-child">
				<div class="kid-h">
					<Avatar name={k.name} photo={k.photo} size={52} />
					<div>
						<h3 class="ui-serif">{k.name}</h3>
						<span class="small muted"
							>{k.level ?? ''}{#if k.status !== 'active'}{k.level
									? ' · '
									: ''}{m.par_pending_short()}{:else if k.guardian}{k.level
									? ' · '
									: ''}{m.par_guardian()}{/if}</span
						>
					</div>
				</div>
				{#if k.status === 'active'}
					<nav class="links" aria-label={k.short}>
						<a href="/parent/child/{k.id}"><span>{m.pf_view_child({ name: k.short })}</span>›</a>
						{#if k.guardian}
							<a href="/parent/payments?child={k.id}"
								><span>{m.par3_pay_for({ name: k.short })}</span>›</a
							>
							<a href="/parent/book?child={k.id}"
								><span>{m.par3_book_for({ name: k.short })}</span>›</a
							>
						{/if}
						<a href="/parent/buddies?child={k.id}"><span>{m.pb_link()}</span>›</a>
					</nav>
					{#each k.pending as p (p.parentId)}
						<div class="ui-card cream inner">
							<strong>{m.par_wants_to_follow({ name: p.name, child: k.short })}</strong>
							<div class="row">
								<form method="POST" action="?/decide">
									<input type="hidden" name="child" value={k.id} /><input
										type="hidden"
										name="parent"
										value={p.parentId}
									/><input type="hidden" name="allow" value="1" /><button class="ui-btn"
										>{m.par_approve()}</button
									>
								</form>
								<form method="POST" action="?/decide">
									<input type="hidden" name="child" value={k.id} /><input
										type="hidden"
										name="parent"
										value={p.parentId}
									/><input type="hidden" name="allow" value="0" /><button class="ui-btn-soft"
										>{m.par_decline()}</button
									>
								</form>
							</div>
						</div>
					{/each}
					{#if k.managed && k.guardian}
						<details open={f?.loginFor === k.id}>
							<summary class="sum"
								><LineIcon name="user" size={18} />
								{k.username
									? m.par3_change_login({ username: k.username })
									: m.par3_set_login({ name: k.short })}</summary
							>
							<form method="POST" action="?/login" class="stack">
								<input type="hidden" name="child" value={k.id} />
								<Field
									name="username"
									label={m.par3_username()}
									hint={m.par3_username_hint()}
									value={k.username ?? ''}
									autocomplete="off"
									error={f?.loginFor === k.id ? f.errors?.username : undefined}
								/>
								<Field
									name="password"
									type="password"
									label={m.par3_child_password()}
									hint={m.field_password_hint()}
									autocomplete="new-password"
									error={f?.loginFor === k.id ? f.errors?.password : undefined}
								/>
								<button class="ui-btn" type="submit">{m.sw3_save()}</button>
							</form>
						</details>
					{/if}
					{#if k.perms}
						<form method="POST" action="?/perms" class="perms">
							<input type="hidden" name="child" value={k.id} />
							<span class="small strong">{m.par3_permissions({ name: k.short })}</span>
							<label class="toggle-row"
								><span>{m.par3_perm_tools()}</span><input
									type="checkbox"
									name="tools"
									checked={k.perms.toolsAllowed}
								/></label
							>
							<label class="toggle-row"
								><span>{m.par3_perm_approve()}</span><input
									type="checkbox"
									name="approve"
									checked={k.perms.approveNewFamily}
								/></label
							>
							<button class="ui-btn-soft" type="submit">{m.sw3_save()}</button>
						</form>
					{/if}
				{/if}
				<details class="leave" open={f?.leaveFor === k.id}>
					<summary class="sum danger">{m.par_leave()}</summary>
					<form method="POST" action="?/leave" class="stack">
						<input type="hidden" name="child" value={k.id} />
						<p class="small">{m.par_leave_confirm({ name: k.short })}</p>
						<label class="check"><input type="checkbox" name="sure" /> {m.pf_sure()}</label>
						<button class="ui-btn-soft danger" type="submit">{m.par_leave()}</button>
					</form>
				</details>
			</article>
		{:else}
			<p class="muted">{m.par_no_children()}</p>
		{/each}
	</section>

	<section class="ui-card sky" id="add" aria-labelledby="add-h">
		<h2 id="add-h" class="ui-serif sec">{m.par_add_child_code_h()}</h2>
		<span class="small">{m.par_add_child_code_lead()}</span>
		<form method="POST" action="?/code" class="stack">
			<label class="sr-only" for="code">{m.v3_code_label()}</label>
			<input
				id="code"
				name="code"
				class="code-input"
				autocomplete="off"
				autocapitalize="characters"
				maxlength="14"
				placeholder="ABC-123456"
				value={f?.code ?? ''}
				required
			/>
			<button class="ui-btn" type="submit">{m.v3_code_check()}</button>
		</form>
		<details open={!!f?.create}>
			<summary class="sum"><LineIcon name="plus" size={18} /> {m.par3_create_child()}</summary>
			<form method="POST" action="?/createChild" class="stack" novalidate>
				<p class="note">{m.par3_create_lead()}</p>
				<Field
					name="name"
					label={m.par3_child_name()}
					value={f?.create?.name ?? ''}
					error={ce.name}
					required
				/>
				<Field
					name="username"
					label={m.par3_username()}
					hint={m.par3_username_hint()}
					value={f?.create?.username ?? ''}
					autocomplete="off"
					error={ce.username}
					required
				/>
				<Field
					name="password"
					type="password"
					label={m.par3_child_password()}
					hint={m.field_password_hint()}
					autocomplete="new-password"
					error={ce.password}
					required
				/>
				<Field name="year" label={m.sw3_year()} value={f?.create?.year ?? ''} />
				<Field name="level" label={m.find3_level()} value={f?.create?.level ?? ''} />
				<button class="ui-btn" type="submit">{m.par3_create_child()}</button>
			</form>
		</details>
	</section>

	<section class="ui-card" id="notifications" aria-labelledby="n-h">
		<h2 id="n-h" class="ui-serif sec">{m.par3_notify()}</h2>
		<form method="POST" action="?/prefs">
			<label class="toggle-row"
				><span>{m.par3_n_study()}</span><input
					type="checkbox"
					name="study"
					checked={data.prefs.study}
				/></label
			>
			<label class="toggle-row"
				><span>{m.par3_n_lessons()}</span><input
					type="checkbox"
					name="lessons"
					checked={data.prefs.lessons}
				/></label
			>
			<label class="toggle-row"
				><span>{m.par3_n_homework()}</span><input
					type="checkbox"
					name="homework"
					checked={data.prefs.homework}
				/></label
			>
			<label class="toggle-row"
				><span>{m.par3_n_weekly()}</span><input
					type="checkbox"
					name="weekly"
					checked={data.prefs.weekly}
				/></label
			>
			<button class="ui-btn-soft" type="submit">{m.sw3_save()}</button>
		</form>
		<p class="note">{m.par3_n_note()}</p>
	</section>

	<form method="POST" action="/logout" class="out">
		<button class="ui-btn-soft" type="submit">{m.nav_logout()}</button>
	</form>
</div>

<style>
	.me {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-wrap: wrap;
	}
	.me > div {
		flex: 1 1 160px;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.me .ui-btn-soft {
		flex-shrink: 0;
	}
	.me h2 {
		margin: 0;
		font-size: 1.3rem;
	}
	.big {
		width: 52px !important;
		height: 52px !important;
		border-radius: 50% !important;
		font-family: var(--font-display);
		font-size: 1.4rem;
		font-weight: 700;
	}
	.stack-s {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.kid {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.kid-h {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.kid-h h3 {
		margin: 0;
		font-size: 1.25rem;
	}
	.links {
		display: flex;
		flex-direction: column;
	}
	.links a {
		display: flex;
		justify-content: space-between;
		padding: 11px 0;
		border-bottom: 1px solid var(--border);
		color: var(--navy);
		text-decoration: none;
		font-weight: 600;
	}
	.inner {
		box-shadow: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.row {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.sum {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		font-weight: 600;
		color: var(--ocean);
		list-style: none;
		min-height: 40px;
	}
	details form {
		padding-top: 8px;
	}
	.perms {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.perms .ui-btn-soft,
	#notifications .ui-btn-soft {
		align-self: flex-start;
		margin-top: 6px;
	}
	.strong {
		font-weight: 700;
	}
	.danger {
		color: var(--danger-700) !important;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	#add,
	#notifications {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.sec {
		margin: 0;
		font-size: 1.3rem;
	}
	.out {
		align-self: flex-start;
	}
</style>
