<script lang="ts">
	import { m, t } from '#lib/i18n.ts';
	import { fmtDayTime } from '#lib/tz.ts';
	import Hero from '#lib/components/ui/Hero.svelte';
	import ProLocked from '#lib/components/pro/ProLocked.svelte';
	import ProPill from '#lib/components/pro/ProPill.svelte';
	let { data, form } = $props();
	const l = $derived(data.lesson);
</script>

<svelte:head><title>{m.pro_class_title()} · Tutora</title></svelte:head>

<section class="screen">
	<Hero
		title={m.pro_class_title()}
		lead={`${l.subjectName ?? ''} · ${fmtDayTime(new Date(l.startsAt))}`}
	/>
	<div class="ui-page stack">
		<p><a href="/tutor/lessons/{l.id}">← {m.pro_class_back()}</a></p>
		{#if form?.error}<p class="alert" role="alert">{t(String(form.error))}</p>{/if}
		{#if form && 'messaged' in form}<p class="notice" role="status">
				{m.pro_class_messaged({ n: Number(form.messaged) })}
			</p>{/if}
		{#if form && 'marked' in form}<p class="notice" role="status">{m.saved()}</p>{/if}

		<article class="ui-card stack-s">
			<h2 class="ui-serif">{m.pro_class_list({ n: data.people.length })}</h2>
			<ul class="cls">
				{#each data.people as p (p.attendeeId)}
					<li>
						<a href="/tutor/students/{p.userId}">{p.name}</a>
						<span class="small muted"
							>{p.attendance === 'completed'
								? m.pro_class_present()
								: p.attendance === 'absent'
									? m.pro_class_absent()
									: m.pro_class_unmarked()}</span
						>
					</li>
				{:else}
					<li class="muted">{m.tut3_nobody()}</li>
				{/each}
			</ul>
		</article>

		{#if !data.pro}
			<ProLocked feature="groups" />
		{:else if data.people.length}
			<article class="ui-card stack-s">
				<h2 class="ui-serif"><ProPill /> {m.pro_class_msg_h()}</h2>
				<form method="POST" action="?/messageAll" class="stack-s">
					<label class="field"
						><span>{m.pro_class_msg_l()}</span>
						<textarea name="text" rows="3" maxlength="2000" required></textarea></label
					>
					<button class="ui-btn" type="submit">{m.pro_class_msg_btn()}</button>
				</form>
			</article>

			<article class="ui-card stack-s">
				<h2 class="ui-serif"><ProPill /> {m.pro_class_hw_h()}</h2>
				<form
					method="POST"
					action="/tutor/homework?/send"
					enctype="multipart/form-data"
					class="stack-s"
				>
					{#each data.people as p (p.attendeeId)}<input
							type="hidden"
							name="to"
							value={p.userId}
						/>{/each}
					{#if l.subjectName}<input type="hidden" name="subject" value={l.subjectName} />{/if}
					<label class="field"
						><span>{m.pro_class_hw_title()}</span><input
							name="title"
							required
							maxlength="120"
						/></label
					>
					<label class="field"
						><span>{m.pro_class_hw_note()}</span><textarea name="note" rows="2" maxlength="2000"
						></textarea></label
					>
					<label class="field"
						><span>{m.pro_class_hw_due()}</span><input
							type="date"
							name="dueOn"
							min={data.today}
						/></label
					>
					<button class="ui-btn" type="submit">{m.pro_class_hw_btn()}</button>
				</form>
			</article>

			{#if data.canMark}
				<article class="ui-card stack-s">
					<h2 class="ui-serif"><ProPill /> {m.pro_class_mark_h()}</h2>
					<p class="small muted">{m.pro_class_mark_lead()}</p>
					<form method="POST" action="?/markAll">
						<button class="ui-btn-soft" type="submit">{m.pro_class_mark_btn()}</button>
					</form>
				</article>
			{/if}

			<article class="ui-card stack-s">
				<h2 class="ui-serif">{m.pro_class_link_h()}</h2>
				{#if data.classLink}
					<p class="small">
						<a href={data.classLink} target="_blank" rel="noopener">{data.classLink}</a>
					</p>
				{:else}
					<p class="small muted">{m.pro_class_link_none()}</p>
				{/if}
				<p><a class="ui-btn-soft" href="/tutor/lessons/{l.id}">{m.pro_class_link_edit()}</a></p>
			</article>
		{/if}
	</div>
</section>

<style>
	.cls {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.4rem;
	}
	.cls li {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.field {
		display: grid;
		gap: 0.25rem;
	}
</style>
