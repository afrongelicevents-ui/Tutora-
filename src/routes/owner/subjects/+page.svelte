<script lang="ts">
	import Head from '#lib/components/owner/Head.svelte';
	import Flash from '#lib/components/owner/Flash.svelte';
	import Empty from '#lib/components/owner/Empty.svelte';
	import Sure from '#lib/components/owner/Sure.svelte';
	import LineIcon from '#lib/components/LineIcon.svelte';
	import { m } from '#lib/i18n.ts';
	let { data, form } = $props();
</script>

<svelte:head><title>{m.ow_subjects()} · {m.ow_label()} · Tutora</title></svelte:head>

<div class="oa">
	<Head title={m.ow_subjects()} lead={m.oc_subjects_lead()} icon="book" tone="amber" />
	<Flash error={form?.error} done={data.done} />

	<form method="POST" action="?/addSubject" class="ui-card oa-search">
		<input
			name="name"
			maxlength="60"
			aria-label={m.oc_subject_new()}
			placeholder={m.oc_subject_new()}
			value={form && 'name' in form ? form.name : ''}
		/>
		<button class="ui-btn" type="submit">+ {m.add()}</button>
	</form>

	{#if data.subjects.length}
		<ul class="oa-cards two">
			{#each data.subjects as s (s.id)}
				<li class="ui-card oa-card" data-subject={s.name}>
					<div class="who">
						<span class="ui-ico blue" aria-hidden="true"><LineIcon name="book" size={18} /></span>
						<span class="grow name">{s.name}</span>
						<!-- two steps, so a mis-tap never removes a subject -->
						<Sure
							label={m.remove()}
							action="?/removeSubject"
							fields={{ id: String(s.id) }}
							lead={m.ow_subject_remove_lead()}
							sure={m.oc_subject_remove_sure({ name: s.name })}
							open={!!(form && 'removeFor' in form && form.removeFor === s.id)}
						/>
					</div>
				</li>
			{/each}
		</ul>
	{:else}
		<Empty icon="book" text={m.oc_subjects_none()} />
	{/if}
</div>
