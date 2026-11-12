<script lang="ts">
	import { m } from '#lib/i18n.ts';
	interface SetValues {
		kind: string;
		title: string;
		subject: string;
		topic: string;
		level: string | null;
		dailyChecks: boolean;
	}
	let { set = null }: { set?: SetValues | null } = $props();
</script>

<fieldset class="kind">
	<legend class="label">{m.st5_kind()}</legend>
	<div class="chips">
		<label class="chip"
			><input
				type="radio"
				name="kind"
				value="quiz"
				checked={!set || set.kind === 'quiz'}
			/>{m.st5_kind_quiz()}</label
		>
		<label class="chip"
			><input
				type="radio"
				name="kind"
				value="test"
				checked={set?.kind === 'test'}
			/>{m.st5_kind_test()}</label
		>
	</div>
</fieldset>
<div class="field">
	<label for="s-title">{m.st5_set_title()}</label>
	<input id="s-title" name="title" required maxlength="120" defaultValue={set?.title ?? ''} />
</div>
<div class="field">
	<label for="s-subject">{m.st5_subject()}</label>
	<input id="s-subject" name="subject" required maxlength="60" defaultValue={set?.subject ?? ''} />
</div>
<div class="field">
	<label for="s-topic">{m.st5_topic()}</label>
	<input id="s-topic" name="topic" required maxlength="80" defaultValue={set?.topic ?? ''} />
</div>
<div class="field">
	<label for="s-level">{m.st5_level_opt()}</label>
	<input
		id="s-level"
		name="level"
		maxlength="40"
		placeholder={m.st5_level_ph()}
		defaultValue={set?.level ?? ''}
	/>
</div>
<label class="toggle-row"
	><span>{m.st5_daily_toggle()}<span class="hint block">{m.st5_daily_toggle_hint()}</span></span
	><input type="checkbox" name="dailyChecks" checked={set ? set.dailyChecks : true} /></label
>

<style>
	.kind {
		border: 0;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.kind legend {
		padding: 0;
		margin-bottom: 8px;
	}
	.block {
		display: block;
	}
</style>
