<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDay } from '#lib/tz.ts';
	import Sure from '#lib/components/owner/Sure.svelte';
	/**
	 * Owner: give Tutora Family or Tutora Pro free to chosen people (search by name or email,
	 * choose the plan, optional end date), and the list of gifts with Remove.
	 */
	type Person = { id: string; name: string; email: string; role: string | null };
	type Gift = Person & {
		userId: string;
		plan: string;
		until: Date | string | null;
		note: string | null;
	};
	let {
		gifts,
		form = null
	}: {
		gifts: { list: (Omit<Gift, 'id'> & { id: number })[]; q: string; found: Person[] };
		form?: Record<string, unknown> | null;
	} = $props();
</script>

<section class="ui-card stack-s" aria-labelledby="gift-h">
	<h2 id="gift-h" class="ui-serif">{m.gift_title()}</h2>
	<p class="small muted">{m.gift_lead()}</p>
	{#if form?.giftSaved}<p class="notice" role="status">{m.gift_saved()}</p>{/if}
	{#if form?.giftRemoved}<p class="notice" role="status">{m.gift_removed()}</p>{/if}
	{#if form?.giftError}<p class="alert" role="alert">{t(String(form.giftError))}</p>{/if}
	<form method="GET" action="#gifts" class="gift-search">
		<label class="field"
			><span>{m.gift_search()}</span><input
				name="gq"
				value={gifts.q}
				minlength="2"
				autocomplete="off"
			/></label
		>
		<button class="ui-btn-soft" type="submit">{m.gift_find()}</button>
	</form>
	{#if gifts.q && !gifts.found.length}<p class="small muted">{m.gift_none_found()}</p>{/if}
	{#each gifts.found as p (p.id)}
		<form method="POST" action="?/giftGive" class="gift-give ui-card">
			<input type="hidden" name="userId" value={p.id} />
			<p><strong>{p.name}</strong> <span class="small muted">{p.email} · {p.role}</span></p>
			<label class="field"
				><span>{m.gift_plan()}</span>
				<select name="plan">
					{#if p.role === 'tutor'}<option value="pro">Tutora Pro</option>{:else}<option
							value="family">Tutora Family</option
						>{/if}
				</select></label
			>
			<label class="field"><span>{m.gift_until()}</span><input type="date" name="until" /></label>
			<label class="field"><span>{m.gift_note()}</span><input name="note" maxlength="120" /></label>
			<button class="ui-btn" type="submit">{m.gift_give()}</button>
		</form>
	{/each}
	<h3 class="ui-serif">{m.gift_list()}</h3>
	{#if !gifts.list.length}
		<p class="small muted">{m.gift_empty()}</p>
	{:else}
		<ul class="gift-list" role="list">
			{#each gifts.list as g (g.id)}
				<li>
					<div>
						<strong>{g.name}</strong>
						<span class="small muted">{g.email}</span>
						<span class="ui-pill ok">{g.plan === 'pro' ? 'Tutora Pro' : 'Tutora Family'}</span>
						<span class="small"
							>{g.until
								? m.gift_until_date({ date: fmtDay(new Date(g.until)) })
								: m.gift_no_end()}{g.note ? ` · ${g.note}` : ''}</span
						>
					</div>
					<Sure
						label={m.gift_remove()}
						action="?/giftRemove"
						fields={{ id: String(g.id) }}
						lead={m.gift_remove_lead()}
						sure={m.gift_remove_sure()}
					/>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.gift-search,
	.gift-give {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		align-items: flex-end;
	}
	.gift-give p {
		flex-basis: 100%;
		margin: 0;
	}
	.field {
		display: grid;
		gap: 0.25rem;
	}
	.gift-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.6rem;
	}
	.gift-list li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.5rem;
		border-top: 1px solid rgba(0, 0, 0, 0.08);
		padding-top: 0.5rem;
	}
	.gift-list li div {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}
</style>
