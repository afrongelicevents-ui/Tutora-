<!--
	"Attach from Google Drive": opens the Google Picker and posts the picked file to a form
	action. Google's scripts load only when the button is tapped (low data). The browser asks
	Google Identity Services for its OWN short-lived drive.file token; the server's stored
	tokens never come to the browser. The server checks the file again before saving it.
-->
<script lang="ts" module>
	interface TokenResponse {
		access_token?: string;
		expires_in?: number;
		error?: string;
	}
	interface PickedDoc {
		id: string;
		name?: string;
		url?: string;
	}
	interface PickerData {
		action: string;
		docs?: PickedDoc[];
	}
	interface PickerBuilder {
		addView(v: unknown): PickerBuilder;
		setOAuthToken(t: string): PickerBuilder;
		setDeveloperKey(k: string): PickerBuilder;
		setAppId(id: string): PickerBuilder;
		setOrigin(o: string): PickerBuilder;
		setCallback(cb: (d: PickerData) => void): PickerBuilder;
		build(): { setVisible(v: boolean): void };
	}
	interface GoogleNS {
		accounts: {
			oauth2: {
				initTokenClient(c: {
					client_id: string;
					scope: string;
					callback: (r: TokenResponse) => void;
					error_callback?: (e: { type?: string }) => void;
				}): { requestAccessToken(o?: { prompt?: string }): void };
			};
		};
		picker: {
			PickerBuilder: new () => PickerBuilder;
			DocsView: new (viewId?: unknown) => unknown;
			ViewId: { DOCS: unknown };
			Action: { PICKED: string; CANCEL: string };
		};
	}
	type W = Window & { google?: GoogleNS; gapi?: { load(name: string, cb: () => void): void } };

	const scripts: Record<string, Promise<void> | undefined> = {};
	function loadScript(src: string) {
		let p = scripts[src];
		if (!p) {
			p = new Promise<void>((resolve, reject) => {
				const s = document.createElement('script');
				s.src = src;
				s.async = true;
				s.onload = () => resolve();
				s.onerror = () => {
					scripts[src] = undefined;
					reject(new Error('load'));
				};
				document.head.appendChild(s);
			});
			scripts[src] = p;
		}
		return p;
	}
	let pickerLoaded: Promise<void> | null = null;
	async function loadGoogle() {
		await Promise.all([
			loadScript('https://accounts.google.com/gsi/client'),
			loadScript('https://apis.google.com/js/api.js')
		]);
		const w = window as W;
		pickerLoaded ??= new Promise<void>((resolve) => w.gapi!.load('picker', () => resolve()));
		await pickerLoaded;
	}
	/** this page's own browser token (memory only, never stored) */
	let browserToken: { value: string; until: number } | null = null;
</script>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '#lib/i18n.ts';

	let {
		config,
		action,
		fields = {},
		label
	}: {
		/** from the server: { clientId, apiKey, appId } (public picker settings); null hides it */
		config: { clientId: string; apiKey: string; appId: string } | null;
		/** form action that receives fileId, name and url, e.g. "?/attachDrive" */
		action: string;
		/** extra hidden fields, e.g. { homeworkId: '12' } */
		fields?: Record<string, string>;
		label?: string;
	} = $props();

	let phase = $state<'idle' | 'loading' | 'tap' | 'picking' | 'sending'>('idle');
	let problem = $state('');
	let fileId = $state('');
	let name = $state('');
	let url = $state('');
	let formEl: HTMLFormElement | undefined = $state();

	function showPicker(token: string) {
		const g = (window as W).google!;
		phase = 'picking';
		const picker = new g.picker.PickerBuilder()
			.addView(new g.picker.DocsView(g.picker.ViewId.DOCS))
			.setOAuthToken(token)
			.setDeveloperKey(config!.apiKey)
			.setAppId(config!.appId)
			.setOrigin(window.location.origin)
			.setCallback((d) => {
				if (d.action === g.picker.Action.PICKED && d.docs?.[0]) {
					const doc = d.docs[0];
					fileId = doc.id;
					name = doc.name ?? '';
					url = doc.url ?? '';
					phase = 'sending';
					queueMicrotask(() => formEl?.requestSubmit());
				} else if (d.action === g.picker.Action.CANCEL) {
					phase = 'idle';
				}
			})
			.build();
		picker.setVisible(true);
	}

	function askToken() {
		if (browserToken && browserToken.until > Date.now()) return showPicker(browserToken.value);
		const g = (window as W).google!;
		const client = g.accounts.oauth2.initTokenClient({
			client_id: config!.clientId,
			scope: 'https://www.googleapis.com/auth/drive.file',
			callback: (r) => {
				if (!r.access_token) {
					phase = 'idle';
					problem = m.tools6_drive_problem();
					return;
				}
				browserToken = {
					value: r.access_token,
					until: Date.now() + Math.max(0, (r.expires_in ?? 0) - 60) * 1000
				};
				showPicker(r.access_token);
			},
			error_callback: () => {
				phase = 'idle';
				problem = m.tools6_drive_popup();
			}
		});
		client.requestAccessToken({ prompt: '' });
	}

	async function open() {
		problem = '';
		if (!config) return;
		if (phase === 'tap') return askToken();
		const started = Date.now();
		phase = 'loading';
		try {
			await loadGoogle();
		} catch {
			phase = 'idle';
			problem = m.tools6_drive_load();
			return;
		}
		// a popup must follow a tap quickly; on a slow line ask for one more tap
		if (Date.now() - started > 3000) phase = 'tap';
		else askToken();
	}
</script>

{#if config}
	<form
		method="POST"
		{action}
		bind:this={formEl}
		use:enhance={() =>
			async ({ update }) => {
				phase = 'idle';
				await update();
			}}
	>
		{#each Object.entries(fields) as [k, v] (k)}<input type="hidden" name={k} value={v} />{/each}
		<input type="hidden" name="fileId" value={fileId} />
		<input type="hidden" name="name" value={name} />
		<input type="hidden" name="url" value={url} />
		<button
			class="btn btn-ghost btn-block"
			type="button"
			onclick={open}
			disabled={phase === 'loading' || phase === 'picking' || phase === 'sending'}
			aria-busy={phase === 'loading' || phase === 'sending'}
		>
			{phase === 'loading'
				? m.tools6_drive_loading()
				: phase === 'tap'
					? m.tools6_drive_open()
					: phase === 'sending'
						? m.tools6_drive_saving()
						: (label ?? m.tools6_drive_attach())}
		</button>
		{#if problem}<p class="note" role="alert">{problem}</p>{/if}
	</form>
{/if}
