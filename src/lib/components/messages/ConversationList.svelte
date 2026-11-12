<script lang="ts">
	import { m } from '#lib/i18n.ts';
	import { ago } from '#lib/ago.ts';
	import Face from '#lib/components/people/Face.svelte';
	import LineIcon from '#lib/components/LineIcon.svelte';
	let {
		items,
		hrefFor,
		empty
	}: {
		items: {
			otherId: string;
			otherName: string;
			slug: string | null;
			hasPhoto: boolean;
			photoVersion: number;
			last: string;
			lastAt: Date | string;
			lastFromMe: boolean;
			unread: number;
		}[];
		hrefFor: (id: string) => string;
		empty: string;
	} = $props();
</script>

{#if items.length}
	<ul class="box">
		{#each items as c (c.otherId)}
			<li>
				<a class="row" href={hrefFor(c.otherId)}>
					<Face
						name={c.otherName}
						src={c.hasPhoto && c.slug ? `/t/${c.slug}/photo?v=${c.photoVersion}` : null}
						size={48}
					/>
					<span class="rbody">
						<strong>{c.otherName}</strong>
						<span class="snip">{c.lastFromMe ? m.tt_you({ text: c.last }) : c.last}</span>
					</span>
					<span class="when"
						>{ago(new Date(c.lastAt))}{#if c.unread}<span class="dot"
								><span class="sr-only">{m.tt_unread({ n: c.unread, name: c.otherName })}</span
								></span
							>{/if}</span
					>
					<LineIcon name="chevron" size={20} />
				</a>
			</li>
		{/each}
	</ul>
{:else}
	<p class="muted">{empty}</p>
{/if}

<style>
	.box {
		list-style: none;
		margin: 0;
		padding: 0;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 22px;
		overflow: hidden;
	}
	.box li + li {
		border-top: 1px solid var(--border);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px;
		color: var(--navy);
		text-decoration: none;
	}
	.rbody {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.snip {
		color: var(--muted);
		font-size: 0.875rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.when {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--muted);
		font-size: 0.8125rem;
		white-space: nowrap;
	}
	.dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--ocean);
	}
</style>
