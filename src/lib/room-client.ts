/**
 * Lesson room in the browser: WebRTC between phones (audio by default),
 * whiteboard + chat over a data channel, set-up messages through /room/[id]/signal.
 * Low data: Opus audio ~24 kbps with silence suppression; video only on request, 360p.
 */

export interface Person {
	userId: string;
	name: string;
	isTutor: boolean;
	status: 'waiting' | 'admitted' | 'left';
}
export interface Stroke {
	c: string;
	w: number;
	/** points in 0..1 coordinates so the board looks the same on every screen */
	p: [number, number][];
}
export type BoardMsg =
	| { t: 'stroke'; s: Stroke }
	| { t: 'clear' }
	| { t: 'sync'; strokes: Stroke[] }
	| { t: 'chat'; name: string; text: string }
	| { t: 'file' };

export interface RoomEvents {
	people(p: Person[]): void;
	admitted(v: boolean): void;
	files(f: { id: number; name: string; url: string }[]): void;
	message(m: BoardMsg, from: string): void;
	remoteStream(userId: string, s: MediaStream): void;
	remoteGone(userId: string): void;
	quality(q: 0 | 1 | 2 | 3, mb: number): void;
	state(s: 'connecting' | 'live' | 'reconnecting' | 'error', detail?: string): void;
}

const AUDIO_BPS = 24_000;
const VIDEO_BPS_LOW = 300_000;
const VIDEO_BPS_HIGH = 900_000;

/** Ask Opus for low bitrate, mono, with silence suppression (DTX). */
export function tuneOpus(sdp: string): string {
	const m = /a=rtpmap:(\d+) opus\/48000/i.exec(sdp);
	if (!m) return sdp;
	const pt = m[1];
	const re = new RegExp(`a=fmtp:${pt} ([^\\r\\n]*)`);
	const extra = `maxaveragebitrate=${AUDIO_BPS};usedtx=1;stereo=0;useinbandfec=1`;
	if (re.test(sdp)) {
		return sdp.replace(re, (_l, params: string) => {
			const kept = params
				.split(';')
				.filter((x) => !/^(maxaveragebitrate|usedtx|stereo|useinbandfec)=/.test(x.trim()));
			return `a=fmtp:${pt} ${[...kept, extra].filter(Boolean).join(';')}`;
		});
	}
	return sdp.replace(m[0], `${m[0]}\r\na=fmtp:${pt} ${extra}`);
}

export class RoomClient {
	private pcs = new Map<string, RTCPeerConnection>();
	private channels = new Map<string, RTCDataChannel>();
	private after = 0;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private stopped = false;
	private local: MediaStream | null = null;
	private video: MediaStreamTrack | null = null;
	private screen: MediaStreamTrack | null = null;
	private fails = 0;
	private bytes = 0;
	private statsTimer: ReturnType<typeof setInterval> | null = null;
	private hd = false;
	private making = new Set<string>();
	admitted = false;
	/** who is in the room, from the server (used to trust messages by sender) */
	private people: Person[] = [];
	strokes: Stroke[] = [];

	constructor(
		private lessonId: number,
		private me: { id: string; name: string; isTutor: boolean },
		private ice: RTCIceServer[],
		private on: RoomEvents
	) {}

	async start() {
		this.on.state('connecting');
		try {
			this.local = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
					channelCount: 1
				},
				video: false
			});
		} catch {
			this.on.state('error', 'mic');
			this.local = new MediaStream();
		}
		this.loop();
		this.statsTimer = setInterval(() => this.measure(), 3000);
	}

	private async api(body: unknown) {
		const res = await fetch(`/room/${this.lessonId}/signal`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!res.ok) throw new Error(String(res.status));
		return res.json();
	}

	/** Poll for set-up messages: fast while connecting, slower once the call is running. */
	private async loop() {
		if (this.stopped) return;
		let wait: number;
		try {
			const r = (await this.api({ op: 'poll', after: this.after })) as {
				admitted: boolean;
				people: Person[];
				signals: { id: number; from: string; kind: string; payload: string }[];
				files: { id: number; name: string; url: string }[];
			};
			this.fails = 0;
			if (r.admitted !== this.admitted) {
				this.admitted = r.admitted;
				this.on.admitted(r.admitted);
			}
			this.people = r.people;
			this.on.people(r.people);
			this.on.files(r.files);
			for (const s of r.signals) {
				this.after = Math.max(this.after, s.id);
				await this.handleSignal(s.from, s.kind, s.payload);
			}
			if (this.admitted) this.connectTo(r.people);
			const allLive = [...this.pcs.values()].every((pc) => pc.connectionState === 'connected');
			wait = this.admitted && this.pcs.size && allLive ? 4000 : 1500;
			if (this.admitted && this.pcs.size && allLive) this.on.state('live');
		} catch {
			this.fails++;
			this.on.state('reconnecting');
			wait = Math.min(15000, 1500 * 2 ** this.fails);
		}
		this.timer = setTimeout(() => this.loop(), wait);
	}

	/** The person with the "smaller" id makes the offer, so two phones never both offer. */
	private connectTo(people: Person[]) {
		const here = new Set(people.filter((p) => p.status === 'admitted').map((p) => p.userId));
		for (const p of people) {
			if (p.userId === this.me.id || p.status !== 'admitted') continue;
			// creating the connection triggers "negotiationneeded", which sends the offer
			if (!this.pcs.has(p.userId) && this.me.id < p.userId) this.peer(p.userId);
		}
		for (const id of [...this.pcs.keys()]) if (!here.has(id)) this.drop(id);
	}

	private peer(other: string): RTCPeerConnection {
		let pc = this.pcs.get(other);
		if (pc) return pc;
		pc = new RTCPeerConnection({ iceServers: this.ice });
		this.pcs.set(other, pc);
		for (const t of this.local?.getTracks() ?? []) pc.addTrack(t, this.local!);
		if (this.video) pc.addTrack(this.video, this.local!);
		if (this.screen) pc.addTrack(this.screen, this.local!);
		const dc = pc.createDataChannel('room', { negotiated: true, id: 0, ordered: true });
		this.channels.set(other, dc);
		dc.onopen = () => {
			if (this.me.isTutor && this.strokes.length)
				this.sendTo(other, { t: 'sync', strokes: this.strokes });
		};
		dc.onmessage = (e) => {
			try {
				const msg = JSON.parse(String(e.data)) as BoardMsg;
				// only the tutor may wipe or replace the whole board
				const fromTutor = this.people.some((p) => p.userId === other && p.isTutor);
				if ((msg.t === 'clear' || msg.t === 'sync') && !fromTutor) return;
				if (msg.t === 'sync' && (!Array.isArray(msg.strokes) || msg.strokes.length > 5000)) return;
				if (msg.t === 'stroke') this.strokes.push(msg.s);
				if (msg.t === 'clear') this.strokes = [];
				if (msg.t === 'sync') this.strokes = msg.strokes;
				this.on.message(msg, other);
			} catch {
				/* ignore bad messages */
			}
		};
		pc.onicecandidate = (e) => {
			if (e.candidate)
				void this.api({
					op: 'send',
					to: other,
					kind: 'ice',
					payload: JSON.stringify(e.candidate)
				}).catch(() => {});
		};
		pc.ontrack = (e) => this.on.remoteStream(other, e.streams[0] ?? new MediaStream([e.track]));
		pc.onconnectionstatechange = () => {
			if (pc!.connectionState === 'failed') void this.restart(other);
		};
		// "perfect negotiation": either side may (re)negotiate, e.g. when turning video on
		pc.onnegotiationneeded = () => void this.offer(other);
		return pc;
	}

	private async offer(other: string, iceRestart = false) {
		const pc = this.peer(other);
		try {
			this.making.add(other);
			const offer = await pc.createOffer({ iceRestart });
			if (pc.signalingState !== 'stable') return;
			await pc.setLocalDescription({ type: 'offer', sdp: tuneOpus(offer.sdp ?? '') });
			await this.limitBitrates(pc);
			await this.api({
				op: 'send',
				to: other,
				kind: 'offer',
				payload: JSON.stringify(pc.localDescription)
			}).catch(() => {});
		} catch {
			/* will retry on the next negotiation */
		} finally {
			this.making.delete(other);
		}
	}

	private async handleSignal(from: string, kind: string, payload: string) {
		try {
			if (kind === 'bye') return this.drop(from);
			const pc = this.peer(from);
			if (kind === 'offer') {
				// two offers crossed: the "polite" side (bigger id) gives way, the other ignores
				const polite = this.me.id > from;
				const collision = this.making.has(from) || pc.signalingState !== 'stable';
				if (collision && !polite) return;
				if (collision) await pc.setLocalDescription({ type: 'rollback' });
				await pc.setRemoteDescription(JSON.parse(payload));
				const answer = await pc.createAnswer();
				await pc.setLocalDescription({ type: 'answer', sdp: tuneOpus(answer.sdp ?? '') });
				await this.limitBitrates(pc);
				await this.api({
					op: 'send',
					to: from,
					kind: 'answer',
					payload: JSON.stringify(pc.localDescription)
				});
			} else if (kind === 'answer') {
				if (pc.signalingState === 'have-local-offer')
					await pc.setRemoteDescription(JSON.parse(payload));
			} else if (kind === 'ice') {
				await pc.addIceCandidate(JSON.parse(payload)).catch(() => {});
			}
		} catch {
			/* a broken message: the connection will retry */
		}
	}

	/** Keep data use low: audio ~24 kbps, video 360p ~300 kbps (or higher if the tutor allows). */
	private async limitBitrates(pc: RTCPeerConnection) {
		for (const s of pc.getSenders()) {
			if (!s.track) continue;
			const p = s.getParameters();
			p.encodings = p.encodings?.length ? p.encodings : [{}];
			if (s.track.kind === 'audio') p.encodings[0].maxBitrate = AUDIO_BPS;
			else {
				const isScreen = s.track === this.screen;
				p.encodings[0].maxBitrate = isScreen ? 500_000 : this.hd ? VIDEO_BPS_HIGH : VIDEO_BPS_LOW;
				p.encodings[0].maxFramerate = isScreen ? 5 : 15;
			}
			await s.setParameters(p).catch(() => {});
		}
	}

	private async restart(other: string) {
		this.on.state('reconnecting');
		if (this.me.id < other) await this.offer(other, true);
	}

	private drop(other: string) {
		this.pcs.get(other)?.close();
		this.pcs.delete(other);
		this.channels.delete(other);
		this.on.remoteGone(other);
	}

	private sendTo(other: string, msg: BoardMsg) {
		const dc = this.channels.get(other);
		if (dc?.readyState === 'open') dc.send(JSON.stringify(msg));
	}

	broadcast(msg: BoardMsg) {
		if (msg.t === 'stroke') this.strokes.push(msg.s);
		if (msg.t === 'clear') this.strokes = [];
		for (const id of this.channels.keys()) this.sendTo(id, msg);
	}

	admit(userId: string) {
		return this.api({ op: 'admit', userId });
	}

	setMuted(muted: boolean) {
		for (const t of this.local?.getAudioTracks() ?? []) t.enabled = !muted;
	}

	async setVideo(on: boolean, hd = false): Promise<MediaStream | null> {
		this.hd = hd;
		if (!on) {
			if (this.video) {
				for (const pc of this.pcs.values())
					for (const s of pc.getSenders()) if (s.track === this.video) pc.removeTrack(s);
				this.video.stop();
				this.video = null;
			}
			return null;
		}
		if (!this.video) {
			const v = await navigator.mediaDevices.getUserMedia({
				video: {
					width: { ideal: hd ? 1280 : 640 },
					height: { ideal: hd ? 720 : 360 },
					frameRate: { max: 15 },
					facingMode: 'user'
				}
			});
			this.video = v.getVideoTracks()[0];
			for (const pc of this.pcs.values()) pc.addTrack(this.video, this.local!);
		}
		for (const pc of this.pcs.values()) await this.limitBitrates(pc);
		return new MediaStream([this.video]);
	}

	async setScreen(on: boolean) {
		if (!on) {
			if (this.screen) {
				for (const pc of this.pcs.values())
					for (const s of pc.getSenders()) if (s.track === this.screen) pc.removeTrack(s);
				this.screen.stop();
				this.screen = null;
			}
			return;
		}
		const d = await navigator.mediaDevices.getDisplayMedia({
			video: { frameRate: { max: 5 } },
			audio: false
		});
		this.screen = d.getVideoTracks()[0];
		this.screen.onended = () => void this.setScreen(false);
		for (const pc of this.pcs.values()) pc.addTrack(this.screen, this.local!);
		for (const pc of this.pcs.values()) await this.limitBitrates(pc);
	}

	/** Connection quality from round-trip time and packet loss; and data used so far. */
	private async measure() {
		let worst: 0 | 1 | 2 | 3 = this.pcs.size ? 3 : 0;
		let total = 0;
		for (const pc of this.pcs.values()) {
			const stats = await pc.getStats().catch(() => null);
			if (!stats) continue;
			stats.forEach((r) => {
				if (r.type === 'transport') total += (r.bytesSent ?? 0) + (r.bytesReceived ?? 0);
				if (r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded') {
					const rtt = r.currentRoundTripTime ?? 0;
					const q = rtt > 0.6 ? 1 : rtt > 0.3 ? 2 : 3;
					if (q < worst) worst = q as 1 | 2 | 3;
				}
				if (r.type === 'inbound-rtp' && r.kind === 'audio' && r.packetsReceived > 50) {
					const loss = r.packetsLost / (r.packetsLost + r.packetsReceived);
					const q = loss > 0.1 ? 1 : loss > 0.03 ? 2 : 3;
					if (q < worst) worst = q as 1 | 2 | 3;
				}
			});
		}
		this.bytes = Math.max(this.bytes, total);
		this.on.quality(worst, this.bytes / 1_048_576);
	}

	async stop() {
		this.stopped = true;
		if (this.timer) clearTimeout(this.timer);
		if (this.statsTimer) clearInterval(this.statsTimer);
		for (const id of [...this.pcs.keys()]) {
			await this.api({ op: 'send', to: id, kind: 'bye', payload: '{}' }).catch(() => {});
			this.drop(id);
		}
		for (const t of this.local?.getTracks() ?? []) t.stop();
		this.video?.stop();
		this.screen?.stop();
		await this.api({ op: 'leave' }).catch(() => {});
	}
}
