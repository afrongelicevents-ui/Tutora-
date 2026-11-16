<script lang="ts">
	import Head from '#lib/components/owner/Head.svelte';
	import Flash from '#lib/components/owner/Flash.svelte';
	import LineIcon from '#lib/components/LineIcon.svelte';
	import { m } from '#lib/i18n.ts';
	let { data } = $props();
</script>

<svelte:head><title>{m.ow_texts()} · {m.ow_label()} · Tutora</title></svelte:head>

<div class="oa">
	<Head title={m.ow_texts()} lead={m.oc_texts_lead()} icon="pencil" tone="amber" />
	<Flash done={data.done} />

	<div class="ui-cols">
		<div>
			<form method="POST" action="?/texts" class="ui-card oa-form">
				<h2>{m.oc_texts()}</h2>
				<label for="h1">{m.oc_title()}</label>
				<input
					id="h1"
					name="heroTitle"
					maxlength="80"
					value={data.c.heroTitle}
					placeholder={m.v3_tagline()}
				/>
				<label for="h2">{m.oc_lead()}</label>
				<input
					id="h2"
					name="heroLead"
					maxlength="200"
					value={data.c.heroLead}
					placeholder={m.v3_welcome_lead()}
				/>
				<label for="h3">{m.oc_join()}</label>
				<textarea id="h3" name="joinLead" maxlength="200" rows="3" placeholder={m.join_lead()}
					>{data.c.joinLead}</textarea
				>
				<button class="ui-btn" type="submit">{m.save()}</button>
			</form>
		</div>
		<div>
			<div class="oa-hub one">
				<a href="/owner/photos"
					><span class="ui-ico blue" aria-hidden="true"><LineIcon name="sun" size={20} /></span
					><span class="grow">{m.ow_photos()}<span class="sub">{m.ow_photos_sub()}</span></span></a
				>
				<a href="/owner/subjects"
					><span class="ui-ico amber" aria-hidden="true"><LineIcon name="book" size={20} /></span
					><span class="grow">{m.ow_subjects()}<span class="sub">{m.ow_subjects_sub()}</span></span
					></a
				>
				<a href="/" target="_blank" rel="noopener"
					><span class="ui-ico green" aria-hidden="true"><LineIcon name="eye" size={20} /></span
					><span class="grow">{m.ow_see_home()}<span class="sub">{m.ow_see_home_sub()}</span></span
					></a
				>
			</div>
		</div>
	</div>
</div>

<style>
	.oa-hub.one {
		grid-template-columns: 1fr;
	}
</style>
