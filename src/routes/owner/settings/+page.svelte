<script lang="ts">
	import Head from '#lib/components/owner/Head.svelte';
	import Flash from '#lib/components/owner/Flash.svelte';
	import Sure from '#lib/components/owner/Sure.svelte';
	import Field from '#lib/components/Field.svelte';
	import LineIcon from '#lib/components/LineIcon.svelte';
	import OwnerFamilySettings from '#lib/components/family/OwnerFamilySettings.svelte';
	import OwnerProSettings from '#lib/components/pro/OwnerProSettings.svelte';
	import OwnerGifts from '#lib/components/pro/OwnerGifts.svelte';
	import { m } from '#lib/i18n.ts';
	let { data, form } = $props();
	const e = $derived(
		((form && 'errors' in form ? form.errors : {}) ?? {}) as Record<string, string>
	);
</script>

<svelte:head><title>{m.ow_settings()} · {m.ow_label()} · Tutora</title></svelte:head>

<div class="oa">
	<Head title={m.ow_settings()} lead={m.ow_settings_lead()} icon="cog" tone="navy" />
	<Flash error={form && 'error' in form ? (form.error as string) : null} done={data.done} />

	<div class="ui-cols">
		<div>
			<section class="ui-card oa-sec" aria-labelledby="em-h">
				<h2 id="em-h">{m.ow_email_h()}</h2>
				<p class="small">{m.set_login_email()}: <b>{data.email}</b></p>
				{#if form && 'emailSent' in form}
					<p class="notice" role="status">{m.set_email_sent({ email: String(form.emailSent) })}</p>
				{/if}
				{#if form && 'emailChanged' in form}
					<p class="notice" role="status">{m.set_email_changed()}</p>
				{/if}
				<form method="POST" action="?/changeEmail" class="oa-form" novalidate>
					<Field
						name="newEmail"
						type="email"
						label={m.set_new_email()}
						error={e.newEmail}
						autocomplete="email"
					/>
					{#if !data.emailOn}
						<Field
							name="password"
							type="password"
							label={m.set_current_password()}
							error={e.password}
							autocomplete="current-password"
						/>
					{/if}
					<button class="ui-btn-soft" type="submit">{m.set_change_email()}</button>
				</form>
			</section>
			<section class="ui-card oa-sec" aria-labelledby="pw-h">
				<h2 id="pw-h">{m.set_change_password()}</h2>
				{#if form && 'passwordChanged' in form}
					<p class="notice" role="status">{m.set_password_changed()}</p>
				{/if}
				<form method="POST" action="?/changePassword" class="oa-form" novalidate>
					<Field
						name="currentPassword"
						type="password"
						label={m.set_current_password()}
						error={e.currentPassword}
						autocomplete="current-password"
					/>
					<Field
						name="newPassword"
						type="password"
						label={m.set_new_password()}
						hint={m.field_password_hint()}
						error={e.newPassword}
						autocomplete="new-password"
					/>
					<button class="ui-btn-soft" type="submit">{m.set_change_password()}</button>
				</form>
			</section>
		</div>
		<div>
			<div class="oa-hub one">
				<a href="/account/2fa"
					><span class="ui-ico green" aria-hidden="true"><LineIcon name="check" size={20} /></span
					><span class="grow"
						>{m.account_2fa_manage()}<span class="sub">{m.ow_2fa_sub()}</span></span
					></a
				>
				<a href="/notifications"
					><span class="ui-ico blue" aria-hidden="true"><LineIcon name="bell" size={20} /></span
					><span class="grow">{m.notif_title()}<span class="sub">{m.ow_notif_sub()}</span></span></a
				>
				<a href="/owner/limits"
					><span class="ui-ico amber" aria-hidden="true"
						><LineIcon name="progress" size={20} /></span
					><span class="grow">{m.ow_limits()}<span class="sub">{m.ow_limits_sub()}</span></span></a
				>
			</div>
			<section class="ui-card oa-sec" aria-labelledby="room-h">
				<h2 id="room-h">{m.sl_room_switch_h()}</h2>
				<p class="small">{m.sl_room_switch_lead()}</p>
				<p class="small">
					<strong>{data.videoRoom ? m.sl_room_is_on() : m.sl_room_is_off()}</strong>
				</p>
				<form method="POST" action="?/videoRoom">
					<input type="hidden" name="on" value={data.videoRoom ? '0' : '1'} />
					<button class="ui-btn-soft" type="submit"
						>{data.videoRoom ? m.sl_room_turn_off() : m.sl_room_turn_on()}</button
					>
				</form>
			</section>
			{#if data.testSite}
				<section class="ui-card cream oa-sec" aria-labelledby="test-h">
					<h2 id="test-h">{m.owner_test_h()}</h2>
					<p class="small">{m.owner_test_lead()}</p>
					<Sure
						label={m.owner_test_reset()}
						action="?/resetTest"
						lead={m.owner_test_lead()}
						sure={m.owner_test_sure()}
					/>
				</section>
			{/if}
			<form method="POST" action="/logout">
				<button class="ui-btn-soft" type="submit">{m.nav_logout()}</button>
			</form>
		</div>
	</div>

	<div id="family-pay">
		<OwnerFamilySettings
			settings={data.familySettings}
			saved={!!(form && 'familySaved' in form && form.familySaved)}
		/>
	</div>
	<div id="pro-settings">
		<OwnerProSettings
			settings={data.familySettings}
			saved={!!(form && 'proSaved' in form && form.proSaved)}
		/>
	</div>
	<div id="gifts">
		<OwnerGifts gifts={data.gifts} form={form as Record<string, unknown> | null} />
	</div>
</div>

<style>
	.oa-hub.one {
		grid-template-columns: 1fr;
	}
</style>
