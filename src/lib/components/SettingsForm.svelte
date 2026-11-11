<script lang="ts">
	import Field from './Field.svelte';
	import { m, t } from '#lib/i18n.ts';
	import { shrink } from '#lib/shrink.ts';
	import { minutesToHHMM } from '#lib/tz.ts';
	import { formatMoney } from '#lib/money.ts';
	import type { Section } from '#lib/server/sections.ts';

	type Data = {
		settings: Record<string, unknown> & {
			lessonModes: string;
			groupMode: string;
			maxGroupSize: number;
			lessonMinutes: number;
			cancelHours: number;
			currency: 'USD' | 'ZWG';
			showPrices: boolean;
			defaultPriceCents: number | null;
			photoKey: string | null;
			photoVersion: number;
			resultsConsent: boolean;
		};
		subjects: { id: number; name: string; levels: string; priceCents: number | null }[];
		packages: { id: number; name: string; lessonCount: number; priceCents: number }[];
		times: { weekday: number; startMinute: number; endMinute: number }[];
		results: { id: number; value: string; label: string }[];
		email?: string;
		emailOn?: boolean;
	};
	let {
		section,
		data,
		form,
		submitLabel
	}: { section: Section; data: Data; form: Record<string, unknown> | null; submitLabel: string } =
		$props();

	const s = $derived(data.settings);
	const v = (k: string) => (s[k] ?? '') as string;
	const e = $derived((form?.errors ?? {}) as Record<string, string>);
	const cents = (c: number | null | undefined) => (c == null ? '' : (c / 100).toFixed(2));
	const days = $derived([
		m.day_sun(),
		m.day_mon(),
		m.day_tue(),
		m.day_wed(),
		m.day_thu(),
		m.day_fri(),
		m.day_sat()
	]);
	const timeFor = (d: number) => data.times.find((x) => x.weekday === d);
</script>

{#if form?.saved}<p class="notice" role="status">{m.saved()}</p>{/if}

{#if section === 'profile'}
	<form method="POST" action="?/profile" enctype="multipart/form-data" class="stack" novalidate>
		<Field
			name="tutorName"
			label={m.set_name()}
			hint={m.set_name_hint()}
			value={v('tutorName')}
			error={e.tutorName}
			autocomplete="name"
		/>
		<div class="field">
			<label for="f-photo">{m.set_photo()}</label>
			<span class="hint" id="f-photo-hint">{m.set_photo_hint()}</span>
			{#if s.photoKey}<img
					src="/tutor/photo?v={s.photoVersion}"
					alt=""
					width="96"
					height="96"
					class="avatar-img"
				/>{/if}
			<input
				id="f-photo"
				name="photo"
				type="file"
				accept="image/jpeg,image/png,image/webp"
				aria-describedby="f-photo-hint"
				use:shrink={{ max: 480, quality: 0.8 }}
			/>
			{#if e.photo}<span class="error">{t(e.photo)}</span>{/if}
			{#if s.photoKey}<label class="check"
					><input type="checkbox" name="removePhoto" /> <span>{m.set_photo_remove()}</span></label
				>{/if}
		</div>
		<Field
			name="headline"
			label={m.set_headline()}
			hint={m.set_headline_hint()}
			value={v('headline')}
			error={e.headline}
		/>
		<div class="field">
			<label for="f-bio">{m.set_bio()}</label>
			<textarea id="f-bio" name="bio" maxlength="2000" rows="5" defaultValue={v('bio')}></textarea>
			{#if e.bio}<span class="error">{t(e.bio)}</span>{/if}
		</div>
		<Field
			name="qualifications"
			label={m.set_qualifications()}
			value={v('qualifications')}
			error={e.qualifications}
		/>
		<Field
			name="yearsTeaching"
			label={m.set_years()}
			inputmode="numeric"
			value={v('yearsTeaching') === '' ? '' : String(s.yearsTeaching)}
			error={e.yearsTeaching}
		/>
		<div class="field">
			<label for="f-style">{m.set_style()}</label>
			<textarea
				id="f-style"
				name="teachingStyle"
				maxlength="1000"
				rows="3"
				defaultValue={v('teachingStyle')}></textarea>
		</div>
		<Field
			name="town"
			label={m.set_town()}
			hint={m.set_town_hint()}
			value={v('town')}
			error={e.town}
		/>
		<button class="btn btn-block" type="submit">{submitLabel}</button>
	</form>
{:else if section === 'subjects'}
	<p class="muted small">{m.set_subjects_lead()}</p>
	{#each data.subjects as subj (subj.id)}
		<details class="card">
			<summary class="summary-row"
				><span><b>{subj.name}</b><br /><span class="small muted">{subj.levels}</span></span><span
					class="small">{m.edit()}</span
				></summary
			>
			<form method="POST" action="?/editSubject" class="stack" style="margin-top:12px">
				<input type="hidden" name="id" value={subj.id} />
				<Field
					name="name"
					id="sn-{subj.id}"
					label={m.set_subject_name()}
					value={subj.name}
					required
				/>
				<Field
					name="levels"
					id="sl-{subj.id}"
					label={m.set_levels()}
					hint={m.set_levels_hint()}
					value={subj.levels}
				/>
				<Field
					name="price"
					id="sp-{subj.id}"
					label={m.set_subject_price({ currency: s.currency })}
					inputmode="decimal"
					value={cents(subj.priceCents)}
				/>
				<button class="btn btn-secondary" type="submit">{m.save()}</button>
			</form>
			<form method="POST" action="?/removeSubject" style="margin-top:8px">
				<input type="hidden" name="id" value={subj.id} />
				<button class="btn-link danger-link" type="submit">{m.set_subject_remove()}</button>
			</form>
		</details>
	{:else}
		<p class="panel small">{m.set_subjects_empty()}</p>
	{/each}
	<form method="POST" action="?/addSubject" class="card stack" novalidate>
		<h2 class="h3">{m.set_subject_add()}</h2>
		<Field
			name="name"
			id="new-subject"
			label={m.set_subject_name()}
			hint={m.set_subject_name_hint()}
			error={e.name}
			required
		/>
		<Field
			name="levels"
			id="new-levels"
			label={m.set_levels()}
			hint={m.set_levels_hint()}
			error={e.levels}
		/>
		<Field
			name="price"
			id="new-price"
			label={m.set_subject_price({ currency: s.currency })}
			hint={m.set_subject_price_hint()}
			inputmode="decimal"
			error={e.price}
		/>
		<button class="btn btn-secondary btn-block" type="submit">{m.set_subject_add()}</button>
	</form>
	<form method="POST" action="?/next">
		<button class="btn btn-block" type="submit">{submitLabel}</button>
	</form>
{:else if section === 'teaching'}
	<form method="POST" action="?/teaching" class="stack" novalidate>
		<fieldset>
			<legend>{m.set_group_mode()}</legend>
			{#each [['one_to_one', m.set_one_to_one(), m.set_one_to_one_hint()], ['groups', m.set_groups(), m.set_groups_hint()], ['both', m.set_both(), m.set_both_groups_hint()]] as [val, label, hint] (val)}
				<label class="big-choice"
					><input
						type="radio"
						name="groupMode"
						defaultValue={val}
						defaultChecked={s.groupMode === val}
					/><span><b>{label}</b><small>{hint}</small></span></label
				>
			{/each}
		</fieldset>
		<Field
			name="maxGroupSize"
			label={m.set_max_group()}
			hint={m.set_max_group_hint()}
			inputmode="numeric"
			value={String(s.maxGroupSize)}
			error={e.maxGroupSize}
		/>
		<fieldset>
			<legend>{m.set_modes()}</legend>
			<div class="choice three">
				{#each [['online', m.mode_online()], ['in_person', m.mode_in_person()], ['both', m.set_both()]] as [val, label] (val)}
					<label
						><input
							type="radio"
							name="lessonModes"
							defaultValue={val}
							defaultChecked={s.lessonModes === val}
						/>
						{label}</label
					>
				{/each}
			</div>
		</fieldset>
		<input type="hidden" name="lessonMinutes" value={s.lessonMinutes} />
		<input type="hidden" name="cancelHours" value={s.cancelHours} />
		<button class="btn btn-block" type="submit">{submitLabel}</button>
	</form>
{:else if section === 'prices'}
	<form method="POST" action="?/prices" class="stack" novalidate>
		<fieldset>
			<legend>{m.set_currency()}</legend>
			<div class="choice">
				<label
					><input type="radio" name="currency" value="USD" defaultChecked={s.currency === 'USD'} /> USD</label
				>
				<label
					><input type="radio" name="currency" value="ZWG" defaultChecked={s.currency === 'ZWG'} /> ZiG</label
				>
			</div>
		</fieldset>
		<Field
			name="defaultPrice"
			label={m.set_default_price({ currency: s.currency === 'ZWG' ? 'ZiG' : 'USD' })}
			hint={m.set_default_price_hint()}
			inputmode="decimal"
			value={cents(s.defaultPriceCents)}
			error={e.defaultPrice}
		/>
		{#each data.subjects as subj (subj.id)}
			<Field
				name="price_{subj.id}"
				label={m.set_price_for({ subject: subj.name })}
				inputmode="decimal"
				value={cents(subj.priceCents)}
				error={e[`price_${subj.id}`]}
			/>
		{/each}
		<fieldset>
			<legend>{m.set_show_prices()}</legend>
			<label class="big-choice"
				><input type="radio" name="showPrices" value="on" defaultChecked={s.showPrices} /><span
					><b>{m.set_show_prices_yes()}</b></span
				></label
			>
			<label class="big-choice"
				><input type="radio" name="showPrices" value="" defaultChecked={!s.showPrices} /><span
					><b>{m.set_show_prices_no()}</b></span
				></label
			>
		</fieldset>
		<button class="btn btn-block" type="submit">{submitLabel}</button>
	</form>
	<h2 class="h3" style="margin-top:24px">{m.set_packages()}</h2>
	<p class="small muted">{m.set_packages_lead()}</p>
	<ul class="list card">
		{#each data.packages as p (p.id)}
			<li>
				<span
					><b>{p.name}</b><br /><span class="small muted"
						>{m.lessons_count({ n: p.lessonCount })} · {formatMoney(p.priceCents, s.currency)}</span
					></span
				>
				<form method="POST" action="?/removePackage">
					<input type="hidden" name="id" value={p.id} /><button
						class="btn-link danger-link"
						type="submit">{m.remove()}</button
					>
				</form>
			</li>
		{:else}
			<li class="muted small">{m.set_packages_empty()}</li>
		{/each}
	</ul>
	<form method="POST" action="?/addPackage" class="card stack" novalidate>
		<Field
			name="name"
			id="pk-name"
			label={m.set_package_name()}
			hint={m.set_package_name_hint()}
			error={e.name}
		/>
		<Field
			name="lessonCount"
			id="pk-count"
			label={m.set_package_count()}
			inputmode="numeric"
			error={e.lessonCount}
		/>
		<Field
			name="price"
			id="pk-price"
			label={m.set_package_price({ currency: s.currency === 'ZWG' ? 'ZiG' : 'USD' })}
			inputmode="decimal"
			error={e.price}
		/>
		<button class="btn btn-secondary btn-block" type="submit">{m.set_package_add()}</button>
	</form>
{:else if section === 'times'}
	<form method="POST" action="?/times" class="stack" novalidate>
		<p class="small muted">{m.set_times_lead()}</p>
		{#each days as day, d (d)}
			{@const w = timeFor(d)}
			<div class="dayrow" class:off={!w}>
				<label class="check"
					><input type="checkbox" name="on{d}" defaultChecked={!!w} /> <b>{day}</b></label
				>
				<label class="sr-only" for="from{d}">{m.set_from({ day })}</label>
				<input
					id="from{d}"
					name="from{d}"
					type="time"
					step="900"
					defaultValue={w ? minutesToHHMM(w.startMinute) : '15:00'}
				/>
				<span aria-hidden="true">–</span>
				<label class="sr-only" for="to{d}">{m.set_to({ day })}</label>
				<input
					id="to{d}"
					name="to{d}"
					type="time"
					step="900"
					defaultValue={w ? minutesToHHMM(w.endMinute) : '18:00'}
				/>
				{#if e[`day${d}`]}<span class="error full">{t(e[`day${d}`])}</span>{/if}
			</div>
		{/each}
		<div class="field">
			<label for="f-len">{m.set_length()}</label>
			<select id="f-len" name="lessonMinutes">
				{#each [30, 45, 60, 90, 120] as n (n)}<option value={n} selected={s.lessonMinutes === n}
						>{m.minutes({ n })}</option
					>{/each}
			</select>
		</div>
		<div class="field">
			<label for="f-cancel">{m.set_cancel()}</label>
			<select id="f-cancel" name="cancelHours">
				{#each [0, 6, 12, 24, 48] as n (n)}<option value={n} selected={s.cancelHours === n}
						>{n === 0 ? m.set_cancel_any() : m.set_cancel_hours({ n })}</option
					>{/each}
			</select>
		</div>
		<button class="btn btn-block" type="submit">{submitLabel}</button>
	</form>
{:else if section === 'contact'}
	<form method="POST" action="?/contact" class="stack" novalidate>
		<Field
			name="whatsappNumber"
			type="tel"
			label={m.set_whatsapp()}
			hint={m.set_whatsapp_hint()}
			value={v('whatsappNumber')}
			error={e.whatsappNumber}
			autocomplete="tel"
		/>
		<Field name="phone" type="tel" label={m.set_phone()} value={v('phone')} error={e.phone} />
		<Field
			name="contactEmail"
			type="email"
			label={m.set_contact_email()}
			hint={m.set_contact_email_hint()}
			value={v('contactEmail')}
			error={e.contactEmail}
		/>
		<button class="btn btn-block" type="submit">{submitLabel}</button>
	</form>
{:else if section === 'payments'}
	<form method="POST" action="?/payments" class="stack" novalidate>
		<p class="small muted">{m.set_pay_lead()}</p>
		<fieldset class="card stack">
			<legend>{m.method_bank()}</legend>
			<Field name="bankName" label={m.set_bank_name()} value={v('bankName')} error={e.bankName} />
			<Field
				name="bankAccountName"
				label={m.set_account_name()}
				value={v('bankAccountName')}
				error={e.bankAccountName}
			/>
			<Field
				name="bankAccountNumber"
				label={m.set_account_number()}
				inputmode="numeric"
				value={v('bankAccountNumber')}
				error={e.bankAccountNumber}
			/>
			<Field
				name="bankBranch"
				label={m.set_branch()}
				value={v('bankBranch')}
				error={e.bankBranch}
			/>
		</fieldset>
		<fieldset class="card stack">
			<legend>EcoCash</legend>
			<Field
				name="ecocashNumber"
				type="tel"
				label={m.set_number()}
				value={v('ecocashNumber')}
				error={e.ecocashNumber}
			/>
			<Field
				name="ecocashName"
				label={m.set_registered_name()}
				value={v('ecocashName')}
				error={e.ecocashName}
			/>
		</fieldset>
		<fieldset class="card stack">
			<legend>InnBucks</legend>
			<Field
				name="innbucksNumber"
				type="tel"
				label={m.set_number()}
				value={v('innbucksNumber')}
				error={e.innbucksNumber}
			/>
			<Field
				name="innbucksName"
				label={m.set_registered_name()}
				value={v('innbucksName')}
				error={e.innbucksName}
			/>
		</fieldset>
		<div class="field">
			<label for="f-pnote">{m.set_pay_note()}</label>
			<textarea
				id="f-pnote"
				name="paymentNote"
				maxlength="300"
				rows="2"
				defaultValue={v('paymentNote')}></textarea>
		</div>
		<button class="btn btn-block" type="submit">{submitLabel}</button>
	</form>
{:else if section === 'results'}
	<p class="small muted">{m.set_results_lead()}</p>
	<ul class="list card">
		{#each data.results as r (r.id)}
			<li>
				<span><b>{r.value}</b> {r.label}</span>
				<form method="POST" action="?/removeResult">
					<input type="hidden" name="id" value={r.id} /><button
						class="btn-link danger-link"
						type="submit">{m.remove()}</button
					>
				</form>
			</li>
		{:else}
			<li class="muted small">{m.set_results_empty()}</li>
		{/each}
	</ul>
	<form method="POST" action="?/addResult" class="card stack" novalidate>
		<Field
			name="value"
			label={m.set_result_value()}
			hint={m.set_result_value_hint()}
			error={e.value}
		/>
		<Field
			name="label"
			label={m.set_result_label()}
			hint={m.set_result_label_hint()}
			error={e.label}
		/>
		<button class="btn btn-secondary btn-block" type="submit">{m.set_result_add()}</button>
	</form>
	<form method="POST" action="?/resultsConsent" class="card stack">
		<label class="check"
			><input type="checkbox" name="consent" defaultChecked={s.resultsConsent} />
			<span>{m.set_results_consent()}</span></label
		>
		<button class="btn btn-block" type="submit">{m.save()}</button>
	</form>
{:else if section === 'account'}
	<div class="card stack">
		<p class="small">{m.set_login_email()}: <b>{data.email}</b></p>
		{#if form?.emailSent}
			<p class="notice" role="status">{m.set_email_sent({ email: String(form.emailSent) })}</p>
		{:else}
			{#if form?.emailChanged}
				<p class="notice" role="status">{m.set_email_changed()}</p>
			{/if}
			<form method="POST" action="?/changeEmail" class="stack" novalidate>
				<Field
					name="newEmail"
					type="email"
					label={m.set_new_email()}
					hint={data.emailOn ? m.set_new_email_hint() : undefined}
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
				<button class="btn btn-secondary btn-block" type="submit">{m.set_change_email()}</button>
			</form>
		{/if}
	</div>
	<div class="card stack">
		<h2 class="h3">{m.set_change_password()}</h2>
		{#if form?.passwordChanged}
			<p class="notice" role="status">{m.set_password_changed()}</p>
		{/if}
		<form method="POST" action="?/changePassword" class="stack" novalidate>
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
			<button class="btn btn-secondary btn-block" type="submit">{m.set_change_password()}</button>
		</form>
		<a class="btn btn-secondary" href="/account/2fa">{m.account_2fa_manage()}</a>
	</div>
{/if}

<style>
	.avatar-img {
		width: 96px;
		height: 96px;
		border-radius: 50%;
		object-fit: cover;
		border: 3px solid var(--ochre-400);
	}
	.summary-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		min-height: 44px;
		cursor: pointer;
		list-style: none;
	}
	.danger-link {
		color: var(--danger-700);
	}
	.dayrow {
		display: grid;
		grid-template-columns: 1fr auto auto auto;
		gap: 8px;
		align-items: center;
	}
	.dayrow input[type='time'] {
		min-height: 44px;
		padding: 0 6px;
		border: 1.5px solid #8a948e;
		border-radius: 10px;
		font: inherit;
		background: var(--white);
	}
	.dayrow.off input[type='time'] {
		opacity: 0.55;
	}
	.dayrow .full {
		grid-column: 1 / -1;
	}
	.dayrow .check {
		padding-top: 0;
	}
</style>
