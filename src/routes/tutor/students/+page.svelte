<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { formatMoney } from '#lib/money.ts';
	let { data } = $props();
</script>

<svelte:head><title>{m.students_title()} · Tutora</title></svelte:head>

<section class="wrap narrow">
	<h1>{m.students_title()}</h1>
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
		<button class="btn btn-secondary btn-sm" type="submit">{m.search()}</button>
	</form>
	<ul class="list card" style="margin-top:12px">
		{#each data.students as s (s.id)}
			<li>
				<a href="/tutor/students/{s.id}" class="grow">
					<b>{s.name}</b>{#if s.childName}<span class="small">
							({m.for_child({ name: s.childName })})</span
						>{/if}
					<span class="small muted block"
						>{s.level ?? ''}{s.isUnder18 && s.parentName
							? ` · ${m.parent()}: ${s.parentName}`
							: ''}</span
					>
				</a>
				{#if s.owed > 0}<span class="pill p-no"
						>{m.owes({ amount: formatMoney(s.owed, data.currency) })}</span
					>{:else}<span class="pill p-ok">{m.paid_up()}</span>{/if}
			</li>
		{:else}
			<li class="empty">{data.q ? m.no_match() : m.students_empty()}</li>
		{/each}
	</ul>
</section>
