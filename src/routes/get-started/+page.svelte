<script lang="ts">
	import { m } from '#lib/i18n.ts';
</script>

<svelte:head><title>{m.v3_who_title()} · Tutora</title></svelte:head>

<div class="screen narrowish">
	<a class="back" href="/" aria-label={m.v3_back()}>←</a>
	<h1>{m.v3_who_title()}</h1>
	<p class="lead">{m.v3_who_lead()}</p>
	<a class="who" href="/signup">
		<span><strong>{m.v3_im_student()}</strong><span>{m.v3_im_student_sub()}</span></span>
		<span aria-hidden="true">›</span>
	</a>
	<a class="who" href="/join">
		<span><strong>{m.v3_im_tutor()}</strong><span>{m.v3_im_tutor_sub()}</span></span>
		<span aria-hidden="true">›</span>
	</a>
	<p class="code">{m.v3_have_code()} <a href="/code">{m.v3_join_with_code()}</a></p>
</div>

<style>
	.narrowish {
		max-width: 520px;
		min-height: 100dvh;
		margin: 0 auto;
	}
	.lead {
		margin: 0 0 8px;
	}
	.who {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		background: #fff;
		border: 1.5px solid var(--border);
		border-radius: 20px;
		padding: 20px;
		color: var(--plum);
		text-decoration: none;
		font-size: 1.25rem;
	}
	.who:hover {
		border-color: var(--plum);
		color: var(--plum);
	}
	.who > span:first-child {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.who strong {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 1.375rem;
	}
	.who span span {
		font-size: 0.9375rem;
		line-height: 1.4;
		color: var(--muted);
	}
	.code {
		margin-top: auto;
		text-align: center;
		font-size: 0.9375rem;
		color: var(--muted);
	}
	.code a {
		display: inline-block;
		padding: 12px 4px;
		color: var(--plum);
		font-weight: 700;
	}
</style>
