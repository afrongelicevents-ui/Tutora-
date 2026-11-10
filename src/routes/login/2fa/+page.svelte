<script lang="ts">
	import { page } from '$app/state';
	import Field from '#lib/components/Field.svelte';
	import { m, t } from '#lib/i18n.ts';
	let { form } = $props();
	const e = $derived((form?.errors ?? {}) as Record<string, string>);
	const useBackup = $derived(page.url.searchParams.has('backup') || !!form?.backup);
	const q = $derived(page.url.search);
</script>

<svelte:head><title>{m.twofa_login_title()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	{#if e.form}<p class="alert" role="alert">
			{t(e.form, { minutes: form?.retryMinutes ?? 1 })}
		</p>{/if}
	{#if !useBackup}
		<h1>{m.twofa_login_title()}</h1>
		<p class="muted">{m.twofa_login_lead()}</p>
		<form method="POST" action="?/totp{q ? '&' + q.slice(1) : ''}" class="stack" novalidate>
			<Field
				name="code"
				label={m.field_code()}
				inputmode="numeric"
				autocomplete="one-time-code"
				pattern="[0-9]*"
				maxlength={6}
				required
				error={e.code}
			/>
			<label class="check"
				><input type="checkbox" name="trustDevice" /> <span>{m.field_trust_device()}</span></label
			>
			<button class="btn btn-block" type="submit">{m.twofa_submit()}</button>
		</form>
		<p><a href="?backup=1">{m.twofa_use_backup()}</a></p>
	{:else}
		<h1>{m.twofa_backup_title()}</h1>
		<form method="POST" action="?/backup" class="stack" novalidate>
			<Field name="code" label={m.field_backup_code()} autocomplete="off" required error={e.code} />
			<button class="btn btn-block" type="submit">{m.twofa_submit()}</button>
		</form>
		<p><a href="/login/2fa">{m.twofa_use_app()}</a></p>
	{/if}
</section>
