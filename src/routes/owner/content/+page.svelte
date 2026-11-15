<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { shrink } from '#lib/shrink.ts';
	let { data, form } = $props();
</script>

<svelte:head><title>{m.on_content()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<h1>{m.on_content()}</h1>
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if data.done}<p class="notice" role="status">{t(data.done)}</p>{/if}

	<form method="POST" action="?/photo" enctype="multipart/form-data" class="card stack">
		<h2 class="h3">{m.oc_photo()}</h2>
		<p class="small muted">{m.oc_photo_lead()}</p>
		<!-- the photo the homepage shows now (the standard one until one is uploaded) -->
		<img
			src={data.c.heroPhoto ? `/hero-photo?v=${data.c.heroPhotoV}` : '/hero.webp'}
			alt={m.oc_photo_now()}
			width="240"
			height="300"
			style="width:160px;height:auto;border-radius:12px"
		/>
		{#if !data.c.heroPhoto}<p class="small muted">{m.oc_photo_standard()}</p>{/if}
		<input
			name="photo"
			type="file"
			accept="image/jpeg,image/png,image/webp"
			use:shrink={{ max: 800, quality: 0.55 }}
		/>
		{#if data.c.heroPhoto}<label class="check"
				><input type="checkbox" name="remove" /> <span>{m.oc_photo_remove()}</span></label
			>{/if}
		<button class="btn btn-block" type="submit">{m.save()}</button>
	</form>

	<form method="POST" action="?/texts" class="card stack">
		<h2 class="h3">{m.oc_texts()}</h2>
		<p class="small muted">{m.oc_texts_lead()}</p>
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
		<textarea id="h3" name="joinLead" maxlength="200" rows="2" placeholder={m.join_lead()}
			>{data.c.joinLead}</textarea
		>
		<button class="btn btn-block" type="submit">{m.save()}</button>
	</form>

	<div class="card stack">
		<h2 class="h3">{m.oc_subjects()}</h2>
		<p class="small muted">{m.oc_subjects_lead()}</p>
		<ul class="list">
			{#each data.subjects as s (s.id)}
				<li>
					<span>{s.name}</span>
					<!-- two steps, so a mis-tap never removes a subject -->
					<details class="small">
						<summary>{m.remove()}</summary>
						<form method="POST" action="?/removeSubject" class="stack">
							<input type="hidden" name="id" value={s.id} />
							<label class="check"
								><input type="checkbox" name="sure" />
								<span>{m.oc_subject_remove_sure({ name: s.name })}</span></label
							>
							<button class="btn btn-warn btn-sm" type="submit">{m.remove()}</button>
						</form>
					</details>
				</li>
			{:else}
				<li class="small muted">{m.oc_subjects_none()}</li>
			{/each}
		</ul>
		<form method="POST" action="?/addSubject" class="row">
			<input
				class="grow"
				name="name"
				maxlength="60"
				aria-label={m.oc_subject_new()}
				placeholder={m.oc_subject_new()}
			/>
			<button class="btn btn-sm" type="submit">{m.add()}</button>
		</form>
	</div>
</section>
