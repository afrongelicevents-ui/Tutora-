<script lang="ts">
	import Field from '#lib/components/Field.svelte';
	import { m, t } from '#lib/i18n.ts';
	let { data, form } = $props();
	type Setup = { totpURI: string; qr: string; secret: string; backupCodes: string[] };
	const setup = $derived((form && 'setup' in form ? form.setup : null) as Setup | null);
	const e = $derived((form && 'errors' in form ? form.errors : {}) as Record<string, string>);
</script>

<svelte:head><title>{m.twofa_setup_title()} · Tutora</title></svelte:head>

<section class="wrap narrow stack">
	<h1>{m.twofa_setup_title()}</h1>
	{#if data.required && !data.enabled}<p class="notice">{m.twofa_required()}</p>{/if}
	{#if e.form}<p class="alert" role="alert">{t(e.form, { minutes: 1 })}</p>{/if}

	{#if data.enabled && !setup}
		<p class="notice" role="status">{m.twofa_enabled()}</p>
		{#if data.isTutor}
			<p class="small muted">{m.twofa_disable_tutor_note()}</p>
		{:else}
			<form method="POST" action="?/disable" class="stack card" novalidate>
				<Field
					name="password"
					type="password"
					label={m.field_password()}
					autocomplete="current-password"
					required
					error={e.password}
				/>
				<button class="btn btn-secondary" type="submit">{m.twofa_disable()}</button>
			</form>
		{/if}
	{:else if !setup}
		<p class="muted">{m.twofa_setup_lead()}</p>
		<form method="POST" action="?/start" class="stack card" novalidate>
			<p class="label">{m.twofa_step1()}</p>
			<Field
				name="password"
				type="password"
				label={m.field_password()}
				autocomplete="current-password"
				required
				error={e.password}
			/>
			<button class="btn btn-block" type="submit">{m.twofa_start()}</button>
		</form>
	{:else}
		<div class="card stack">
			<p class="label">{m.twofa_step2()}</p>
			<img class="qr" src={setup.qr} alt="" width="200" height="200" />
			<p class="small">{m.twofa_key()}: <code>{setup.secret}</code></p>
		</div>
		<div class="card stack">
			<p class="label">{m.twofa_backup_title_setup()}</p>
			<p class="small muted">{m.twofa_backup_lead()}</p>
			<ul class="codes">
				{#each setup.backupCodes as code (code)}<li><code>{code}</code></li>{/each}
			</ul>
		</div>
		<form method="POST" action="?/verify" class="stack card" novalidate>
			<p class="label">{m.twofa_step3()}</p>
			<input type="hidden" name="totpURI" value={setup.totpURI} />
			<input type="hidden" name="backupCodes" value={setup.backupCodes.join(',')} />
			<Field
				name="code"
				label={m.field_code()}
				inputmode="numeric"
				autocomplete="one-time-code"
				maxlength={6}
				required
				error={e.code}
			/>
			<button class="btn btn-block" type="submit">{m.twofa_confirm()}</button>
		</form>
	{/if}
</section>

<style>
	.qr {
		width: 200px;
		height: 200px;
		background: #fff;
	}
	.codes {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		padding: 0;
		list-style: none;
		font-size: 1.05rem;
	}
</style>
