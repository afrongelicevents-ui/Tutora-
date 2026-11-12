/* Tutora blueprint engine: tiny helpers + one shell per portal. Each screen is rendered twice
   (390 px and 1280 px) from the same markup; layout changes via container queries. */
const SCREENS = [];
const PORTALS = [];
const screen = (d) => SCREENS.push(d);
const portal = (d) => PORTALS.push(d);

/* ---------- content helpers ---------- */
const H = (t, sub = '') =>
	`<div class="ph"><h1>${t}</h1>${sub ? `<p class="lead">${sub}</p>` : ''}</div>`;
const card = (title, inner, cls = '') =>
	`<section class="card ${cls}">${title ? `<h2 class="ct">${title}</h2>` : ''}${inner}</section>`;
const list = (rows) =>
	`<ul class="list">${rows
		.map(
			(r) =>
				`<li><div><b>${r[0]}</b>${r[1] ? `<span>${r[1]}</span>` : ''}</div>${r[2] ? `<div class="r">${r[2]}</div>` : ''}</li>`
		)
		.join('')}</ul>`;
const tag = (t, k = 'ok') => `<span class="tag ${k}">${t}</span>`;
const btn = (t, k = '') => `<span class="btn ${k}">${t}</span>`;
const acts = (...b) => `<div class="acts">${b.join('')}</div>`;
const bars = (rows) =>
	`<div class="bars">${rows
		.map(
			([l, v, note, alt]) =>
				`<div class="bar ${alt ? 'alt' : ''}"><span>${l}</span><i><b style="width:${v}%"></b></i><em>${note ?? v + '%'}</em></div>`
		)
		.join('')}</div>`;
const spark = (pts, labels = []) => {
	const w = 300,
		h = 90,
		max = 100,
		step = w / (pts.length - 1);
	const p = pts
		.map((v, i) => `${(i * step).toFixed(1)},${(h - 8 - (v / max) * (h - 20)).toFixed(1)}`)
		.join(' ');
	return `<svg class="spark" viewBox="0 -4 ${w} ${h + 18}" preserveAspectRatio="none"><line x1="0" y1="${h - 8}" x2="${w}" y2="${h - 8}" stroke="#e6e0d6"/><polyline points="${p}" fill="none" stroke="#1f3a5f" stroke-width="2.5" vector-effect="non-scaling-stroke"/>${pts
		.map(
			(v, i) =>
				`<circle cx="${(i * step).toFixed(1)}" cy="${(h - 8 - (v / max) * (h - 20)).toFixed(1)}" r="3.5" fill="#1f3a5f" vector-effect="non-scaling-stroke"/>`
		)
		.join('')}${labels
		.map(
			(l, i) =>
				`<text x="${(i * step).toFixed(1)}" y="${h + 10}" font-size="10" fill="#5b665f" text-anchor="${i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}">${l}</text>`
		)
		.join('')}</svg>`;
};
const field = (l, v = '', ph = '', k = '') =>
	`<label class="fld"><span>${l}</span><span class="inp ${k} ${v ? '' : 'ph'}">${v || ph}</span></label>`;
const table = (heads, rows) =>
	`<div class="tbl"><div class="tr th">${heads.map((h) => `<span>${h}</span>`).join('')}</div>${rows
		.map(
			(r) =>
				`<div class="tr">${r.map((c, i) => `<span data-h="${heads[i]}">${c}</span>`).join('')}</div>`
		)
		.join('')}</div>`;
const g2 = (...x) => `<div class="g2">${x.join('')}</div>`;
const g3 = (...x) => `<div class="g3">${x.join('')}</div>`;
const g4 = (...x) => `<div class="g4">${x.join('')}</div>`;
const cols = (main, aside, cls = '') =>
	`<div class="cols ${cls}"><div>${main}</div><div>${aside}</div></div>`;
const note = (t, k = 'info') => `<p class="note ${k}">${t}</p>`;
const chips = (arr, on = 0) =>
	`<div class="chips">${arr.map((c, i) => `<span class="chip ${i === on ? 'on' : ''}">${c}</span>`).join('')}</div>`;
const seg = (arr, on = 0) =>
	`<div class="seg">${arr.map((c, i) => `<span class="${i === on ? 'on' : ''}">${c}</span>`).join('')}</div>`;
const week = (s) =>
	`<div class="week">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
		.map((d, i) => `<div>${d}<i class="${s[i] === 'y' ? 'y' : s[i] === 'p' ? 'p' : ''}"></i></div>`)
		.join('')}</div>`;
const kv = (rows) =>
	`<div class="kv">${rows.map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join('')}</div>`;
const todo = (rows) =>
	`<ul class="todo">${rows.map(([t, s, d]) => `<li class="${d ? 'done' : ''}">${t}${s ? `<span>${s}</span>` : ''}</li>`).join('')}</ul>`;
const tl = (rows) =>
	`<div class="tl">${rows.map(([t, s, d]) => `<div class="${d ? 'done' : ''}">${t}${s ? `<span>${s}</span>` : ''}</div>`).join('')}</div>`;
const prog = (v) => `<div class="prog"><b style="width:${v}%"></b></div>`;
const who = (ini, name, sub) =>
	`<div class="who"><span class="av">${ini}</span><div><b>${name}</b><div class="small muted">${sub}</div></div></div>`;
const r3 = (t, a, b, c) =>
	`<div class="row3"><span class="tm">${t}</span><div><b>${a}</b><span>${b}</span></div><div>${c}</div></div>`;
const empty = (t, x, a) =>
	`<div class="empty"><b>${t}</b><span class="muted">${x}</span>${a ? btn(a, 'sm') : ''}</div>`;

/* ---------- shells ---------- */
const WM = `<img src="wordmark.svg" alt="tutora" />`;
const WMlight = `<span class="wm">tut<i>o</i>ra</span>`;
const SHELL = {
	public: (d, b) =>
		`<header class="pub-h">${WM}<nav class="pub-links"><span>Find a tutor</span><span>Subjects</span><span>How Tutora works</span><span>Log in</span></nav><span class="burger">☰</span></header><div class="body">${b}</div><footer class="pub-f">Privacy · Terms · Contact · Proudly built for Zimbabwe</footer>`,
	student: (d, b) => {
		const tabs = ['Home', 'Lessons', 'Study', 'Progress', 'More'];
		const top = [
			'Home',
			'Lessons',
			'Homework',
			'Assessments',
			'Study plan',
			'Progress',
			'Messages'
		];
		return `<header class="st-h">${WM}<span class="sp"></span><span class="bell">Alerts · 2</span><span class="av">R</span></header><nav class="topnav">${top
			.map((t) => `<span class="${t === d.top ? 'on' : ''}">${t}</span>`)
			.join('')}</nav><div class="body">${b}</div><nav class="tabbar">${tabs
			.map((t) => `<span class="${t === d.tab ? 'on' : ''}">${t}</span>`)
			.join('')}</nav>`;
	},
	parent: (d, b) => {
		const tabs = ['Overview', 'Learning', 'Lessons', 'Payments', 'More'];
		const top = [
			'Overview',
			'Subjects',
			'Study habits',
			'Homework',
			'Results',
			'Lessons',
			'Reports',
			'Payments',
			'Partnership'
		];
		const kids = d.noKids
			? ''
			: `<div class="kids"><span class="kid on"><i>R</i>Rudo · Form 2</span><span class="kid"><i>T</i>Tino · Grade 6</span><span class="kid">+ Add child</span></div>`;
		return `<header class="pa-h"><div class="pa-top">${WM}<span class="role">Parent</span><span class="sp"></span><span class="bell">Alerts · 1</span><span class="av">M</span></div>${kids}<nav class="topnav">${top
			.map((t) => `<span class="${t === d.top ? 'on' : ''}">${t}</span>`)
			.join('')}</nav></header><div class="body">${b}</div><nav class="tabbar">${tabs
			.map((t) => `<span class="${t === d.tab ? 'on' : ''}">${t}</span>`)
			.join('')}</nav>`;
	},
	tutor: (d, b) => {
		const side = [
			['', 'Today'],
			['', 'Calendar'],
			['', 'Bookings'],
			['Students', 'Students'],
			['', 'Homework'],
			['', 'Assessments'],
			['', 'Marking'],
			['', 'Study habits'],
			['', 'Curriculum'],
			['', 'Partnership'],
			['Business', 'Earnings'],
			['', 'My page & settings']
		];
		const tabs = ['Today', 'Calendar', 'Students', 'Work', 'Money'];
		return `<aside class="tu-side">${WMlight}${side
			.map(
				([g, t]) =>
					`${g ? `<span class="grp">${g}</span>` : ''}<span class="${t === d.side ? 'on' : ''}">${t}</span>`
			)
			.join(
				''
			)}</aside><div><header class="tu-mh">${WMlight}<span class="sp"></span><small>Mr T. Moyo</small><span class="av">TM</span></header><div class="body">${b}</div><nav class="tabbar">${tabs
			.map((t) => `<span class="${t === d.tab ? 'on' : ''}">${t}</span>`)
			.join('')}</nav></div>`;
	},
	admin: (d, b) => {
		const side = [
			['', 'Overview'],
			['People', 'Tutors'],
			['', 'Students'],
			['', 'Parents'],
			['', 'Schools'],
			['Activity', 'Bookings'],
			['', 'Payments'],
			['', 'Help requests'],
			['Learning', 'Subjects & curriculum'],
			['', 'Academic Partnership'],
			['Platform', 'Reports'],
			['', 'Settings'],
			['', 'Security & audit log']
		];
		return `<aside class="ad-side"><img src="wordmark.svg" alt="tutora" />${side
			.map(
				([g, t]) =>
					`${g ? `<span class="grp">${g}</span>` : ''}<span class="${t === d.side ? 'on' : ''}">${t}</span>`
			)
			.join(
				''
			)}</aside><div><header class="ad-mh"><img src="wordmark.svg" alt="tutora" /><span class="sp"></span><span class="inp ph search hide-m">Search people, bookings, payments…</span><span class="menu">Menu</span><span class="tag info">Owner</span></header><div class="body">${b}</div></div>`;
	}
};

/* ---------- states (generated for every screen) ---------- */
const SKEL = `<div class="skel"><i class="w40"></i><i class="b"></i><i></i><i class="w60"></i><i class="b"></i><i class="w40"></i></div>`;
const stateBody = (d, kind) => {
	if (kind === 'loading')
		return `${H(d.title)}${SKEL}${note('Loading… pages show saved text first on slow connections.', 'info')}`;
	if (kind === 'error')
		return `${H(d.title)}${note("We couldn't load this. Check your connection and try again.", 'err')}${acts(btn('Try again', 'sm'), btn('Go home', 'sm sec'))}`;
	const e = d.empty || [
		'Nothing here yet',
		'When there is something to show, it will appear here.',
		''
	];
	return `${H(d.title)}${empty(e[0], e[1], e[2])}`;
};

/* ---------- render ---------- */
function frame(d, mode, body) {
	return `<div class="dev ${mode}"><div class="screen p-${d.portal}"><div class="sh">${SHELL[d.portal](d, body)}</div></div></div>`;
}
function render() {
	const board = document.getElementById('board');
	const toc = document.getElementById('toc');
	let html = '';
	const tocs = [];
	if (window.BRAND) {
		html += window.BRAND;
		tocs.push(['brand', 'Brand board']);
	}
	if (window.ECOSYSTEM) {
		html += window.ECOSYSTEM;
		tocs.push(['ecosystem', 'How it connects']);
	}
	for (const p of PORTALS) {
		const ss = SCREENS.filter((s) => s.portal === p.id);
		tocs.push([p.id, `${p.name} (${ss.length})`]);
		html += `<section class="portal" id="${p.id}"><h2>${p.name}</h2><p class="pdesc">${p.desc}</p>`;
		html += flowMap(p, ss);
		ss.forEach((s, i) => {
			const links = (s.links || [])
				.map((id) => {
					const t = SCREENS.find((x) => x.id === id);
					return t
						? `<a href="#${id}">${t.portal !== s.portal ? t.portal + ': ' : ''}${t.title}</a>`
						: '';
				})
				.join('');
			const showStates = s.states !== false;
			html += `<article class="srow" id="${s.id}"><div class="srow-h"><span class="num">${String(i + 1).padStart(2, '0')}</span><h3>${s.title}</h3><code>${s.url}</code><span class="st-badge st-${s.status}">${s.status}</span></div>${
				s.note ? `<p class="srow-note">${s.note}</p>` : ''
			}${links ? `<p class="links">Goes to → ${links}</p>` : ''}<div class="frames"><div><p class="lbl">Phone · 390 px</p>${frame(s, 'm', s.body)}</div><div><p class="lbl">Desktop · 1280 px (shown at 50%)</p>${frame(s, 'd', s.body)}</div>${
				showStates
					? `<div><p class="lbl">States (phone, 40%)</p><div class="states">${[
							'empty',
							'loading',
							'error'
						]
							.map(
								(k) =>
									`<div><p class="lbl">${k[0].toUpperCase() + k.slice(1)}</p>${frame(s, 's', stateBody(s, k))}</div>`
							)
							.join('')}</div></div>`
					: ''
			}</div></article>`;
		});
		html += `</section>`;
	}
	board.innerHTML = html;
	toc.innerHTML = tocs.map(([id, t]) => `<a href="#${id}">${t}</a>`).join('');
	// desktop frames are scaled to 50%: fix wrapper heights
	document.querySelectorAll('.dev.d').forEach((d) => {
		const s = d.querySelector('.screen');
		d.style.height = Math.ceil(s.offsetHeight * 0.5) + 2 + 'px';
	});
	document.querySelectorAll('.dev.s').forEach((d) => (d.style.height = '242px'));
	drawArrows();
}

/* sitemap per portal: home on the left, every page to the right, arrows from home + key journeys */
function flowMap(p, ss) {
	const root = ss[0];
	const rest = ss.slice(1);
	const per = Math.ceil(rest.length / 3);
	let boxes = `<div class="fbox root" data-id="${root.id}" style="grid-column:1;grid-row:1 / span ${per}"><span class="st-badge st-${root.status}">${root.status}</span><b>${root.title}</b><code>${root.url}</code></div>`;
	rest.forEach((s, i) => {
		const c = 2 + Math.floor(i / per),
			r = 1 + (i % per);
		boxes += `<div class="fbox" data-id="${s.id}" style="grid-column:${c};grid-row:${r}"><span class="st-badge st-${s.status}">${s.status}</span><b>${s.title}</b><code>${s.url}</code></div>`;
	});
	const journeys = (p.journeys || [])
		.map(
			(j) =>
				`<div class="journey"><b>${j[0]}</b>${j[1].map((x) => `<span>${x}</span>`).join('<em>→</em>')}</div>`
		)
		.join('');
	return `<div class="flow"><h3>${p.name}: how the pages connect</h3><p class="fdesc">Green arrows: reached from the ${root.title.toLowerCase()} page. Blue arrows: links between pages. Badges: Exists / Extend / New.</p><div class="fmap" data-portal="${p.id}">${boxes}<svg class="fsvg"></svg></div>${journeys ? `<h3 style="margin-top:20px">Main journeys</h3>${journeys}` : ''}</div>`;
}
function drawArrows() {
	document.querySelectorAll('.fmap').forEach((m) => {
		const svg = m.querySelector('svg');
		const mr = m.getBoundingClientRect();
		const box = (id) => m.querySelector(`[data-id="${id}"]`);
		const pos = (el) => {
			const r = el.getBoundingClientRect();
			return {
				l: r.left - mr.left,
				r: r.right - mr.left,
				t: r.top - mr.top,
				b: r.bottom - mr.top,
				cy: r.top - mr.top + r.height / 2,
				cx: r.left - mr.left + r.width / 2
			};
		};
		const ids = [...m.querySelectorAll('.fbox')].map((b) => b.dataset.id);
		const root = box(ids[0]);
		const R = pos(root);
		let d = `<defs><marker id="ag-${m.dataset.portal}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#1a5640"/></marker><marker id="ab-${m.dataset.portal}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#1f3a5f"/></marker></defs>`;
		const rootCol = ids.slice(1);
		for (const id of rootCol) {
			const P = pos(box(id));
			const x1 = R.r,
				y1 = R.cy,
				x2 = P.l - 2,
				y2 = P.cy;
			d += `<path d="M${x1},${y1} C${x1 + 40},${y1} ${x2 - 40},${y2} ${x2},${y2}" fill="none" stroke="#1a5640" stroke-width="1.2" marker-end="url(#ag-${m.dataset.portal})" opacity=".45"/>`;
		}
		// links between pages (only those within this portal, drawn once)
		const seen = new Set();
		for (const id of ids) {
			const s = SCREENS.find((x) => x.id === id);
			for (const to of s.links || []) {
				if (!ids.includes(to) || to === ids[0] || id === ids[0]) continue;
				const k = id + '>' + to;
				if (seen.has(k)) continue;
				seen.add(k);
				const A = pos(box(id)),
					B = pos(box(to));
				let path;
				if (Math.abs(A.l - B.l) < 5) {
					// same column: curve out on the right side
					const x = A.r,
						bulge = 26 + Math.abs(A.cy - B.cy) * 0.12;
					path = `M${x},${A.cy} C${x + bulge},${A.cy} ${x + bulge},${B.cy} ${x + 2},${B.cy}`;
				} else if (A.l < B.l)
					path = `M${A.r},${A.cy} C${A.r + 35},${A.cy} ${B.l - 35},${B.cy} ${B.l - 2},${B.cy}`;
				else path = `M${A.l},${A.cy} C${A.l - 35},${A.cy} ${B.r + 35},${B.cy} ${B.r + 2},${B.cy}`;
				d += `<path d="${path}" fill="none" stroke="#1f3a5f" stroke-width="1.2" stroke-dasharray="4 3" marker-end="url(#ab-${m.dataset.portal})" opacity=".8"/>`;
			}
		}
		svg.setAttribute('width', mr.width);
		svg.setAttribute('height', mr.height);
		svg.innerHTML = d;
	});
}
