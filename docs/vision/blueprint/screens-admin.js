portal({
	id: 'admin',
	name: 'Admin portal (owner)',
	desc: 'Neutral and efficient: light grey background, white sidebar grouped by People, Activity, Learning and Platform, search on top, tables with filters. Built mainly for a laptop; on phones it stacks into lists behind a Menu button. Everything can be managed here without opening the database.',
	journeys: [
		[
			'Approve a tutor',
			[
				'Overview: 2 waiting',
				'Tutor management',
				'Check profile and documents',
				'Approve or send back with a reason'
			]
		],
		[
			'Answer a help request',
			['Help requests', 'Open request', 'Reply (email or in-app)', 'Mark solved']
		],
		[
			'Partnership check',
			['Academic Partnership', 'Consent record', 'Access log', 'Pause if consent expired']
		]
	]
});

screen({
	portal: 'admin',
	id: 'a-home',
	title: 'Platform overview',
	url: '/owner',
	status: 'Extend',
	side: 'Overview',
	links: ['a-tutors', 'a-help', 'a-payments', 'a-reports', 'a-audit'],
	note: 'Exists (/owner: tutors waiting, recent activity). Extend: a short "needs you" list first, then simple counts from real data only (no targets or invented growth).',
	empty: ['A quiet day', 'Nothing needs you right now.', ''],
	body: `${H('Overview')}${kv([
		['2', 'tutors waiting for approval'],
		['1', 'open help request'],
		['14', 'lessons this week'],
		['0', 'consents expiring this month']
	])}${cols(
		card(
			'Needs you',
			list([
				['Approve Ms P. Ncube', 'English · submitted yesterday', btn('Review', 'sm')],
				['Help request: "Can\'t upload proof"', 'Parent · 3 h ago', btn('Open', 'sm sec')]
			])
		),
		card(
			'Recent activity',
			list([
				['Tutor approved', 'Mr T. Moyo · Mon'],
				['New parent account', 'Mon'],
				['Payment confirmed by tutor', '$40 · Sun']
			])
		)
	)}`
});

screen({
	portal: 'admin',
	id: 'a-tutors',
	title: 'Tutor management & approvals',
	url: '/owner/tutors',
	status: 'Exists',
	side: 'Tutors',
	links: ['a-audit'],
	note: 'Exists on /owner (approve, send back with reason, suspend, add a tutor). Extend: own page with filters and the approval checklist.',
	empty: ['No tutors yet', 'Tutors appear here after they sign up at /join.', 'Add a tutor'],
	body: `${H('Tutors')}<div class="filters"><span class="inp ph">Search name or subject</span><span class="inp sel">All statuses</span></div>${table(
		['Tutor', 'Subjects', 'Town', 'Status', ''],
		[
			['Ms P. Ncube', 'English', 'Bulawayo', tag('Waiting', 'wait'), btn('Review', 'sm')],
			['Mr T. Moyo', 'Maths, Physics', 'Harare', tag('Approved'), '<a>Open</a>'],
			['Mr K. Banda', 'Chemistry', 'Gweru', tag('Draft', 'plain'), '<a>Open</a>']
		]
	)}`
});

screen({
	portal: 'admin',
	id: 'a-students',
	title: 'Student management',
	url: '/owner/students',
	status: 'Exists',
	side: 'Students',
	links: ['a-parents'],
	note: 'Exists (/owner/students: list, reset password, temporary password). Extend: school and grade columns, link to their parent.',
	empty: ['No students yet', 'Students appear after they sign up or a parent adds them.', ''],
	body: `${H('Students')}<div class="filters"><span class="inp ph">Search</span><span class="inp sel">All grades</span></div>${table(
		['Student', 'Grade', 'School', 'Parent', 'Tutors'],
		[
			['Rudo C.', 'Form 2', 'Avondale High', 'Mrs M. Chikore', '2'],
			['Tafadzwa M.', 'Form 4', '—', 'own account', '1']
		]
	)}`
});

screen({
	portal: 'admin',
	id: 'a-parents',
	title: 'Parent management',
	url: '/owner/parents',
	status: 'Extend',
	side: 'Parents',
	links: ['a-students'],
	note: 'Parents are listed with students today. Extend: own list with children, consents and help history.',
	empty: ['No parents yet', 'Parents appear after they create an account.', ''],
	body: `${H('Parents')}${table(
		['Parent', 'Children', 'Consents', 'Joined'],
		[
			['Mrs M. Chikore', 'Rudo, Tino', '1 active', 'Sep 2026'],
			['Mr S. Phiri', 'Chipo', '—', 'Oct 2026']
		]
	)}`
});

screen({
	portal: 'admin',
	id: 'a-schools',
	title: 'Schools & institutions',
	url: '/owner/schools',
	status: 'New',
	side: 'Schools',
	links: ['a-partner'],
	note: 'New. A simple list of schools named by parents (free text, merged by the owner) and the few schools that have agreed to take part. No school records are stored.',
	empty: [
		'No schools yet',
		"Schools appear when parents add their child's school.",
		'Add a school'
	],
	body: `${H('Schools')}${table(
		['School', 'Town', 'Students', 'Taking part', 'Contact'],
		[
			['Avondale High', 'Harare', '3', tag('Yes · 1 teacher'), 'Head of Maths'],
			['Avondale Primary', 'Harare', '1', tag('No', 'plain'), '—']
		]
	)}${note('Schools take part only if they agree. Tutora never receives school records automatically.', 'info')}`
});

screen({
	portal: 'admin',
	id: 'a-bookings',
	title: 'Bookings',
	url: '/owner/bookings',
	status: 'Exists',
	side: 'Bookings',
	links: [],
	note: 'Exists (/owner/bookings). Extend: filters by tutor, status and date; export CSV.',
	empty: ['No bookings yet', 'Bookings appear when students request lessons.', ''],
	body: `${H('Bookings')}<div class="filters"><span class="inp sel">This week</span><span class="inp sel">All tutors</span><span class="inp sel">All statuses</span></div>${table(
		['When', 'Student', 'Tutor', 'Subject', 'Status'],
		[
			['Tue 15:00', 'Rudo C.', 'Mr Moyo', 'Maths', tag('Confirmed')],
			['Thu 16:00', 'Rudo C.', 'Ms Ndlovu', 'English', tag('Confirmed')],
			['Sat 09:00', 'Rudo C.', 'Mr Moyo', 'Physics', tag('Requested', 'wait')]
		]
	)}`
});

screen({
	portal: 'admin',
	id: 'a-payments',
	title: 'Payment monitoring',
	url: '/owner/payments',
	status: 'Exists',
	side: 'Payments',
	links: [],
	note: "Exists (/owner/payments: proofs and confirmations; Tutora does not hold money today). Extend later: Tutora's own income (plans, partnership) shown separately from tutor payments.",
	empty: ['No payments yet', 'Payments between parents and tutors appear here.', ''],
	body: `${H('Payments')}${seg(['Parent → tutor', 'Paid to Tutora'], 0)}${table(
		['Date', 'From', 'To', 'Amount', 'Status'],
		[
			['Today', 'Mrs Chikore', 'Ms Ndlovu', '$40', tag('Waiting for tutor', 'wait')],
			['1 Nov', 'Mrs Chikore', 'Mr Moyo', '$40', tag('Confirmed')]
		]
	)}${note('Disputed or "not received" payments are flagged here for follow-up.', 'info')}`
});

screen({
	portal: 'admin',
	id: 'a-reports',
	title: 'Reports & analytics',
	url: '/owner/reports',
	status: 'Exists',
	side: 'Reports',
	links: [],
	note: 'Exists (/owner/reports). Extend with a few honest numbers: active students, lessons per week, check-in use, tutor response time. Simple bars; no vanity dashboards.',
	empty: ['Not enough data yet', 'Reports fill in as people use Tutora.', ''],
	body: `${H('Reports', 'Last 8 weeks')}${cols(
		card(
			'Lessons per week',
			spark([20, 35, 30, 45, 50, 60, 55, 70], ['Sep', '', '', '', '', '', '', 'Nov'])
		),
		card(
			'Check-in use',
			bars([
				['Students with a plan', 40, '4 of 10'],
				['Did 3+ check-ins', 30, '3 of 10', 1]
			])
		)
	)}`
});

screen({
	portal: 'admin',
	id: 'a-subjects',
	title: 'Subjects & curriculum',
	url: '/owner/content',
	status: 'Extend',
	side: 'Subjects & curriculum',
	links: [],
	note: 'Subjects list exists (owner content page). Extend: curricula (ZIMSEC, Cambridge) and levels as simple lists that tutors and parents pick from. Topic lists are added by tutors, not invented.',
	empty: ['No subjects', 'Add the subjects tutors can choose from.', 'Add subject'],
	body: `${H('Subjects & curriculum')}${cols(
		card(
			'Subjects',
			list([
				['Mathematics', 'Primary · O · A Level', '<a>Edit</a>'],
				['English Language', 'Primary · O Level', '<a>Edit</a>'],
				['Physics', 'O · A Level', '<a>Edit</a>']
			])
		),
		card(
			'Curricula',
			list([
				['ZIMSEC', 'Grade 1–7, Form 1–6'],
				['Cambridge', 'IGCSE, AS/A Level']
			])
		)
	)}`
});

screen({
	portal: 'admin',
	id: 'a-partner',
	title: 'Academic Partnership management',
	url: '/owner/partnership',
	status: 'New',
	side: 'Academic Partnership',
	links: ['a-audit', 'a-schools'],
	note: 'New. Every partnership with its signed consent, scope, expiry and access log. Owner can pause one. Expired consent stops access automatically.',
	empty: [
		'No partnerships yet',
		'Partnerships start when a parent signs consent and a teacher accepts.',
		''
	],
	body: `${H('Academic Partnership')}${table(
		['Student', 'School · teacher', 'Scope', 'Consent until', 'Status'],
		[
			['Rudo C.', 'Avondale High · Mrs Dube', 'Maths', '31 Mar 2027', tag('Active')],
			['Chipo P.', 'Girls High · —', 'All', '—', tag('Waiting for school', 'wait')]
		]
	)}`
});

screen({
	portal: 'admin',
	id: 'a-help',
	title: 'Help requests',
	url: '/owner',
	status: 'Exists',
	side: 'Help requests',
	links: [],
	note: 'Exists (contact form → owner list). Extend: reply in-app and mark solved.',
	empty: ['No help requests', 'Messages from the Contact page appear here.', ''],
	body: `${H('Help requests')}${cols(card('"Can\'t upload proof"', `<div class="small muted">Mrs M. Chikore · parent · 3 h ago</div><p>The photo is too big and fails on my phone.</p>${field('Reply', '', 'Write a reply…', 'area')}<div class="acts" style="margin-top:10px">${btn('Send reply', 'sm')}${btn('Mark solved', 'sm sec')}</div>`), card('Others', list([['How do I add a second child?', 'Solved']])))}`
});

screen({
	portal: 'admin',
	id: 'a-settings',
	title: 'Platform settings',
	url: '/owner/content',
	status: 'Exists',
	side: 'Settings',
	links: [],
	note: 'Exists (homepage text and photo, site settings). Extend: notification channels on/off, and which paid channels are switched on (email, SMS, WhatsApp) with their monthly cap.',
	states: false,
	body: `${H('Settings')}${cols(
		card(
			'Homepage',
			list([
				['Headline', 'Find a good tutor in Zimbabwe', '<a>Edit</a>'],
				['Hero photo', 'hero.webp · 31 KB', '<a>Replace</a>']
			])
		),
		card(
			'Messages',
			table(
				['Channel', 'Status', 'Monthly cap'],
				[
					['In-app', tag('On'), '—'],
					['Phone (Web Push)', tag('Off', 'plain'), 'free'],
					['Email', tag('On'), '3,000 / month (free tier)'],
					['SMS', tag('Off', 'plain'), 'set a cap'],
					['WhatsApp', tag('Off', 'plain'), 'set a cap']
				]
			)
		)
	)}`
});

screen({
	portal: 'admin',
	id: 'a-audit',
	title: 'Security & audit logs',
	url: '/owner/audit',
	status: 'Extend',
	side: 'Security & audit log',
	links: [],
	note: "Exists (/owner/audit: owner actions). Extend: who viewed which child's data (tutor, teacher, owner), consent changes, logins from new devices. Kept for a fixed period, then deleted.",
	empty: ['No events', 'Important actions will be listed here.', ''],
	body: `${H('Security & audit log')}<div class="filters"><span class="inp sel">All events</span><span class="inp sel">Last 30 days</span></div>${table(
		['When', 'Who', 'What', 'About'],
		[
			['6 Nov 14:02', 'Mrs Dube (teacher)', 'Read partnership message', 'Rudo C.'],
			['6 Nov 13:40', 'Mr Moyo (tutor)', 'Viewed report', 'Rudo C.'],
			['3 Nov 19:15', 'Mrs Chikore (parent)', 'Signed consent', 'Rudo C.'],
			['2 Nov 08:00', 'Owner', 'Approved tutor', 'Mr T. Moyo']
		]
	)}`
});
