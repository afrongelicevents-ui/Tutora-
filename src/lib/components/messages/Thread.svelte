<script lang="ts">
	// One conversation: bubbles (mine on the right), and the write box unless read-only.
	import { enhance } from '$app/forms';
	import { m, t } from '#lib/i18n.ts';
	import { fmtDayTime } from '#lib/tz.ts';
	let {
		messages,
		meId,
		names,
		readOnly = false,
		note = '',
		error = null
	}: {
		messages: { id: number; fromId: string; body: string; createdAt: Date | string }[];
		meId: string;
		/** id → name, for who wrote each message */
		names: Record<string, string>;
		readOnly?: boolean;
		note?: string;
		error?: string | null;
	} = $props();
	let text = $state('');
	let box = $state<HTMLElement | null>(null);
	$effect(() => {
		void messages.length;
		box?.scrollTo({ top: box.scrollHeight });
	});
</script>

{#if note}<p class="tnote">{note}</p>{/if}
<div class="thread" bind:this={box} aria-live="polite">
	{#if messages.length}
		<ul>
			{#each messages as msg (msg.id)}
				<li class:mine={msg.fromId === meId}>
					<p>{msg.body}</p>
					<span class="meta">{names[msg.fromId] ?? ''} · {fmtDayTime(new Date(msg.createdAt))}</span
					>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="none">{m.msg_none()}</p>
	{/if}
</div>
{#if !readOnly}
	{#if error}<p class="alert" role="alert">{t(error)}</p>{/if}
	<form
		method="POST"
		action="?/send"
		class="write"
		use:enhance={() =>
			async ({ result, update }) => {
				if (result.type === 'success') text = '';
				await update({ reset: false });
			}}
	>
		<label class="sr-only" for="msg-body">{m.msg_write()}</label>
		<textarea
			id="msg-body"
			name="body"
			rows="2"
			maxlength="1000"
			required
			placeholder={m.msg_write()}
			aria-describedby="msg-hint"
			bind:value={text}></textarea>
		<button class="btn" type="submit">{m.msg_send()}</button>
	</form>
	<p class="hint" id="msg-hint">{m.msg_hint()}</p>
{/if}

<style>
	.tnote {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--muted);
		background: var(--ice);
		border-radius: 12px;
		padding: 10px 12px;
	}
	.thread {
		max-height: 60vh;
		overflow-y: auto;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	li {
		align-self: flex-start;
		max-width: 82%;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 18px 18px 18px 6px;
		padding: 10px 14px;
	}
	li.mine {
		align-self: flex-end;
		background: var(--navy);
		border-color: var(--navy);
		color: #fff;
		border-radius: 18px 18px 6px 18px;
	}
	li p {
		margin: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		line-height: 1.45;
	}
	.meta {
		display: block;
		margin-top: 4px;
		font-size: 0.75rem;
		opacity: 0.75;
	}
	.none {
		color: var(--muted);
		margin: 0;
	}
	.write {
		display: flex;
		gap: 8px;
		align-items: flex-end;
	}
	.write textarea {
		flex: 1;
		min-height: 48px;
		border-radius: 16px;
		border: 1px solid var(--border-strong);
		padding: 10px 12px;
		font: inherit;
		resize: vertical;
	}
	.write .btn {
		background: var(--navy);
	}
	.hint {
		margin: 0;
		font-size: 0.75rem;
		color: var(--muted);
	}
</style>
