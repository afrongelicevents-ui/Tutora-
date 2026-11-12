<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	let { data, form } = $props();
	const child = $derived(data.kids.find((k) => k.id === data.current));
</script>

<svelte:head><title>{m.pb_title()} · Tutora</title></svelte:head>

<div class="screen">
	<a class="back" href="/parent{data.current ? `?child=${data.current}` : ''}"
		>← {m.v3_nav_overview()}</a
	>
	<h1>{m.pb_title()}{child ? ` · ${child.name}` : ''}</h1>
	{#if data.kids.filter((k) => k.status === 'active').length > 1}
		<nav class="chips">
			{#each data.kids.filter((k) => k.status === 'active') as k (k.id)}
				<a
					class="chip"
					href="?child={k.id}"
					aria-current={k.id === data.current ? 'page' : undefined}>{k.name}</a
				>
			{/each}
		</nav>
	{/if}
	<p class="lead">{m.pb_lead()}</p>
	{#if form?.error}<p class="alert" role="alert">{t(form.error)}</p>{/if}
	{#if form?.done || form?.removed}<p class="notice" role="status">
			{form?.removed ? m.bv_removed() : m.om_done()}
		</p>{/if}

	{#if data.list.length}
		<ul class="list">
			{#each data.list as b (b.linkId)}
				<li>
					<span class="who"
						><strong>{b.displayName}</strong><span class="small muted"
							>{[
								b.grade,
								b.status === 'active'
									? m.pb_active()
									: b.needsMe
										? m.pb_needs_you()
										: m.pb_waiting_other()
							]
								.filter(Boolean)
								.join(' · ')}</span
						></span
					>
					<span class="acts">
						{#if b.needsMe}
							<form method="POST" action="?/decide">
								<input type="hidden" name="link" value={b.linkId} /><input
									type="hidden"
									name="approve"
									value="1"
								/><button class="btn btn-sm" type="submit">{m.pb_approve()}</button>
							</form>
							<form method="POST" action="?/decide">
								<input type="hidden" name="link" value={b.linkId} /><input
									type="hidden"
									name="approve"
									value="0"
								/><button class="btn btn-secondary btn-sm" type="submit">{m.pb_decline()}</button>
							</form>
						{:else}
							<form method="POST" action="?/remove">
								<input type="hidden" name="link" value={b.linkId} /><button
									class="btn btn-secondary btn-sm"
									type="submit">{m.pb_remove()}</button
								>
							</form>
						{/if}
					</span>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="muted">{m.pb_none()}</p>
	{/if}
</div>

<style>
	.back {
		align-self: flex-start;
		color: var(--ocean);
		font-weight: 600;
		text-decoration: none;
		padding: 8px 0;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 18px;
	}
	.list li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		padding: 12px 14px;
	}
	.list li + li {
		border-top: 1px solid var(--border);
	}
	.who {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 160px;
	}
	.acts {
		display: flex;
		gap: 8px;
	}
	.chips {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.chip[aria-current='page'] {
		background: var(--navy);
		color: #fff;
	}
</style>
