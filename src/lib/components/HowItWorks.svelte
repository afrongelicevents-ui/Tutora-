<script lang="ts">
	// "How Tutora works": a short page in simple words for each role.
	import { m } from '#lib/i18n.ts';
	import LineIcon, { type IconName } from '#lib/components/LineIcon.svelte';
	let { role, back }: { role: 'student' | 'parent' | 'tutor'; back: string } = $props();
	type Item = [IconName, string, string];
	const ITEMS: Record<typeof role, () => Item[]> = {
		student: () => [
			['video', m.help_lessons_h(), m.help_s_lessons()],
			['clipboard', m.help_hw_h(), m.help_s_hw()],
			['check', m.help_tests_h(), m.help_s_tests()],
			['doc', m.help_reports_h(), m.help_s_reports()],
			['wallet', m.help_pay_h(), m.help_pay_common()],
			['family', m.help_family_h(), m.help_family_line()],
			['eye', m.help_safety_h(), m.help_s_safety()]
		],
		parent: () => [
			['video', m.help_lessons_h(), m.help_p_lessons()],
			['clipboard', m.help_hw_h(), m.help_p_hw()],
			['doc', m.help_reports_h(), m.help_p_reports()],
			['wallet', m.help_pay_h(), `${m.help_pay_common()} ${m.help_p_pay()}`],
			['family', m.help_family_h(), m.help_family_line()],
			['link', m.help_tools_h(), m.help_tools_line()],
			['eye', m.help_safety_h(), m.help_p_safety()]
		],
		tutor: () => [
			['video', m.help_lessons_h(), m.help_t_lessons()],
			['clipboard', m.help_hw_h(), m.help_t_hw()],
			['check', m.help_tests_h(), m.help_t_tests()],
			['doc', m.help_reports_h(), m.help_t_reports()],
			['wallet', m.help_pay_h(), m.help_t_pay()],
			['trophy', m.help_pro_h(), m.help_pro_line()],
			['link', m.help_tools_h(), m.help_tools_line()],
			['eye', m.help_safety_h(), m.help_t_safety()]
		]
	};
	const items = $derived(ITEMS[role]());
</script>

<svelte:head><title>{m.help_nav()} · Tutora</title></svelte:head>

<section class="screen help">
	<a class="back" href={back} aria-label={m.v3_back()}>←</a>
	<h1>{m.help_nav()}</h1>
	<p class="lead">{m.help_lead()}</p>
	<ol class="steps">
		{#each items as [icon, title, body] (title)}
			<li class="softcard">
				<span class="ic" aria-hidden="true"><LineIcon name={icon} size={22} /></span>
				<div>
					<h2>{title}</h2>
					<p>{body}</p>
				</div>
			</li>
		{/each}
	</ol>
	<p class="note">{m.help_more_q()} <a href="/contact">{m.help_contact()}</a></p>
</section>

<style>
	.back {
		align-self: flex-start;
	}
	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.steps li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 12px;
		align-items: start;
	}
	.ic {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		background: var(--ice);
		color: var(--navy);
	}
	h2 {
		margin: 0 0 4px;
		font-size: 1.0625rem;
		color: var(--navy);
	}
	p {
		margin: 0;
		line-height: 1.5;
	}
</style>
