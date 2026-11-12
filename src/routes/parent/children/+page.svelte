<script lang="ts">
	import Field from '#lib/components/Field.svelte';
	import { m, t } from '#lib/i18n.ts';
	let { data, form } = $props();
	type F = {
		error?: string;
		code?: string;
		errors?: Record<string, string>;
		create?: Record<string, string>;
		loginFor?: string;
		created?: string;
		loginSet?: string;
		decided?: boolean;
		permsSaved?: boolean;
		left?: boolean;
	} | null;
	const f = $derived(form as F);
	const ce = $derived(f?.create ? (f.errors ?? {}) : {});
</script>

<svelte:head><title>{m.par_children_title()} · Tutora</title></svelte:head>

<div class="screen wide-2">
	<div class="full">
		<h1>{m.par_children_title()}</h1>
		<p class="lead">{m.par_children_lead()}</p>
	</div>
	{#if f?.error}<p class="alert full" role="alert">{t(f.error, { minutes: 60 })}</p>{/if}
	{#if f?.created}<p class="notice full" role="status">
			{m.par3_created({ username: f.created })}
		</p>{/if}
	{#if f?.loginSet}<p class="notice full" role="status">
			{m.par3_login_set({ username: f.loginSet })}
		</p>{/if}
	{#if f?.permsSaved || f?.decided || f?.left}<p class="notice full" role="status">
			{m.sw3_saved()}
		</p>{/if}

	<div class="list">
		{#each data.kids as k (k.id)}
			<section class="kid">
				<div class="section-h">
					<h2>{k.name}{k.level ? ` · ${k.level}` : ''}</h2>
					{#if k.status !== 'active'}<span class="pill p-wait">{m.par_pending_short()}</span
						>{:else if k.guardian}<span class="tag">{m.par_guardian()}</span>{/if}
				</div>
				{#if k.status === 'active'}
					<div class="rows">
						<a href="/parent?child={k.id}"
							><span>{m.v3_nav_overview()}</span><span class="go">›</span></a
						>
						{#if k.guardian}
							<a href="/parent/payments?child={k.id}"
								><span>{m.par3_pay_for({ name: k.short })}</span><span class="go">›</span></a
							>
						{/if}
						{#if k.managed && k.guardian}
							<a href="/parent/book?child={k.id}"
								><span>{m.par3_book_for({ name: k.short })}</span><span class="go">›</span></a
							>
						{/if}
					</div>
					{#each k.pending as p (p.parentId)}
						<div class="softcard">
							<strong>{m.par_wants_to_follow({ name: p.name, child: k.short })}</strong>
							<div class="row">
								<form method="POST" action="?/decide">
									<input type="hidden" name="child" value={k.id} /><input
										type="hidden"
										name="parent"
										value={p.parentId}
									/><input type="hidden" name="allow" value="1" /><button class="btn btn-sm"
										>{m.par_approve()}</button
									>
								</form>
								<form method="POST" action="?/decide">
									<input type="hidden" name="child" value={k.id} /><input
										type="hidden"
										name="parent"
										value={p.parentId}
									/><input type="hidden" name="allow" value="0" /><button
										class="btn btn-ghost btn-sm">{m.par_decline()}</button
									>
								</form>
							</div>
						</div>
					{/each}
					{#if k.managed && k.guardian}
						<details open={f?.loginFor === k.id}>
							<summary class="btn-link"
								>{k.username
									? m.par3_change_login({ username: k.username })
									: m.par3_set_login({ name: k.short })}</summary
							>
							<form method="POST" action="?/login" class="stack inner">
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
								<button class="btn btn-ghost" type="submit">{m.sw3_save()}</button>
							</form>
						</details>
					{/if}
					{#if k.perms}
						<form method="POST" action="?/perms" class="perms">
							<input type="hidden" name="child" value={k.id} />
							<span class="eyebrow">{m.par3_permissions({ name: k.short })}</span>
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
							<button class="btn btn-ghost btn-sm" type="submit">{m.sw3_save()}</button>
						</form>
					{/if}
				{/if}
				<form
					method="POST"
					action="?/leave"
					onsubmit={(e) => {
						if (!confirm(m.par_leave_confirm({ name: k.short }))) e.preventDefault();
					}}
				>
					<input type="hidden" name="child" value={k.id} />
					<button class="btn-link small danger" type="submit">{m.par_leave()}</button>
				</form>
			</section>
		{:else}
			<p class="lead">{m.par_no_children()}</p>
		{/each}
	</div>

	<div class="side stackish">
		<section class="softcard" id="add">
			<strong>{m.par_add_child_code_h()}</strong>
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
				<button class="btn btn-block" type="submit">{m.v3_code_check()}</button>
			</form>
		</section>
		<details open={!!f?.create}>
			<summary class="btn btn-ghost btn-block">{m.par3_create_child()}</summary>
			<form method="POST" action="?/createChild" class="stack inner" novalidate>
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
				<button class="btn btn-block" type="submit">{m.par3_create_child()}</button>
			</form>
		</details>
	</div>
</div>

<style>
	h1 {
		margin: 0;
		font-size: 1.875rem;
	}
	.kid {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding-bottom: 16px;
		margin-bottom: 16px;
		border-bottom: 1px solid var(--border);
	}
	.rows a {
		text-decoration: none;
	}
	.inner {
		padding-top: 10px;
	}
	.stackish {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	details summary {
		cursor: pointer;
		list-style: none;
	}
	.danger {
		color: var(--danger-700);
	}
	.perms {
		display: flex;
		flex-direction: column;
	}
</style>
