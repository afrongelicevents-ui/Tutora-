<script lang="ts">
	// Account and settings, in one organised place (instead of every option on More).
	import { m } from '#lib/i18n.ts';
	import LineIcon from '#lib/components/LineIcon.svelte';
	import type { IconName } from '#lib/components/LineIcon.svelte';
	let { data } = $props();
	const groups = $derived<[string, [string, IconName, string, string][]][]>([
		[
			m.ms_profile_h(),
			[
				['/tutor/settings', 'user', m.ms_profile(), m.ms_profile_hint()],
				...(data.status === 'active'
					? ([[`/t/${data.slug}`, 'eye', m.more_public(), m.more_public_hint()]] as [
							string,
							IconName,
							string,
							string
						][])
					: [])
			]
		],
		[
			m.ms_security_h(),
			[
				['/tutor/settings/account', 'mail', m.ms_login(), m.ms_login_hint()],
				['/account/2fa', 'check', m.account_2fa(), m.more_2fa_hint()]
			]
		],
		[
			m.ms_notif_h(),
			[
				['/account', 'bell', m.ms_notif(), m.ms_notif_hint()],
				['/notifications', 'bell', m.notif_title(), m.more_notif_hint()]
			]
		]
	]);
</script>

<svelte:head><title>{m.mo_settings()} · Tutora</title></svelte:head>

<section class="screen">
	<a class="back" href="/tutor/more">← {m.v3_nav_more()}</a>
	<h1>{m.mo_settings()}</h1>
	{#each groups as [title, items] (title)}
		<section class="grp">
			<h2>{title}</h2>
			<ul>
				{#each items as [href, icon, label, hint] (href)}
					<li>
						<a {href}
							><span class="ic"><LineIcon name={icon} size={20} /></span><span class="tx"
								><strong>{label}</strong><span>{hint}</span></span
							><LineIcon name="chevron" size={18} /></a
						>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
	<form method="POST" action="/logout">
		<button class="btn btn-secondary btn-block" type="submit">{m.nav_logout()}</button>
	</form>
</section>

<style>
	.back {
		align-self: flex-start;
		color: var(--ocean);
		font-weight: 600;
		text-decoration: none;
		padding: 8px 0;
	}
	.grp h2 {
		margin: 0 0 8px;
		font-size: 1rem;
		color: var(--muted);
		font-family: var(--font);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.grp ul {
		list-style: none;
		margin: 0;
		padding: 0;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 18px;
		overflow: hidden;
	}
	.grp li + li {
		border-top: 1px solid var(--border);
	}
	.grp a {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px;
		color: var(--navy);
		text-decoration: none;
	}
	.ic {
		width: 38px;
		height: 38px;
		border-radius: 10px;
		background: var(--ice);
		display: grid;
		place-items: center;
		color: var(--ocean);
		flex: none;
	}
	.tx {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.tx span {
		color: var(--muted);
		font-size: 0.8125rem;
	}
</style>
