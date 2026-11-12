<!--
	Lesson materials, homework files and revision resources as thin-divider rows:
	the title (opens the file or link) and where it comes from (Google Drive, Kahoot!, Link).
	Pass `removeAction` (e.g. "?/removeMaterial") to show a Remove button per row (tutor side).
-->
<script lang="ts">
	import { m } from '#lib/i18n.ts';

	interface Item {
		id: number;
		kind: 'drive' | 'kahoot' | 'link' | 'file';
		title: string;
		url?: string | null;
		/** a link for uploaded files (kind "file"), e.g. a signed /files link */
		href?: string | null;
	}

	let {
		items,
		empty,
		removeAction,
		idField = 'id'
	}: {
		items: Item[];
		/** shown when there is nothing (omit to show nothing) */
		empty?: string;
		removeAction?: string;
		/** name of the hidden id field posted to removeAction */
		idField?: string;
	} = $props();

	const source = (k: Item['kind']) =>
		k === 'drive'
			? m.tools6_src_drive()
			: k === 'kahoot'
				? m.tools6_src_kahoot()
				: k === 'file'
					? m.tools6_src_file()
					: m.tools6_src_link();
	const link = (i: Item) => {
		const u = i.href ?? i.url;
		return u && (u.startsWith('https://') || u.startsWith('/')) ? u : null;
	};
</script>

{#if items.length}
	<ul class="rows mat">
		{#each items as i (i.id)}
			<li>
				{#if link(i)}
					<a class="title" href={link(i)} target="_blank" rel="noopener noreferrer">{i.title}</a>
				{:else}
					<span class="title">{i.title}</span>
				{/if}
				<span class="right">
					<span class="src">{source(i.kind)}</span>
					{#if removeAction}
						<form method="POST" action={removeAction}>
							<input type="hidden" name={idField} value={i.id} />
							<button
								class="rm"
								type="submit"
								aria-label={m.tools6_remove_named({ title: i.title })}>{m.tools6_remove()}</button
							>
						</form>
					{/if}
				</span>
			</li>
		{/each}
	</ul>
{:else if empty}
	<p class="note">{empty}</p>
{/if}

<style>
	.title {
		min-width: 0;
		overflow-wrap: anywhere;
		color: var(--text);
	}
	a.title {
		text-decoration: underline;
		text-decoration-color: var(--border-strong);
		text-underline-offset: 3px;
	}
	a.title:hover {
		color: var(--navy);
	}
	.right {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
	}
	.src {
		color: var(--muted);
		font-size: 0.875rem;
	}
	.rm {
		background: none;
		border: none;
		color: var(--danger-700);
		font: inherit;
		font-size: 0.875rem;
		font-weight: 600;
		min-height: 44px;
		padding: 0 4px;
		cursor: pointer;
	}
</style>
