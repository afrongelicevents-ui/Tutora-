<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	let { form } = $props();
</script>

<svelte:head><title>{m.v3_code_title()} · Tutora</title></svelte:head>

<section class="screen auth">
	<a class="back" href="/get-started" aria-label={m.v3_back()}>←</a>
	<h1>{m.v3_code_title()}</h1>
	<p class="lead">{m.v3_code_lead()}</p>
	{#if form?.error}<p class="alert" role="alert">
			{t(form.error, { minutes: 'retryMinutes' in form ? form.retryMinutes : 60 })}
		</p>{/if}
	<form method="POST" class="stack">
		<label class="sr-only" for="code">{m.v3_code_label()}</label>
		<input
			id="code"
			name="code"
			class="code-input"
			autocomplete="off"
			autocapitalize="characters"
			spellcheck="false"
			maxlength="14"
			placeholder="ABC-123456"
			value={form?.code ?? ''}
			required
		/>
		<button class="btn btn-block" type="submit">{m.v3_code_check()}</button>
	</form>
	<p class="note">{m.v3_code_what()}</p>
</section>
