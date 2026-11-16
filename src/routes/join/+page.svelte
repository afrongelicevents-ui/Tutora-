<script lang="ts">
	import { photoSrc } from '#lib/photo-slots.ts';
	import { page } from '$app/state';
	import { m } from '#lib/i18n.ts';
	import LineIcon from '#lib/components/LineIcon.svelte';
	let { data } = $props();
	const gets = [
		{ icon: 'user', tone: 'navy', t: m.join_get1_t(), b: m.join_get1() },
		{ icon: 'calendar', tone: 'blue', t: m.join_get2_t(), b: m.join_get2() },
		{ icon: 'wallet', tone: 'green', t: m.join_get3_t(), b: m.join_get3() },
		{ icon: 'video', tone: 'amber', t: m.join_get4_t(), b: m.join_get4() },
		{ icon: 'pencil', tone: 'blue', t: m.join_get5_t(), b: m.join_get5() }
	] as const;
</script>

<svelte:head>
	<title>{m.join_title()} · Tutora</title>
	<meta name="description" content={data.joinLead ?? m.join_lead()} />
</svelte:head>

<section class="wrap narrow look">
	<div class="jhero">
		<img
			src={photoSrc(page.data.photos, 'join')}
			alt={m.join_photo_alt()}
			width="625"
			height="640"
			fetchpriority="high"
		/>
		<div class="jtext">
			<h1 class="look-title">{m.join_title()}</h1>
			<p class="lead">{data.joinLead ?? m.join_lead()}</p>
		</div>
	</div>
	<h2>{m.join_get()}</h2>
	<ul class="gets">
		{#each gets as g (g.t)}
			<li class="ui-card">
				<span class="ui-ico {g.tone}"><LineIcon name={g.icon} size={22} /></span>
				<span><b>{g.t}</b><span class="small muted block">{g.b}</span></span>
			</li>
		{/each}
	</ul>
	<h2>{m.join_how()}</h2>
	<ol class="ui-card sky steps">
		<li><span class="n">1</span>{m.join_how1()}</li>
		<li><span class="n">2</span>{m.join_how2()}</li>
		<li><span class="n">3</span>{m.join_how3()}</li>
	</ol>
	<p class="small muted">{m.join_free()}</p>
	<a class="btn btn-block" href="/join/signup">{m.join_create()}</a>
	<p class="small" style="margin-top:12px">
		{m.join_have_account()} <a href="/login">{m.nav_login()}</a>
	</p>
</section>

<style>
	.jhero {
		position: relative;
		overflow: hidden;
		border-radius: 24px;
		min-height: 230px;
		margin-top: 8px;
		background:
			radial-gradient(120% 90% at 100% 0%, #fdf3e2 0%, transparent 55%),
			linear-gradient(180deg, var(--ice) 0%, #f3f7fc 100%);
		box-shadow: var(--shadow-soft);
	}
	.jhero img {
		position: absolute;
		inset: 0 0 0 auto;
		width: 48%;
		height: 100%;
		object-fit: cover;
		-webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 40%);
		mask-image: linear-gradient(90deg, transparent 0%, #000 40%);
	}
	.jtext {
		position: relative;
		max-width: 58%;
		padding: 22px 18px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.lead {
		margin: 0;
		font-size: 1rem;
		line-height: 1.45;
		color: var(--navy);
		opacity: 0.85;
	}
	.gets {
		display: grid;
		gap: 10px;
		padding: 0;
		list-style: none;
	}
	.gets li {
		display: flex;
		gap: 14px;
		align-items: flex-start;
	}
	.steps {
		display: grid;
		gap: 12px;
		list-style: none;
		margin: 0;
	}
	.steps li {
		display: flex;
		gap: 12px;
		align-items: center;
	}
	.n {
		flex-shrink: 0;
		width: 30px;
		height: 30px;
		border-radius: 999px;
		display: grid;
		place-items: center;
		background: var(--navy);
		color: #fff;
		font-weight: 700;
		font-size: 0.9rem;
	}
</style>
