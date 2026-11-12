portal({
	id: 'student',
	name: 'Student portal',
	desc: 'Warm and simple. The student always sees one clear next step. Text tab bar on phones (Home, Lessons, Study, Progress, More) and a tab row on desktop. Big serif greeting, one green "Next up" block, today\'s plan as a short checklist with ochre ticks. Few numbers; feedback in words.',
	journeys: [
		[
			'Join a lesson',
			['Home → Next up', 'Lesson details', 'Join lesson (opens Google Meet or the Tutora room)']
		],
		[
			'Daily check-in',
			[
				'Reminder (in-app / phone)',
				"Daily check-in: 3 questions on today's topic",
				'Result + "practise again"',
				'Tutor sees it before the next lesson'
			]
		],
		[
			'Homework',
			[
				'Home → Needs attention',
				'Homework',
				'Upload answer',
				'Tutor marks it',
				'Messages & feedback'
			]
		]
	]
});

screen({
	portal: 'student',
	id: 's-home',
	title: 'Home',
	url: '/student',
	status: 'Extend',
	tab: 'Home',
	top: 'Home',
	links: ['s-lesson', 's-checkin', 's-homework', 's-assess', 's-feedback', 's-progress'],
	note: "Exists as /student (next lesson, requests, packages, lessons). Extend: today's study plan, check-in, upcoming assessments and latest feedback, in this order.",
	empty: ['Welcome to Tutora', 'Book your first lesson to see your plan here.', 'Find a tutor'],
	body: `<p class="greet">Good afternoon, Rudo</p><p class="lead">Tuesday · you have 1 lesson and 2 things to do today.</p>${cols(
		`<div class="nextup"><span class="k">Next up · today 15:00</span><span class="t">Mathematics with Mr Moyo</span><span>Topic: Fractions — adding unlike denominators · Online</span><div class="acts" style="margin-top:6px">${btn('Join lesson', 'light')}<span style="color:#cfe6d8;font-size:13px">Opens 10 minutes before</span></div></div>${card(
			"Today's plan",
			todo([
				['Daily check-in: fractions', '3 questions · 5 min'],
				['Finish Exercise 4B (homework)', 'due Thu'],
				['Read English set book, chapter 6', '20 min', 1]
			])
		)}`,
		`${card(
			'Coming up',
			list([
				['Maths quiz: fractions', 'Set by Mr Moyo', 'Fri'],
				['English essay draft', 'Homework', 'Mon']
			])
		)}${card('Latest feedback', `<p style="margin:0" class="small">“Good work on equivalent fractions. Next: unlike denominators.”</p><p class="small muted" style="margin:6px 0 0">Mr Moyo · Mon</p>`)}${card('This week', `${week('yyy')}<p class="small muted" style="margin:8px 0 0">Check-ins done on 3 days</p>`)}`
	)}`
});

screen({
	portal: 'student',
	id: 's-lessons',
	title: 'My lessons',
	url: '/student/lessons',
	status: 'Extend',
	tab: 'Lessons',
	top: 'Lessons',
	links: ['s-lesson'],
	note: 'Upcoming and past lessons already show on /student; Extend into its own page with Upcoming / Past tabs and a "Book a lesson" button.',
	empty: [
		'No lessons yet',
		'When a tutor accepts your request, the lesson appears here.',
		'Book a lesson'
	],
	body: `${H('My lessons')}${seg(['Upcoming', 'Past'], 0)}${card(
		'',
		list([
			['Mathematics · Today 15:00–16:00', 'Mr Moyo · Online', tag('Confirmed')],
			['English · Thu 16:00–17:00', 'Ms Ndlovu · In person, Avondale', tag('Confirmed')],
			['Physics · Sat 09:00', 'Mr Moyo · Waiting for the tutor', tag('Requested', 'wait')]
		])
	)}${btn('Book a lesson', 'block')}`
});

screen({
	portal: 'student',
	id: 's-lesson',
	title: 'Lesson details & join',
	url: '/student/lessons/[id]',
	status: 'Extend',
	tab: 'Lessons',
	top: 'Lessons',
	links: ['s-homework', 's-feedback'],
	note: 'Exists (details, add to calendar, cancel, room link). Extend: the tutor can paste a Google Meet / Teams link; "Join lesson" opens it, otherwise the built-in Tutora room. Shows the topic and what to bring.',
	empty: ['Lesson not found', 'It may have been cancelled. Check My lessons.', 'My lessons'],
	body: `${H('Mathematics', 'Today · 15:00–16:00 · with Mr Moyo')}${cols(
		`${card('', `<div class="acts">${btn('Join lesson')}<span class="small muted">Google Meet · opens in a new tab</span></div><p class="small muted" style="margin:10px 0 0">No Meet? Use the low-data Tutora room instead.</p>`, 'mint')}${card("Today's topic", `<b>Fractions: adding unlike denominators</b><div class="small muted">School textbook: New General Mathematics 2, ch. 5</div>`)}${card('Bring', list([['Exercise 4B (homework)', 'Upload before the lesson', tag('Not done', 'wait')]]))}`,
		`${card(
			'',
			list([
				['Add to my calendar', '', '<a>Download</a>'],
				['Cancel lesson', 'Free until 24 h before', '<a>Cancel</a>']
			])
		)}`
	)}`
});

screen({
	portal: 'student',
	id: 's-homework',
	title: 'Homework',
	url: '/student/homework',
	status: 'Exists',
	tab: 'Study',
	top: 'Homework',
	links: ['s-feedback'],
	note: 'Exists (homework from tutors, upload answers, see marks). Small extension: group by "To do / Handed in / Marked".',
	empty: ['No homework right now', 'Your tutor will add homework after a lesson.', ''],
	body: `${H('Homework')}${seg(['To do', 'Handed in', 'Marked'], 0)}${card(
		'',
		list([
			['Exercise 4B: fractions', 'Mathematics · due Thu', btn('Upload answer', 'sm')],
			['Essay plan: “A day I will remember”', 'English · due Mon', btn('Upload answer', 'sm')]
		])
	)}${note('Photos of written work are fine. Large photos are made smaller before upload to save data.', 'info')}`
});

screen({
	portal: 'student',
	id: 's-assess',
	title: 'Assessment centre',
	url: '/student/assessments',
	status: 'New',
	tab: 'Study',
	top: 'Assessments',
	links: ['s-results'],
	note: 'New. Short quizzes and tests set by the tutor (multiple choice, short answer, or a photo of written work). Works offline-light: questions load once. Optional link-out to Kahoot for live revision games.',
	empty: ['No assessments set', 'When your tutor sets a quiz or test, it appears here.', ''],
	body: `${H('Assessments')}${cols(
		`${card('Fractions quiz', `<div class="small muted">Mathematics · 8 questions · about 10 minutes · due Fri</div><div style="margin:10px 0">${prog(25)}</div><div class="q"><b>Question 2 of 8</b><span>Work out 2/3 + 1/4</span><span class="opt">3/7</span><span class="opt on">11/12</span><span class="opt">3/12</span></div><div style="margin-top:12px">${btn('Next question')}</div>`)}`,
		`${card('Up next', list([['English comprehension', 'Due Mon · 20 min', tag('Not started', 'plain')]]))}${card('Done', list([['Equivalent fractions', 'Marked', '7 / 8']]))}`
	)}`
});

screen({
	portal: 'student',
	id: 's-results',
	title: 'My results',
	url: '/student/results',
	status: 'New',
	tab: 'Progress',
	top: 'Progress',
	links: ['s-progress', 's-feedback'],
	note: 'New. Every marked quiz, test and homework in one list, with the tutor\'s comment. Students may also add school test results (marked "entered by student").',
	empty: ['No results yet', 'Results appear when your tutor marks a quiz or homework.', ''],
	body: `${H('My results')}${chips(['All subjects', 'Mathematics', 'English', 'Physics'])}${table(
		['Assessment', 'Subject', 'Date', 'Mark', 'Source'],
		[
			['Equivalent fractions quiz', 'Mathematics', '4 Nov', '7 / 8', tag('Tutora', 'info')],
			['Term test', 'Mathematics', '28 Oct', '61%', tag('School · entered by Rudo', 'plain')],
			['Comprehension 2', 'English', '27 Oct', '14 / 20', tag('Tutora', 'info')]
		]
	)}`
});

screen({
	portal: 'student',
	id: 's-progress',
	title: 'My learning progress',
	url: '/student/progress',
	status: 'New',
	tab: 'Progress',
	top: 'Progress',
	links: ['s-results'],
	note: 'New. Simple: one line chart per subject, topics "strong / getting there / needs practice", and study days. No league tables, no comparing with other children.',
	empty: ['Not enough results yet', 'After 2 marked quizzes you will see how you are doing.', ''],
	body: `${H('My progress', 'Mathematics')}${chips(['Mathematics', 'English', 'Physics'])}${cols(
		`${card('Quiz marks over time', spark([55, 62, 58, 70, 74, 81], ['Sep', '', '', '', '', 'Nov']))}${card(
			'Topics',
			list([
				['Equivalent fractions', '', tag('Strong')],
				['Adding fractions', '', tag('Getting there', 'info')],
				['Word problems', '', tag('Needs practice', 'wait')]
			])
		)}`,
		card(
			'Study days',
			`${week('yyynyyn')}<p class="small muted" style="margin:8px 0 0">Shows days with a check-in or homework handed in. It shows effort, not hours studied.</p>`
		)
	)}`
});

screen({
	portal: 'student',
	id: 's-schedule',
	title: 'Study schedule',
	url: '/student/plan',
	status: 'New',
	tab: 'Study',
	top: 'Study plan',
	links: ['s-checkin'],
	note: 'New. A weekly plan made with the tutor (and parent): short study blocks and weekly targets. Reminders are in-app and phone notifications (free).',
	empty: [
		'No study plan yet',
		'Make a simple plan with your tutor in your next lesson.',
		'Make my plan'
	],
	body: `${H('My study plan', 'This week · 2 of 4 targets done')}${cols(
		card(
			'This week',
			list([
				['Mon · 30 min', 'Maths: fractions practice', tag('Done')],
				['Tue · 15 min', 'Daily check-in', tag('Done')],
				['Wed · 30 min', 'English: read chapter 6', tag('Planned', 'plain')],
				['Thu · 30 min', 'Maths: Exercise 4B', tag('Planned', 'plain')]
			])
		),
		card(
			'Weekly targets',
			todo([
				['Finish Exercise 4B', '', 1],
				['3 daily check-ins', '', 1],
				['Read chapter 6', ''],
				['Revise times tables', '']
			])
		)
	)}${acts(btn('Edit plan', 'sec'), '<span class="small muted">Reminder at 17:00 · <a>change</a></span>')}`
});

screen({
	portal: 'student',
	id: 's-checkin',
	title: 'Daily study check-in',
	url: '/student/check-in',
	status: 'New',
	tab: 'Study',
	top: 'Study plan',
	links: ['s-progress', 's-home'],
	note: 'New, core of Study Accountability. "What did you study today?" then 3 short questions on that topic from the tutor\'s question bank. Honest wording: it measures understanding shown today, not time spent.',
	empty: [
		'No questions for this topic yet',
		'Tell us what you studied. Your tutor will add questions for it.',
		'Save what I studied'
	],
	body: `${H('Daily check-in', 'About 5 minutes')}${cols(
		`${card('What did you study at school today?', chips(['Fractions', 'Algebra', 'Comprehension', 'Other…'], 0))}${card('Question 1 of 3', `<div class="q"><span>Which is bigger: 3/4 or 5/8?</span><span class="opt on">3/4</span><span class="opt">5/8</span><span class="opt">They are equal</span></div>`)}${btn('Check answer')}`,
		`${card('', `<b>Why this helps</b><p class="small muted" style="margin:6px 0 0">Your tutor sees which topics need more practice and can plan your next lesson around them.</p>`, 'navy')}${card('Streak', `${week('yyyp')}<p class="small muted" style="margin:8px 0 0">3 days in a row</p>`)}`
	)}`
});

screen({
	portal: 'student',
	id: 's-notifs',
	title: 'Notifications',
	url: '/notifications',
	status: 'Exists',
	tab: 'More',
	top: 'Home',
	links: ['s-lesson', 's-homework'],
	note: 'Exists (in-app list + email when set up). Extend: phone notifications via Web Push (free) and a per-type on/off list.',
	empty: ["You're all caught up", 'New messages, lesson changes and reminders appear here.', ''],
	body: `${H('Notifications')}${card(
		'',
		list([
			['Lesson confirmed', 'English, Thu 16:00 · 2 h ago', '<a>Open</a>'],
			['New homework', 'Mathematics: Exercise 4B · yesterday', '<a>Open</a>'],
			['Check-in reminder', 'Fractions · yesterday 17:00', '']
		])
	)}${card('Phone notifications', `<p class="small muted" style="margin:0 0 10px">Get reminders on this phone, free, without SMS.</p>${btn('Turn on', 'sm')}`, 'navy')}`
});

screen({
	portal: 'student',
	id: 's-feedback',
	title: 'Messages & tutor feedback',
	url: '/student/messages',
	status: 'New',
	tab: 'More',
	top: 'Messages',
	links: ['s-lesson'],
	note: 'New. Simple lesson-linked notes and messages between student, parent and tutor (no group chats, no files over 2 MB). WhatsApp stays available as a link, not a replacement.',
	empty: ['No messages yet', "Your tutor's feedback after each lesson will appear here.", ''],
	body: `${H('Messages & feedback')}${cols(
		card(
			'Mr Moyo · Mathematics',
			`<div class="small muted">After lesson · Mon</div><p style="margin:6px 0 10px">Good work on equivalent fractions. Next lesson: unlike denominators. Please finish Exercise 4B.</p><div class="small"><b>Strength:</b> neat working · <b>Practise:</b> word problems</div>`
		),
		card(
			'Write to your tutor',
			`${field('', '', 'Type a short message…', 'area')}<div style="margin-top:10px">${btn('Send', 'sm')}</div>`
		)
	)}`
});

screen({
	portal: 'student',
	id: 's-profile',
	title: 'Profile & settings',
	url: '/account',
	status: 'Extend',
	tab: 'More',
	top: 'Home',
	links: [],
	note: 'Exists (/account: name, password, 2-step login, export, delete). Extend: school, grade, curriculum and subjects (Curriculum Alignment), entered by student or parent.',
	states: false,
	body: `${H('My profile')}${cols(
		card(
			'School details',
			`<div class="g2">${field('School', 'Avondale High', '')}${field('Grade / form', 'Form 2', '', 'sel')}${field('Curriculum', 'ZIMSEC', '', 'sel')}${field('Subjects', 'Maths, English, Physics', '')}</div><p class="small muted" style="margin:10px 0 0">Entered by you or your parent. Your tutor can see this.</p>`
		),
		card(
			'Account',
			list([
				['Password', '', '<a>Change</a>'],
				['2-step login', '', '<a>Turn on</a>'],
				['Download my data', '', '<a>Download</a>']
			])
		)
	)}`
});
