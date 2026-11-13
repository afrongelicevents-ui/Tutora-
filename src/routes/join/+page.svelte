<script lang="ts">
	import { m } from '#lib/i18n.ts';
	let { data } = $props();
</script>

<svelte:head>
	<title>{m.join_title()} · Tutora</title>
	<meta name="description" content={data.joinLead ?? m.join_lead()} />
</svelte:head>

<section class="wrap narrow">
	<h1>{m.join_title()}</h1>
	<p class="lead">{data.joinLead ?? m.join_lead()}</p>
	<h2>{m.join_get()}</h2>
	<ul class="gets">
		<li><b>{m.join_get1_t()}</b><span class="small muted block">{m.join_get1()}</span></li>
		<li><b>{m.join_get2_t()}</b><span class="small muted block">{m.join_get2()}</span></li>
		<li><b>{m.join_get3_t()}</b><span class="small muted block">{m.join_get3()}</span></li>
		<li><b>{m.join_get4_t()}</b><span class="small muted block">{m.join_get4()}</span></li>
		<li><b>{m.join_get5_t()}</b><span class="small muted block">{m.join_get5()}</span></li>
	</ul>
	<h2>{m.join_how()}</h2>
	<ol class="gets">
		<li>{m.join_how1()}</li>
		<li>{m.join_how2()}</li>
		<li>{m.join_how3()}</li>
	</ol>
	<p class="small muted">{m.join_free()}</p>
	<a class="btn btn-block" href="/join/signup">{m.join_create()}</a>
	<p class="small" style="margin-top:12px">
		{m.join_have_account()} <a href="/login">{m.nav_login()}</a>
	</p>
</section>

<style>
	.lead {
		font-size: 18px;
	}
	.gets {
		display: grid;
		gap: 12px;
		padding-left: 20px;
	}
</style>
