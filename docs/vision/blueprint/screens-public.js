portal({
	id: 'public',
	name: 'Public website',
	desc: 'What a visitor sees before logging in. Calm, photo-led and honest: only real, approved tutors and real review counts. One main action per page. The new positioning ("Good grades are a great start") appears without turning the homepage into a busy poster.',
	journeys: [
		[
			'Parent finds a tutor',
			[
				'Homepage',
				'Find a tutor (filter: Maths, Form 2, Harare)',
				'Tutor profile',
				'Register (parent)',
				'Book a lesson or free intro chat'
			]
		],
		['Visitor learns first', ['Homepage', 'How Tutora works', 'Subjects', 'Find a tutor']],
		[
			'Tutor joins',
			['Homepage', 'Are you a tutor? → Join', 'Register (tutor)', 'Owner approves', 'Tutor portal']
		]
	]
});

screen({
	portal: 'public',
	id: 'pub-home',
	title: 'Homepage',
	url: '/',
	status: 'Extend',
	links: ['pub-find', 'pub-subjects', 'pub-how', 'pub-profile', 'pub-register', 'pub-login'],
	note: 'Keeps today\'s layout (deployed). Extend: the new headline and one short "Not only for struggling students" line, and a quiet strip naming the five pillars in words, no icons. "Popular tutors" shows real tutors only (1 to 4).',
	empty: [
		'No tutors listed yet',
		'Popular tutors is hidden until the first tutor is approved. The rest of the page still works.',
		''
	],
	body: `<div class="hero2"><div><h1 style="font-size:36px">Good grades are a great start. Let's build on them.</h1><p class="lead" style="margin:10px 0 18px">Personal tutors, study habits and clear progress reports, online or in person, across Zimbabwe.</p>${acts(btn('Find a tutor →'))}<p class="small muted" style="margin-top:12px">For children who are struggling, doing well, or aiming higher.</p></div><img class="hero-img" src="hero.webp" alt="" /></div>
	${card('What Tutora helps with', `<div class="g3"><div><b>Lessons with a real tutor</b><div class="small muted">Subjects, homework and exam preparation.</div></div><div><b>Steady study habits</b><div class="small muted">A short daily check-in and weekly goals.</div></div><div><b>Clear progress for parents</b><div class="small muted">Simple reports in plain words.</div></div></div>`, 'flat')}
	<div><h2 class="ct" style="font:400 24px var(--serif)">How it works</h2>${list([
		['01 · Find a tutor', 'Search by subject, level and town.'],
		['02 · Book a lesson', 'Pick a time that suits you, online or in person.'],
		['03 · Learn and grow', 'Practise between lessons and see progress.']
	])}</div>
	<div><div class="acts" style="justify-content:space-between"><h2 class="ct" style="font:400 24px var(--serif);margin:0">Popular tutors</h2><a>View all →</a></div><div class="g4" style="margin-top:12px">${card('', who('TM', 'Mr T. Moyo', 'Mathematics · Harare'))}</div><p class="small muted">Shows only approved tutors. With one tutor, one card, aligned left.</p></div>
	${card('Are you a tutor?', `<p class="muted" style="margin:0 0 12px">Share your knowledge, reach more students and manage your lessons with Tutora.</p>${btn('Join Tutora', 'light')}`, 'dark')}`
});

screen({
	portal: 'public',
	id: 'pub-find',
	title: 'Find a tutor',
	url: '/tutors',
	status: 'Exists',
	links: ['pub-profile', 'pub-subjects'],
	note: 'Exists today with filters (subject, level, lessons, location, sort). Small extension later: "Curriculum" filter (ZIMSEC / Cambridge) once tutors add it.',
	empty: [
		'No tutors match yet',
		'Try another subject or town, or remove a filter.',
		'Clear filters'
	],
	body: `${H('Find a tutor')}${cols(
		`${card('', `<div class="g2">${field('Subject', 'Mathematics', '', 'sel')}${field('Level', 'Form 2 (O Level)', '', 'sel')}${field('Lessons', 'Online or in person', '', 'sel')}${field('Town', '', 'e.g. Harare')}</div><div style="margin-top:12px">${btn('Show tutors', 'block')}</div>`)}
		<p class="small muted">1 tutor found</p>${card('', `<div class="who" style="align-items:flex-start"><span class="av lg">TM</span><div><b>Mr T. Moyo</b><div class="small">Mathematics, Physics · O and A Level</div><div class="small muted">Harare (Avondale) · Online and in person</div><div class="small" style="margin-top:4px"><b>From $10 / lesson</b> · ★ 4.7 (3 reviews)</div></div></div>`)}`,
		card(
			'Not sure where to start?',
			`<p class="small muted" style="margin:0 0 10px">Most tutors offer a free 15-minute intro chat.</p><a>How Tutora works</a>`,
			'navy'
		)
	)}`
});

screen({
	portal: 'public',
	id: 'pub-subjects',
	title: 'Subjects',
	url: '/subjects',
	status: 'New',
	links: ['pub-find'],
	note: 'New, simple discovery page built from the subjects real tutors teach (no invented counts). Each subject links to Find a tutor with the filter set. No extra running cost.',
	empty: [
		'Subjects appear as tutors join',
		'This list is built from what approved tutors teach.',
		''
	],
	body: `${H('Subjects', 'Choose a subject to see tutors who teach it.')}${seg(['All levels', 'Primary', 'O Level', 'A Level'], 0)}<div class="g3">${[
		'Mathematics',
		'English Language',
		'Physics',
		'Chemistry',
		'Biology',
		'Shona',
		'Accounts',
		'Geography',
		'Computer Science'
	]
		.map((s) => card('', `<b>${s}</b><div class="small muted">See tutors →</div>`))
		.join('')}</div>`
});

screen({
	portal: 'public',
	id: 'pub-profile',
	title: 'Tutor profile',
	url: '/t/[tutor]',
	status: 'Exists',
	links: ['pub-register', 'pub-login'],
	note: 'Exists (photo, subjects and prices, results, reviews, free times, WhatsApp). Extend later: "Curriculum I teach" and "Textbooks I use", entered by the tutor.',
	empty: [
		'This tutor is not taking students right now',
		'Find another tutor who teaches the same subject.',
		'Find a tutor'
	],
	body: `${cols(
		`<div class="who" style="align-items:flex-start"><span class="av lg">TM</span><div><h1 style="font-size:28px">Mr T. Moyo</h1><div class="muted">Harare (Avondale) · 9 years teaching</div><div class="small">★ 4.7 (3 reviews)</div></div></div><h2 class="ct" style="font:400 22px var(--serif);margin-top:8px">Clear, patient Maths and Physics lessons</h2>${card(
			'Subjects and prices',
			list([
				['Mathematics', 'O Level, A Level', '$10 / lesson'],
				['Physics', 'O Level', '$12 / lesson']
			])
		)}${card('Curriculum and textbooks', `<div class="small">ZIMSEC O Level · New General Mathematics</div><div class="small muted">Entered by the tutor</div>`)}${card(
			'Usual free times',
			list([
				['Monday – Thursday', '', '15:00–19:00'],
				['Saturday', '', '08:00–12:00']
			])
		)}`,
		`${card('', `${btn('Book a lesson', 'block')}<div style="height:8px"></div>${btn('Free 15-minute intro chat', 'sec block')}<p class="small muted" style="margin:10px 0 0">You pay the tutor directly. Tutora sends a receipt.</p>`)}${card('Reviews', `<div class="small"><b>★★★★★</b> “Explains slowly and checks I understand.”<div class="muted">Parent of a Form 3 student</div></div>`)}`
	)}`
});

screen({
	portal: 'public',
	id: 'pub-how',
	title: 'How Tutora works',
	url: '/how-it-works',
	status: 'New',
	links: ['pub-find', 'pub-register'],
	note: 'New page (today "How it works" is a section on the homepage). Explains the five pillars in plain words, for parents, students and schools. Text only plus one photo; no icon grid.',
	states: false,
	body: `${H('How Tutora works', 'Tutora is not only for struggling students. It is for every child who can do better, with the right support, structure and encouragement.')}${g2(
		card(
			'1. Academic support',
			'<span class="muted small">Lessons with a tutor who knows your child\'s syllabus: subjects, homework, revision and exam preparation.</span>'
		),
		card(
			'2. Study accountability',
			'<span class="muted small">A study plan, a short daily check-in and weekly goals. We show effort and understanding honestly; a quiz does not prove hours studied.</span>'
		),
		card(
			'3. Curriculum alignment',
			'<span class="muted small">Your child\'s school, grade, syllabus, textbooks and current topics, entered and checked by you and the tutor.</span>'
		),
		card(
			'4. Progress you can read',
			'<span class="muted small">Results, homework and tutor feedback in plain words, with what to focus on next.</span>'
		)
	)}${card('5. Tutora Academic Partnership (optional, paid)', '<span class="muted small">With your written consent, your child\'s tutor and teacher can talk about topics and targets. Schools take part only if they choose to. Tutora never sees school records automatically.</span>', 'navy')}${acts(btn('Find a tutor'), btn('Create a parent account', 'sec'))}`
});

screen({
	portal: 'public',
	id: 'pub-register',
	title: 'Register',
	url: '/signup',
	status: 'Extend',
	links: ['pub-login'],
	note: 'Exists for students and parents; tutors join at /join. Extend: one "I am a…" choice first (parent, student, tutor), then the short form.',
	states: false,
	body: `<div style="max-width:440px;margin:0 auto;display:grid;gap:14px;width:100%">${H('Create your account')}<div class="fld"><span>I am a…</span>${seg(['Parent', 'Student', 'Tutor'], 0)}</div>${field('Your name', '', 'e.g. Mrs M. Chikore')}${field('Email', '', 'you@example.com')}${field('Phone (optional)', '', '+263…')}${field('Password', '', 'At least 8 characters')}${btn('Create account', 'block')}<p class="small muted" style="margin:0">Already have an account? <a>Log in</a></p></div>`
});

screen({
	portal: 'public',
	id: 'pub-login',
	title: 'Log in',
	url: '/login',
	status: 'Exists',
	links: ['pub-register'],
	note: 'Exists: one login for everyone, sends each person to their own portal. "Stay logged in on this phone (30 days)".',
	states: false,
	body: `<div style="max-width:420px;margin:0 auto;display:grid;gap:14px;width:100%">${H('Log in')}${field('Email', '', '')}${field('Password', '', '')}<label class="small"><b>☑</b> Stay logged in on this phone (30 days)</label>${btn('Log in', 'block')}<a class="small">Forgot your password?</a>${note('Wrong email or password. Try again or reset your password.', 'err')}</div>`
});
