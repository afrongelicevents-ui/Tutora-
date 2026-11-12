<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { formatMoney } from '#lib/money.ts';
	let { data } = $props();
</script>

<svelte:head><title>{m.students_title()} · Tutora</title></svelte:head>

<section class="screen">
	<h1>{m.students_title()}</h1>
	<p class="note">{m.tut3_students_lead()}</p>
	<form method="GET" class="row" role="search">
		<label class="sr-only" for="q">{m.search()}</label>
		<input
			id="q"
			name="q"
			type="search"
			value={data.q}
			placeholder={m.search_name()}
			class="grow input"
		/>
		<button class="btn btn-ghost btn-sm" type="submit">{m.search()}</button>
	</form>
	<ul class="rows top">
		{#each data.students as s (s.id)}
			<li>
				<a href="/tutor/students/{s.id}" class="who">
					<strong>{s.name}</strong>{#if s.childName}
						<span class="note">({m.for_child({ name: s.childName })})</span>{/if}
					{#if s.level || (s.isUnder18 && s.parentName)}<span class="note block"
							>{s.level ?? ''}{s.level && s.isUnder18 && s.parentName ? ' · ' : ''}{s.isUnder18 &&
							s.parentName
								? `${m.parent()}: ${s.parentName}`
								: ''}</span
						>{/if}
				</a>
				{#if s.owed > 0}<span class="warn-t small"
						>{m.owes({ amount: formatMoney(s.owed, data.currency) })}</span
					>{:else}<span class="ok-t small">{m.paid_up()}</span>{/if}
			</li>
		{:else}
			<li class="note">{data.q ? m.no_match() : m.students_empty()}</li>
		{/each}
	</ul>
</section>

<style>
	.who {
		flex: 1;
		min-width: 0;
		color: var(--text);
		text-decoration: none;
	}
	.who:hover strong {
		color: var(--plum);
	}
</style>
