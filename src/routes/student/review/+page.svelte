<script lang="ts">
	import { page } from '$app/state';
	import { m, t } from '#lib/i18n.ts';
	let { data, form } = $props();
</script>

<svelte:head><title>{m.leave_review()} · Tutora</title></svelte:head>

<section class="screen">
	<h1>{m.leave_review()}</h1>
	{#if data.tutorName}<p class="muted">{m.with_tutor({ name: data.tutorName })}</p>{/if}
	{#if page.url.searchParams.has('thanks')}<p class="notice" role="status">
			{m.review_thanks()}
		</p>{/if}
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if !data.allowed}
		<p class="panel">{m.review_after_lesson()}</p>
	{:else}
		<p class="small muted">{m.review_lead()}</p>
		<form method="POST" class="card stack" novalidate>
			<fieldset>
				<legend>{m.stars()}</legend>
				<div class="choice five">
					{#each [5, 4, 3, 2, 1] as n (n)}<label
							><input
								type="radio"
								name="rating"
								value={n}
								checked={(data.mine?.rating ?? 5) === n}
							/>
							{n}★</label
						>{/each}
				</div>
			</fieldset>
			<div class="field">
				<label for="rt">{m.your_review()}</label><textarea
					id="rt"
					name="text"
					rows="4"
					maxlength="600"
					required>{data.mine?.text ?? ''}</textarea
				>
			</div>
			<button class="btn btn-block" type="submit"
				>{data.mine ? m.update_review() : m.post_review()}</button
			>
		</form>
	{/if}
</section>
