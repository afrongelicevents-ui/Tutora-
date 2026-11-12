<script lang="ts">
	import { page } from '$app/state';
	import Field from '#lib/components/Field.svelte';
	import { m, t } from '#lib/i18n.ts';
	let { form } = $props();
	const v = $derived((form?.values ?? {}) as Record<string, string>);
	const e = $derived((form?.errors ?? {}) as Record<string, string>);
</script>

<svelte:head><title>{m.login_title()} · Tutora</title></svelte:head>

<section class="screen auth">
	<a class="back" href="/" aria-label={m.v3_back()}>←</a>
	<h1>{m.v3_welcome_back()}</h1>
	{#if page.url.searchParams.has('reset')}<p class="notice" role="status">{m.reset_done()}</p>{/if}
	{#if page.url.searchParams.has('claimed')}<p class="notice" role="status">
			{m.login_claimed()}
		</p>{/if}
	{#if e.form}<p class="alert" role="alert">
			{t(e.form, { minutes: (form as { retryMinutes?: number } | null)?.retryMinutes ?? 1 })}
		</p>{/if}
	<form method="POST" class="stack" novalidate>
		<Field
			name="email"
			type="text"
			label={m.v3_login_label()}
			autocomplete="username"
			required
			value={v.email ?? ''}
			error={e.email}
		/>
		<Field
			name="password"
			type="password"
			label={m.field_password()}
			autocomplete="current-password"
			required
			error={e.password}
		/>
		<label class="check"
			><input type="checkbox" name="remember" defaultChecked={true} />
			<span>{m.login_remember()}</span></label
		>
		<button class="btn btn-block" type="submit">{m.login_submit()}</button>
	</form>
	<p><a href="/forgot-password">{m.login_forgot()}</a></p>
	<p class="small">{m.v3_no_account()} <a href="/get-started">{m.v3_get_started()}</a></p>
	<p class="small">{m.v3_have_code()} <a href="/code">{m.v3_join_with_code()}</a></p>
</section>
