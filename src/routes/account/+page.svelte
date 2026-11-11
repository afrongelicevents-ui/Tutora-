<script lang="ts">
	import { m } from '#lib/i18n.ts';
	let { data } = $props();
	const roleLabel = $derived(
		data.account.role === 'tutor'
			? m.role_tutor()
			: data.account.role === 'parent'
				? m.role_parent()
				: m.role_student()
	);
</script>

<svelte:head><title>{m.account_title()} · Tutora</title></svelte:head>

<section class="wrap narrow stack">
	<h1>{m.account_title()}</h1>
	<div class="card">
		<p><strong>{data.account.name}</strong><br /><span class="muted">{data.account.email}</span></p>
		<p class="small">{m.account_role()}: <strong>{roleLabel}</strong></p>
		<p class="small">
			{m.account_2fa()}:
			<strong>{data.account.twoFactorEnabled ? m.account_2fa_on() : m.account_2fa_off()}</strong>
		</p>
		<a class="btn btn-secondary" href="/account/password">{m.nav_password()}</a>
		<a class="btn btn-secondary" href="/account/2fa">{m.account_2fa_manage()}</a>
	</div>
</section>
