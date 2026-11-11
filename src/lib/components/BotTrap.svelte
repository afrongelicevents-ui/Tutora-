<script lang="ts">
	// Hidden from people (and screen readers); simple bots fill every field and post at once.
	const started = Date.now();
</script>

<div class="trap" aria-hidden="true">
	<label>Website <input name="website" tabindex="-1" autocomplete="off" /></label>
	<input type="hidden" name="started" value={started} />
</div>

<style>
	.trap {
		position: absolute;
		left: -10000px;
		width: 1px;
		height: 1px;
		overflow: hidden;
	}
</style>
