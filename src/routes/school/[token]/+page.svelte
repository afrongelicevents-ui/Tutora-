<script lang="ts">
	import Hero from '#lib/components/ui/Hero.svelte';
	import { m, t } from '#lib/i18n.ts';
	import Field from '#lib/components/Field.svelte';
	import BotTrap from '#lib/components/BotTrap.svelte';
	import { page } from '$app/state';
	let { data, form } = $props();
	const inv = $derived(data.invite);
	type F = {
		error?: string;
		declined?: boolean;
		values?: Record<string, string>;
		errors?: Record<string, string>;
	} | null;
	const f = $derived(form as F);
	const v = $derived(f?.values ?? {});
	const e = $derived(f?.errors ?? {});
	const here = $derived(page.url.pathname);
</script>

<svelte:head
	><title>{m.sp3_title()} · Tutora</title><meta name="robots" content="noindex" /></svelte:head
>

{#if !inv}
	<section class="screen auth tskin" data-testid="spi-answered" data-answered={data.answered}>
		<Hero
			dark
			title={data.answered === 'declined' ? m.spi_answered_declined_h() : m.spi_answered_h()}
		>
			{#snippet badge()}<span class="ui-pill gold">School+</span>{/snippet}
		</Hero>
		<p class="softcard">
			{data.answered === 'declined' ? m.spi_answered_declined_b() : m.spi_answered_b()}
		</p>
		{#if data.me?.role === 'schoolteacher'}<a class="btn btn-block" href="/teacher"
				>{m.spi_open_teacher()}</a
			>{/if}
	</section>
{:else}
	<section class="screen auth tskin" data-testid="spi-answered" data-answered={data.answered}>
		<Hero
			dark
			title={m.spi_h({ tutor: inv.tutor })}
			lead={m.spi_lead({ child: inv.child, subject: inv.subject, school: inv.school })}
		>
			{#snippet badge()}<span class="ui-pill gold">School+</span>{/snippet}
		</Hero>
		<ul class="small plain">
			<li>{m.spi_what_messages()}</li>
			<li>{m.spi_what_plan()}</li>
			<li>{m.spi_what_report()}</li>
			<li>{m.spi_what_consent()}</li>
		</ul>
		{#if f?.error}<p class="alert" role="alert">{t(f.error)}</p>{/if}

		{#if f?.declined}
			<p class="notice" role="status">{m.spi_declined_done()}</p>
		{:else if data.me?.role === 'schoolteacher'}
			<p class="softcard small">{m.spi_signed_in({ name: data.me.name })}</p>
			<form method="POST" action="?/respond" class="stack" data-testid="spi-respond">
				<button class="btn btn-block" name="accept" value="1"
					>{inv.legacy ? m.spi_take_over() : m.spi_accept()}</button
				>
				{#if !inv.legacy}<button class="btn btn-ghost btn-block" name="accept" value="0"
						>{m.spi_decline()}</button
					>{/if}
			</form>
		{:else if data.me}
			<p class="alert" role="alert">{m.spi_wrong_account()}</p>
			<form method="POST" action="/logout">
				<button class="btn btn-ghost btn-block">{m.nav_logout()}</button>
			</form>
		{:else}
			<h2 class="h3">{m.spi_create_h()}</h2>
			{#if e.form}<p class="alert" role="alert">{t(e.form)}</p>{/if}
			<form method="POST" action="?/signup" class="stack" novalidate data-testid="spi-signup">
				<BotTrap />
				<Field
					name="name"
					label={m.field_name()}
					autocomplete="name"
					required
					value={v.name ?? inv.teacher}
					error={e.name}
				/>
				<Field
					name="email"
					type="email"
					label={m.field_email()}
					autocomplete="email"
					required
					value={v.email ?? ''}
					error={e.email}
				/>
				<Field
					name="password"
					type="password"
					label={m.field_password()}
					hint={m.field_password_hint()}
					autocomplete="new-password"
					minlength={10}
					required
					error={e.password}
				/>
				<Field
					name="school"
					label={m.spi_school()}
					required
					value={v.school ?? inv.school}
					error={e.school}
				/>
				<button class="btn btn-block" type="submit">{m.spi_create()}</button>
			</form>
			<a class="btn-link center" href={`/login?next=${encodeURIComponent(here)}`}
				>{m.spi_have_account()}</a
			>
			<p class="note">{m.spi_only_this()}</p>
		{/if}
	</section>
{/if}

<style>
	.plain {
		padding-left: 18px;
	}
	.center {
		text-align: center;
	}
</style>
