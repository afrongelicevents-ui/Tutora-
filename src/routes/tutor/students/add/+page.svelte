<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { waLink } from '#lib/whatsapp.ts';
	let { data } = $props();
	const text = $derived(m.sa_share_text({ link: data.link }));
</script>

<svelte:head><title>{m.st2_add()} · Tutora</title></svelte:head>

<section class="screen">
	<a class="back" href="/tutor/students">← {m.st2_title()}</a>
	<h1>{m.st2_add()}</h1>
	<p class="lead">{m.sa_lead()}</p>
	{#if data.active}
		<div class="softcard">
			<strong>{m.sa_your_link()}</strong>
			<p class="link"><a href={data.link}>{data.link}</a></p>
			<div class="btn-row">
				<a class="btn" href={waLink('', text)} target="_blank" rel="noopener noreferrer"
					>{m.sa_whatsapp()}</a
				>
				<a class="btn btn-secondary" href={data.link}>{m.sa_preview()}</a>
			</div>
		</div>
		<ol class="steps">
			<li>{m.sa_step1()}</li>
			<li>{m.sa_step2()}</li>
			<li>{m.sa_step3()}</li>
		</ol>
	{:else}
		<p class="notice">{m.sa_not_active()}</p>
	{/if}
</section>

<style>
	.back {
		align-self: flex-start;
		color: var(--ocean);
		font-weight: 600;
		text-decoration: none;
		padding: 8px 0;
	}
	.link {
		margin: 0;
		overflow-wrap: anywhere;
		font-weight: 600;
	}
	.steps {
		margin: 0;
		padding-left: 20px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
</style>
