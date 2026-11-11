<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { formatMoney } from '#lib/money.ts';
	let { data } = $props();
	const site = $derived(data.site);
</script>

<svelte:head><title>{m.about_h()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<h1>{site.name ? m.about_name({ name: site.name }) : m.about_h()}</h1>
	{#if site.bio}<div class="card"><p class="prewrap">{site.bio}</p></div>{/if}
	<dl class="kv card">
		{#if site.qualifications}<dt>{m.qualifications()}</dt>
			<dd>{site.qualifications}</dd>{/if}
		{#if site.yearsTeaching}<dt>{m.experience()}</dt>
			<dd>{m.years_teaching({ n: site.yearsTeaching })}</dd>{/if}
		<dt>{m.lessons_word()}</dt>
		<dd>
			{site.lessonModes === 'online'
				? m.mode_online()
				: site.lessonModes === 'in_person'
					? m.mode_in_person()
					: m.online_and_in_person()}{site.town ? ` · ${site.town}` : ''}
		</dd>
		<dt>{m.lesson_types()}</dt>
		<dd>
			{site.groupMode === 'one_to_one'
				? m.set_one_to_one()
				: site.groupMode === 'groups'
					? m.groups_up_to({ n: site.maxGroupSize })
					: m.one_or_groups({ n: site.maxGroupSize })}
		</dd>
	</dl>
	{#if site.teachingStyle}<h2>{m.how_i_teach()}</h2>
		<p class="prewrap">{site.teachingStyle}</p>{/if}
	{#if site.packages.length}
		<h2>{m.set_packages()}</h2>
		{#each site.packages as p (p.id)}<div class="card subject">
				<b>{p.name}</b>{#if p.priceCents != null}<span class="price"
						>{formatMoney(p.priceCents, site.currency)}</span
					>{/if}
			</div>{/each}
	{/if}
	{#if site.has.subjects}<a class="btn btn-block" href="/student/book?tutor={site.slug}"
			>{m.home_book()}</a
		>{/if}
</section>
