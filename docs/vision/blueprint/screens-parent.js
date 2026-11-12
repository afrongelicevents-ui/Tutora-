portal({
	id: 'parent',
	name: 'Parent portal',
	desc: 'Calm and reassuring, written for parents who are not teachers. A child switcher sits under the header on every page. The overview answers six plain questions instead of showing a dashboard of numbers. Navy is used for charts and parent-specific labels so it never looks like the student or tutor portal.',
	journeys: [
		[
			'Check on my child',
			['Overview (6 answers)', 'Subject performance', 'Tutor feedback', 'Academic report']
		],
		['Second child', ['Child switcher: Tino', 'Child dashboard (Tino)', 'Book a lesson for Tino']],
		[
			'Pay and get a receipt',
			['Payments', 'Send proof (EcoCash / bank)', 'Tutor confirms', 'PDF receipt']
		],
		[
			'Academic Partnership',
			[
				'Partnership page',
				'Read and sign written consent',
				'Choose school, teacher, subjects',
				'School accepts (optional)',
				'Notes and reports appear'
			]
		]
	]
});

const ANS = (q, s, t, k) => `<div><b>${q}</b>${tag(t, k)}<span>${s}</span></div>`;

screen({
	portal: 'parent',
	id: 'p-home',
	title: 'Parent overview',
	url: '/parent',
	status: 'Extend',
	tab: 'Overview',
	top: 'Overview',
	links: [
		'p-child',
		'p-subjects',
		'p-habits',
		'p-homework',
		'p-feedback',
		'p-payments',
		'p-reports'
	],
	note: 'Today parents use /student with their children. Extend into a parent home that answers the six questions from the brief, with honest wording and a link to the evidence behind each answer.',
	empty: [
		'Add your child to get started',
		'Add a child, then book their first lesson.',
		'Add a child'
	],
	body: `<div class="ph"><h1>Rudo this month</h1><p class="lead">Form 2 · Avondale High · 2 tutors</p></div>${cols(
		`<div class="answers">${ANS('Is Rudo attending lessons?', '7 of 8 lessons attended. 1 missed on 21 Oct (sick).', 'Yes', 'ok')}${ANS('Is Rudo completing work?', '5 of 6 homework handed in. Exercise 4B due Thursday.', 'Mostly', 'info')}${ANS('What is Rudo learning?', 'Maths: fractions. English: set book chapters 5–7.', 'See topics', 'plain')}${ANS('What is hard right now?', 'Word problems in Maths (tutor note, 4 Nov).', '1 topic', 'wait')}${ANS('Is Rudo improving?', 'Maths quiz marks went from 55% to 81% since September.', 'Yes', 'ok')}${ANS('What should we focus on next?', 'Mr Moyo suggests 15 minutes of word problems 3 times a week.', 'Plan', 'info')}</div>`,
		`${card('Next lesson', `<b>Mathematics · today 15:00</b><div class="small muted">Mr Moyo · Online</div>`, 'navy')}${card(
			'Needs you',
			list([
				['Payment proof to send', 'English package · $40', '<a>Send</a>'],
				['Consent to renew', 'Academic Partnership · 30 days left', '<a>Review</a>']
			])
		)}${card('Study days', `${week('yyynyyn')}<p class="small muted" style="margin:8px 0 0">Days with a check-in or homework handed in. This shows effort, not hours studied.</p>`)}`
	)}`
});

screen({
	portal: 'parent',
	id: 'p-children',
	title: 'Children',
	url: '/parent/children',
	status: 'Exists',
	tab: 'More',
	top: 'Overview',
	links: ['p-child'],
	note: 'Exists (/student/children: add, edit, give a child their own login). Extend: school, grade and curriculum per child.',
	empty: ['No children added', 'Add a child to book lessons and see progress.', 'Add a child'],
	body: `${H('My children')}${card(
		'',
		list([
			['Rudo Chikore', 'Form 2 · Avondale High · ZIMSEC · has own login', '<a>Edit</a>'],
			['Tino Chikore', 'Grade 6 · Avondale Primary · no login (you book for him)', '<a>Edit</a>']
		])
	)}${btn('Add a child', 'sec')}`
});

screen({
	portal: 'parent',
	id: 'p-child',
	title: 'Child dashboard',
	url: '/parent/[child]',
	status: 'Extend',
	tab: 'Learning',
	top: 'Overview',
	links: ['p-subjects', 'p-lessons', 'p-results'],
	note: "Extend. One child's full picture: tutors, subjects, next lessons, recent results and the latest tutor note. Same layout for every child.",
	empty: ['No lessons for Tino yet', "Find a tutor and book Tino's first lesson.", 'Find a tutor'],
	body: `${H('Rudo', 'Form 2 · Avondale High · ZIMSEC')}${g3(
		card(
			'Tutors',
			list([
				['Mr Moyo', 'Maths, Physics'],
				['Ms Ndlovu', 'English']
			])
		),
		card(
			'Next lessons',
			list([
				['Maths', 'Today 15:00'],
				['English', 'Thu 16:00']
			])
		),
		card(
			'Latest result',
			`<div class="big">7 / 8</div><div class="small muted">Equivalent fractions quiz · 4 Nov</div>`
		)
	)}${card('Latest tutor note', '<p class="small" style="margin:0">“Good work on equivalent fractions. Next: unlike denominators.” — Mr Moyo</p>')}`
});

screen({
	portal: 'parent',
	id: 'p-subjects',
	title: 'Subject performance',
	url: '/parent/[child]/subjects',
	status: 'New',
	tab: 'Learning',
	top: 'Subjects',
	links: ['p-results', 'p-feedback'],
	note: 'New. One row per subject: recent marks (navy), trend in words and the topic to focus on. No percentile, no comparison with other children.',
	empty: ['Not enough marks yet', 'You will see this after 2 marked quizzes or homework.', ''],
	body: `${H('Subjects', 'Recent marks from Tutora quizzes and homework')}${cols(
		card(
			'Average of recent marks',
			bars([
				['Mathematics', 74, '74%'],
				['English', 68, '68%'],
				['Physics', 59, '59%']
			])
		),
		card(
			'In plain words',
			list([
				['Mathematics', 'Improving. Focus: word problems.'],
				['English', 'Steady. Focus: essay structure.'],
				['Physics', 'Just started. Too early to say.']
			])
		)
	)}${card('Mathematics over time', spark([55, 62, 58, 70, 74, 81], ['Sep', '', '', '', '', 'Nov']))}`
});

screen({
	portal: 'parent',
	id: 'p-habits',
	title: 'Study accountability',
	url: '/parent/[child]/study',
	status: 'New',
	tab: 'Learning',
	top: 'Study habits',
	links: ['p-feedback'],
	note: 'New. Shows the plan, check-ins done and targets met. Clear honesty note. Parents can turn on a weekly summary (in-app and phone, free; email optional).',
	empty: ['No study plan yet', 'Ask the tutor to make a simple weekly plan with Rudo.', ''],
	body: `${H('Study habits', 'This week')}${cols(
		`${card('Check-ins', `${week('yyynyyn')}<p class="small" style="margin:8px 0 0"><b>5 of 7 days</b> · average 2 of 3 questions right</p>`)}${card(
			'Weekly targets',
			todo([
				['Finish Exercise 4B', '', 1],
				['3 daily check-ins', '', 1],
				['Read chapter 6', ''],
				['Revise times tables', '']
			])
		)}`,
		`${note('A check-in shows what Rudo understood that day. It does not prove how long Rudo studied.', 'info')}${card('Weekly summary', `<p class="small muted" style="margin:0 0 10px">Every Sunday, in the app and as a phone notification.</p>${btn('On', 'sm')}`)}`
	)}`
});

screen({
	portal: 'parent',
	id: 'p-homework',
	title: 'Homework & assignments',
	url: '/parent/[child]/homework',
	status: 'Extend',
	tab: 'Learning',
	top: 'Homework',
	links: ['p-feedback'],
	note: 'Homework exists for students; Extend with a read-only parent view per child.',
	empty: ['No homework set', 'Homework from tutors will appear here.', ''],
	body: `${H('Homework')}${table(
		['Homework', 'Subject', 'Due', 'Status'],
		[
			['Exercise 4B: fractions', 'Mathematics', 'Thu', tag('Not handed in', 'wait')],
			['Essay plan', 'English', 'Mon', tag('Not handed in', 'wait')],
			['Exercise 4A', 'Mathematics', '31 Oct', tag('Marked 9/10')]
		]
	)}`
});

screen({
	portal: 'parent',
	id: 'p-results',
	title: 'Assessment results',
	url: '/parent/[child]/results',
	status: 'New',
	tab: 'Learning',
	top: 'Results',
	links: ['p-subjects'],
	note: 'New. Same data as the student\'s results, read-only. Parents may add school report marks (labelled "entered by parent").',
	empty: [
		'No results yet',
		'Results appear when a tutor marks a quiz or test.',
		'Add a school result'
	],
	body: `${H('Results')}${table(
		['Assessment', 'Subject', 'Date', 'Mark', 'Source'],
		[
			['Equivalent fractions quiz', 'Mathematics', '4 Nov', '7 / 8', tag('Tutora', 'info')],
			['Term test', 'Mathematics', '28 Oct', '61%', tag('School · entered by parent', 'plain')]
		]
	)}${btn('Add a school result', 'sec')}`
});

screen({
	portal: 'parent',
	id: 'p-feedback',
	title: 'Tutor feedback',
	url: '/parent/[child]/feedback',
	status: 'New',
	tab: 'Learning',
	top: 'Overview',
	links: ['p-lessons'],
	note: "New. Tutor notes written for the family after each lesson (separate from the tutor's private notes, which stay private).",
	empty: ['No feedback yet', 'Tutors add a short note after each lesson.', ''],
	body: `${H('Tutor feedback')}${card('Mr Moyo · Mathematics · Mon 3 Nov', '<p style="margin:0">Good work on equivalent fractions. Next lesson: unlike denominators.</p><div class="small" style="margin-top:6px"><b>Strength:</b> neat working · <b>Practise:</b> word problems · <b>At home:</b> 15 min, 3× a week</div>')}${card('Ms Ndlovu · English · Thu 30 Oct', '<p style="margin:0">Rudo reads well aloud. Essay paragraphs need a clear first sentence.</p>')}`
});

screen({
	portal: 'parent',
	id: 'p-lessons',
	title: 'Lesson history',
	url: '/parent/[child]/lessons',
	status: 'Exists',
	tab: 'Lessons',
	top: 'Lessons',
	links: ['p-attendance'],
	note: 'Exists (past and upcoming lessons on /student). Small extension: filter by child and subject.',
	empty: ['No lessons yet', 'Booked lessons appear here.', 'Book a lesson'],
	body: `${H('Lessons')}${seg(['Upcoming', 'Past'], 1)}${card(
		'',
		list([
			['Mathematics · Mon 3 Nov', 'Mr Moyo · Online · 60 min', tag('Attended')],
			['English · Thu 30 Oct', 'Ms Ndlovu · In person', tag('Attended')],
			['Mathematics · Tue 21 Oct', 'Mr Moyo', tag('Absent', 'no')]
		])
	)}`
});

screen({
	portal: 'parent',
	id: 'p-attendance',
	title: 'Attendance',
	url: '/parent/[child]/attendance',
	status: 'Extend',
	tab: 'Lessons',
	top: 'Lessons',
	links: ['p-lessons'],
	note: "Tutors already mark attendance (present / absent). Extend: show it to parents, with the tutor's note and the 7-day correction window.",
	empty: ['No attendance yet', 'Attendance appears after the first lesson.', ''],
	body: `${H('Attendance', 'Since September')}${kv([
		['7 of 8', 'lessons attended'],
		['1', 'missed (21 Oct)'],
		['0', 'late cancellations'],
		['2', 'tutors']
	])}${card('Missed', list([['Mathematics · Tue 21 Oct', 'Tutor note: “Rudo was sick.”']]))}`
});

screen({
	portal: 'parent',
	id: 'p-payments',
	title: 'Payments & receipts',
	url: '/student/payments',
	status: 'Exists',
	tab: 'Payments',
	top: 'Payments',
	links: [],
	note: 'Exists: pay the tutor directly (EcoCash, InnBucks, bank, cash), upload proof, tutor confirms, PDF receipt. If Tutora later sells its own plans, those would be paid to Tutora separately (see revenue document).',
	empty: ['No payments yet', 'After a lesson or package, payment details appear here.', ''],
	body: `${H('Payments')}${cols(
		`${card('To pay', list([['English · 4-lesson package', 'Ms Ndlovu · $40 · EcoCash', btn('Send proof', 'sm')]]))}${card(
			'Paid',
			list([
				['Mathematics · 4 lessons', 'Mr Moyo · $40 · confirmed 1 Nov', '<a>Receipt PDF</a>'],
				['Mathematics · 1 lesson', 'Mr Moyo · $10 · confirmed 20 Oct', '<a>Receipt PDF</a>']
			])
		)}`,
		card(
			'How paying works',
			'<p class="small muted" style="margin:0">You pay the tutor directly. Send a photo of the payment proof; the tutor confirms and Tutora makes the receipt.</p>',
			'navy'
		)
	)}`
});

screen({
	portal: 'parent',
	id: 'p-reports',
	title: 'Academic reports',
	url: '/parent/[child]/reports',
	status: 'New',
	tab: 'Learning',
	top: 'Reports',
	links: ['p-subjects', 'p-feedback'],
	note: 'New. A monthly one-page report in plain words, made from real records (attendance, homework, marks, tutor notes). The tutor reviews it before it is shared. Light PDF to download or print.',
	empty: [
		'First report at the end of the month',
		'Reports need at least 2 lessons in the month.',
		''
	],
	body: `${H('Reports')}${cols(
		card(
			'October report · Rudo',
			`<div class="small muted">Written by Mr Moyo and Ms Ndlovu · checked 1 Nov</div>${list([
				['Attendance', '7 of 8 lessons'],
				['Homework', '5 of 6 handed in'],
				['Mathematics', 'Improving. Strong: equivalent fractions. Next: word problems.'],
				['English', 'Steady. Next: clear first sentence in each paragraph.'],
				['At home', '15 min of word problems, 3 times a week.']
			])}<div style="margin-top:10px">${btn('Download PDF', 'sm sec')}</div>`
		),
		card('Earlier', list([['September report', '', '<a>Open</a>']]))
	)}`
});

screen({
	portal: 'parent',
	id: 'p-partner',
	title: 'Academic Partnership',
	url: '/parent/partnership',
	status: 'New',
	tab: 'More',
	top: 'Partnership',
	links: ['p-reports'],
	note: 'New, optional premium service. Written consent first: which school, which teacher, which subjects, for how long. Parent can withdraw at any time. Every message and access is logged; the parent can see the log.',
	empty: [
		'Not using Academic Partnership',
		'With your written consent, the tutor and the teacher can coordinate. Schools join only if they choose to.',
		'Learn more'
	],
	body: `${H('Academic Partnership', 'Rudo · Avondale High')}${cols(
		`${card(
			'Consent',
			`${list([
				['Status', '', tag('Active')],
				['School', 'Avondale High'],
				['Teacher', 'Mrs Dube (Mathematics)'],
				['Shared', 'Topics, targets, Tutora reports. Not school records.'],
				['Valid until', '31 Mar 2027'],
				['Signed', 'Mrs M. Chikore, 3 Nov · Rudo agreed too']
			])}<div class="acts" style="margin-top:10px">${btn('Download consent', 'sm sec')}${btn('Withdraw consent', 'sm sec')}</div>`
		)}${card(
			'Coordinated plan',
			list([
				['Term target', 'Fractions and word problems before the end-of-term test'],
				['Teacher note · 6 Nov', '“Class moves to algebra on 20 Nov.”']
			])
		)}`,
		card(
			"Who looked at Rudo's information",
			list([
				['Mr Moyo (tutor)', 'viewed report · 6 Nov'],
				['Mrs Dube (teacher)', 'read message · 6 Nov']
			]),
			'navy'
		)
	)}`
});

screen({
	portal: 'parent',
	id: 'p-notifs',
	title: 'Notifications',
	url: '/notifications',
	status: 'Exists',
	tab: 'More',
	top: 'Overview',
	links: [],
	note: 'Exists. Extend with phone notifications (Web Push, free) and a weekly summary option.',
	empty: ["You're all caught up", 'Lesson changes, payments and reports appear here.', ''],
	body: `${H('Notifications')}${card(
		'',
		list([
			['Payment confirmed', 'Mr Moyo confirmed $40 · 1 Nov', '<a>Receipt</a>'],
			['Monthly report ready', 'Rudo · October', '<a>Open</a>'],
			['Lesson moved', 'English now Thu 16:00', '<a>Open</a>']
		])
	)}`
});

screen({
	portal: 'parent',
	id: 'p-account',
	title: 'Account & settings',
	url: '/account',
	status: 'Extend',
	tab: 'More',
	top: 'Overview',
	links: [],
	note: 'Exists (/account). Extend: notification choices per type and channel; show which channels cost money (SMS, WhatsApp) if ever offered.',
	states: false,
	body: `${H('Account')}${cols(
		card(
			'Notifications',
			table(
				['What', 'In app', 'Phone', 'Email'],
				[
					['Lesson changes', '✓', '✓', '✓'],
					['Weekly summary', '✓', '✓', '—'],
					['Payments', '✓', '—', '✓']
				]
			)
		),
		card(
			'Account',
			list([
				['Password', '', '<a>Change</a>'],
				['2-step login', '', '<a>Turn on</a>'],
				['Download our data', '', '<a>Download</a>'],
				['Delete account', '', '<a>Delete</a>']
			])
		)
	)}`
});
