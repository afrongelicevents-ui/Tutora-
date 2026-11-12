portal({
	id: 'tutor',
	name: 'Tutor portal',
	desc: 'A practical workspace. Dark green sidebar on desktop, compact rows and times, very little decoration. On phones: dark green top bar and a text tab bar (Today, Calendar, Students, Work, Money). The key new idea is the lesson brief: before every lesson the tutor sees the topic, recent results, missing homework, last feedback and weak areas on one card.',
	journeys: [
		[
			'Prepare and teach',
			[
				'Today',
				'Lesson brief (topic, results, missing homework, weak areas)',
				'Start lesson (Meet link or Tutora room)',
				'Mark attendance',
				'Write feedback'
			]
		],
		[
			'Set and mark work',
			[
				'Assessments: create quiz',
				'Assign to student / group',
				'Marking queue',
				'Feedback sent to student + parent'
			]
		],
		[
			'New booking',
			['Bookings: request', 'Accept / suggest time', 'Calendar', 'Student added to directory']
		]
	]
});

const BRIEF = card(
	'Lesson brief · Rudo · Mathematics · 15:00',
	`${list([
		['Current topic', 'Fractions: unlike denominators (school is on ch. 5)'],
		['Recent results', 'Quiz 7/8 (4 Nov) · school term test 61%'],
		['Homework not done', 'Exercise 4B, due Thu'],
		['Last feedback', '“Next: unlike denominators.”'],
		['Needs help with', 'Word problems (3 of last 5 check-ins wrong)']
	])}`,
	'brief'
);

screen({
	portal: 'tutor',
	id: 't-home',
	title: 'Tutor overview',
	url: '/tutor',
	status: 'Extend',
	side: 'Today',
	tab: 'Today',
	links: ['t-bookings', 't-student', 't-marking', 't-cal', 't-earn'],
	note: 'Exists (/tutor: today, requests, payments to confirm, attention list). Extend: lesson brief on the next lesson, marking queue, and students who missed check-ins.',
	empty: [
		'No lessons today',
		'Your free times are open for bookings. Share your page link.',
		'Copy my page link'
	],
	body: `${H('Today', 'Tuesday 11 Nov · 3 lessons')}${cols(
		`${BRIEF}${card('Today', `${r3('15:00', 'Rudo C.', 'Mathematics · Online · Meet link set', btn('Start', 'sm'))}${r3('16:30', 'Tafadzwa M.', 'Physics · In person', tag('Confirmed'))}${r3('18:00', 'Group: Form 4 revision', 'Mathematics · 4 students · Online', tag('Confirmed'))}`)}`,
		`${card(
			'Needs you',
			list([
				['2 booking requests', '', '<a>Review</a>'],
				['3 answers to mark', '', '<a>Mark</a>'],
				['1 payment to confirm', '$40 · EcoCash', '<a>Check</a>'],
				['2 students missed check-ins', 'this week', '<a>See</a>']
			])
		)}${card(
			'This month',
			kv([
				['18', 'lessons'],
				['$190', 'confirmed']
			])
		)}`
	)}`
});

screen({
	portal: 'tutor',
	id: 't-cal',
	title: 'Calendar & availability',
	url: '/tutor/calendar',
	status: 'Exists',
	side: 'Calendar',
	tab: 'Calendar',
	links: ['t-bookings'],
	note: 'Exists (week and month views, free times, blocked days, .ics download). Integration later: optional Google Calendar sync if tutors ask for it.',
	empty: [
		'No free times set',
		'Add the hours you can teach so students can book.',
		'Add free times'
	],
	body: `${H('Calendar', 'This week')}${seg(['Week', 'Month', 'Free times'], 0)}<div class="cal"><span class="h"></span><span class="h">Mon</span><span class="h">Tue</span><span class="h">Wed</span><span class="h">Thu</span><span class="h">Fri</span><span class="t">15:00</span><span class="ev">Rudo · Maths</span><span class="ev">Rudo · Maths</span><span></span><span class="ev n">Request</span><span class="fr"></span><span class="t">16:30</span><span></span><span class="ev">Tafadzwa</span><span></span><span></span><span class="fr"></span><span class="t">18:00</span><span class="ev">Group</span><span class="ev">Group</span><span></span><span class="ev">Group</span><span class="fr"></span></div><p class="small muted">Striped: blocked (Friday off). Blue: request waiting.</p>`
});

screen({
	portal: 'tutor',
	id: 't-bookings',
	title: 'Bookings',
	url: '/tutor',
	status: 'Exists',
	side: 'Bookings',
	tab: 'Calendar',
	links: ['t-cal', 't-student'],
	note: 'Exists (accept, decline, suggest another time; intro chats). Extend: own page with filters instead of only the overview list.',
	empty: ['No booking requests', 'New requests appear here and on Today.', ''],
	body: `${H('Bookings')}${seg(['Requests (2)', 'Upcoming', 'Past'], 0)}${card('', `${r3('Thu', 'Nyasha K. · intro chat', 'Free 15 min · Mathematics · Form 3', acts(btn('Accept', 'sm'), btn('Other time', 'sm sec')))}${r3('Sat', 'Rudo C.', 'Physics · 09:00 · Online', acts(btn('Accept', 'sm'), btn('Other time', 'sm sec')))}`)}`
});

screen({
	portal: 'tutor',
	id: 't-students',
	title: 'Student directory',
	url: '/tutor/students',
	status: 'Exists',
	side: 'Students',
	tab: 'Students',
	links: ['t-student'],
	note: 'Exists (/tutor/students). Extend: columns for last check-in and open homework so problems stand out.',
	empty: ['No students yet', 'Students appear when you accept their first lesson.', ''],
	body: `${H('Students', '6 active')}${table(
		['Student', 'Level', 'Subjects', 'Last check-in', 'Open work'],
		[
			['Rudo C.', 'Form 2', 'Maths, Physics', 'Today', '1 homework'],
			['Tafadzwa M.', 'Form 4', 'Physics', '4 days ago', tag('Missed 3', 'wait')],
			['Nyasha K.', 'Form 3', 'Maths', '—', '—']
		]
	)}`
});

screen({
	portal: 'tutor',
	id: 't-student',
	title: 'Student profile',
	url: '/tutor/students/[id]',
	status: 'Extend',
	side: 'Students',
	tab: 'Students',
	links: ['t-history', 't-feedback', 't-assess-new', 't-curric'],
	note: 'Exists (contact, private notes, packages, lessons). Extend: school details and curriculum, current topics, weak areas, and the parent contact.',
	empty: ['Student not found', 'They may no longer be your student.', 'All students'],
	body: `${cols(
		`${who('R', 'Rudo Chikore', 'Form 2 · Avondale High · ZIMSEC')}${card(
			'Learning profile',
			list([
				['Subjects with you', 'Mathematics, Physics'],
				['Current topics', 'Fractions (Maths) · Forces (Physics)'],
				['Textbook', 'New General Mathematics 2 (entered by parent)'],
				['Next exam', 'End-of-term test, 28 Nov (entered by Rudo)'],
				['Needs help with', 'Word problems']
			])
		)}${card('Private notes (only you)', '<p class="small" style="margin:0">Prefers worked examples first. Gets anxious with timed quizzes.</p>')}`,
		`${card('Parent', who('M', 'Mrs M. Chikore', 'Parent · +263 7x xxx xxxx'))}${card('Package', `<b>4 of 4 lessons left</b><div class="small muted">Paid 1 Nov</div>`)}${acts(btn('Set homework', 'sm'), btn('New quiz', 'sm sec'))}`
	)}`
});

screen({
	portal: 'tutor',
	id: 't-history',
	title: 'Student learning history',
	url: '/tutor/students/[id]/history',
	status: 'New',
	side: 'Students',
	tab: 'Students',
	links: ['t-student'],
	note: 'New. One timeline per student: lessons, attendance, homework, quiz marks, check-ins and notes, newest first.',
	empty: ['No history yet', 'Lessons, work and results will build up here.', ''],
	body: `${H('Rudo · learning history')}${chips(['All', 'Lessons', 'Work', 'Results', 'Check-ins'])}${card(
		'',
		tl([
			['Today · Check-in: fractions', '2 of 3 right', 1],
			['4 Nov · Quiz: equivalent fractions', '7 / 8 · marked', 1],
			['3 Nov · Lesson: equivalent fractions', 'Attended · feedback sent', 1],
			['31 Oct · Homework 4A', '9 / 10', 1],
			['21 Oct · Lesson', 'Absent (sick)']
		])
	)}`
});

screen({
	portal: 'tutor',
	id: 't-homework',
	title: 'Assignments & homework',
	url: '/tutor/homework',
	status: 'Exists',
	side: 'Homework',
	tab: 'Work',
	links: ['t-marking'],
	note: 'Exists (set homework to one student or a group, see answers, mark). Kept as is; quizzes live under Assessments.',
	empty: [
		'No homework set',
		'Set homework after a lesson. Students get a notification.',
		'Set homework'
	],
	body: `${H('Homework')}${acts(btn('Set homework', 'sm'))}${table(
		['Homework', 'For', 'Due', 'Handed in'],
		[
			['Exercise 4B: fractions', 'Rudo C.', 'Thu', '0 / 1'],
			['Past paper 2019 Q1–5', 'Form 4 group', 'Fri', '2 / 4']
		]
	)}`
});

screen({
	portal: 'tutor',
	id: 't-assess-new',
	title: 'Assessment creation',
	url: '/tutor/assessments/new',
	status: 'New',
	side: 'Assessments',
	tab: 'Work',
	links: ['t-marking'],
	note: 'New. Simple quiz builder: multiple choice, short answer, or "upload a photo of your working". Questions are tagged with a topic so results feed the check-ins and progress. Reusable question bank per tutor.',
	empty: [
		'No questions yet',
		'Add your first question or copy one from your question bank.',
		'Add question'
	],
	body: `${H('New quiz')}${cols(
		`${card('', `<div class="g2">${field('Title', 'Fractions quiz', '')}${field('Topic', 'Fractions', '', 'sel')}${field('For', 'Rudo C.', '', 'sel')}${field('Due', 'Fri 14 Nov', '')}</div>`)}${card('Question 2', `${field('Question', 'Work out 2/3 + 1/4', '')}<div class="q" style="margin-top:10px"><span class="opt">3/7</span><span class="opt on">11/12 · correct</span><span class="opt">3/12</span></div>`)}${acts(btn('Add question', 'sm sec'), btn('Assign quiz', 'sm'))}`,
		card(
			'Question bank',
			list([
				['Fractions', '14 questions'],
				['Algebra basics', '9 questions']
			])
		)
	)}`
});

screen({
	portal: 'tutor',
	id: 't-marking',
	title: 'Assessment marking',
	url: '/tutor/marking',
	status: 'New',
	side: 'Marking',
	tab: 'Work',
	links: ['t-feedback'],
	note: 'New. One queue for photo answers and short answers. Multiple choice is marked automatically. Marks and a one-line comment go to the student and parent.',
	empty: ['Nothing to mark', 'Answers that need you will appear here.', ''],
	body: `${H('Marking', '3 to mark')}${cols(
		card(
			'Tafadzwa M. · Past paper Q3',
			`<div class="skel"><i class="b" style="height:160px"></i></div><p class="small muted">Photo of written answer (compressed)</p><div class="g2">${field('Mark', '3', '')}${field('Out of', '5', '')}</div>${field('Comment', 'Good method. Check units in the last line.', '')}<div style="margin-top:10px">${btn('Save and next')}</div>`
		),
		card(
			'Queue',
			list([
				['Tafadzwa M.', 'Past paper Q3'],
				['Tafadzwa M.', 'Past paper Q4'],
				['Rudo C.', 'Short answer · fractions']
			])
		)
	)}`
});

screen({
	portal: 'tutor',
	id: 't-feedback',
	title: 'Feedback & recommendations',
	url: '/tutor/lessons/[id]',
	status: 'Extend',
	side: 'Today',
	tab: 'Today',
	links: ['t-student'],
	note: 'Lesson page exists (attendance, notes). Extend: a short family-facing note after each lesson (strength, practise, at-home suggestion), separate from private notes.',
	empty: ['', '', ''],
	states: false,
	body: `${H('After the lesson', 'Rudo · Mathematics · today')}${cols(
		`${card('Attendance', seg(['Present', 'Late', 'Absent'], 0))}${card('Note for Rudo and parent', `${field('What went well', 'Equivalent fractions, neat working', '')}${field('Practise next', 'Word problems', '')}${field('At home', '15 min, 3 times a week', '')}`)}${btn('Send feedback')}`,
		card('Private note (only you)', field('', '', 'Not shared with anyone…', 'area'))
	)}`
});

screen({
	portal: 'tutor',
	id: 't-accountability',
	title: 'Study accountability overview',
	url: '/tutor/study',
	status: 'New',
	side: 'Study habits',
	tab: 'Students',
	links: ['t-student'],
	note: 'New. Which students are keeping to their plan, which topics they get wrong in check-ins. Gentle follow-up button sends an in-app nudge (free).',
	empty: [
		'No study plans yet',
		'Make a weekly plan with a student to see their check-ins here.',
		''
	],
	body: `${H('Study habits', 'This week')}${table(
		['Student', 'Check-ins', 'Targets', 'Weak topic', ''],
		[
			['Rudo C.', '5 / 7', '2 / 4', 'Word problems', '<a>Open</a>'],
			['Tafadzwa M.', '1 / 7', '0 / 3', '—', btn('Nudge', 'sm sec')],
			['Nyasha K.', 'No plan', '—', '—', '<a>Make plan</a>']
		]
	)}`
});

screen({
	portal: 'tutor',
	id: 't-curric',
	title: 'Curriculum & textbook information',
	url: '/tutor/curriculum',
	status: 'New',
	side: 'Curriculum',
	tab: 'Students',
	links: ['t-student'],
	note: 'New. Tutor records the syllabus and textbook they teach from and the topic list per level. Students\' school details come from parents/students and are marked "entered by". Nothing is pre-filled or invented.',
	empty: ['No curriculum added', 'Add the syllabus and textbook you teach from.', 'Add curriculum'],
	body: `${H('Curriculum')}${cols(
		card(
			'ZIMSEC O Level Mathematics',
			`${list([
				['Textbook', 'New General Mathematics 2 (you)'],
				['Topics', '1 Number · 2 Fractions · 3 Algebra · 4 Geometry …']
			])}<div style="margin-top:10px">${btn('Edit topics', 'sm sec')}</div>`
		),
		card(
			'Students on this syllabus',
			list([
				['Rudo C.', 'On: Fractions'],
				['Nyasha K.', 'On: Algebra']
			])
		)
	)}`
});

screen({
	portal: 'tutor',
	id: 't-partner',
	title: 'Academic Partnership workspace',
	url: '/tutor/partnership',
	status: 'New',
	side: 'Partnership',
	tab: 'Students',
	links: ['t-student'],
	note: 'New. Only for students whose parent signed consent. Shows the consent scope, messages with the teacher, and the shared plan. Every view and message is logged.',
	empty: ['No partnerships', 'A parent can invite a school teacher with written consent.', ''],
	body: `${H('Academic Partnership')}${cols(
		`${card('Rudo C. · Avondale High', `${note('Consent: Mathematics only, until 31 Mar 2027. Do not request school records.', 'info')}${list([['Mrs Dube (teacher)', '“Class moves to algebra on 20 Nov.” · 6 Nov']])}${field('Reply', '', 'Write to the teacher…', 'area')}<div style="margin-top:10px">${btn('Send', 'sm')}</div>`)}`,
		card(
			'Shared plan',
			todo([
				['Fractions secure by 20 Nov', '', 1],
				['Word problems: 2 practice sets', ''],
				['Preview algebra basics', '']
			])
		)
	)}`
});

screen({
	portal: 'tutor',
	id: 't-earn',
	title: 'Earnings & payments',
	url: '/tutor/payments',
	status: 'Exists',
	side: 'Earnings',
	tab: 'Money',
	links: [],
	note: 'Exists (confirm payments, packages, money this month and year, receipts). If a commission model starts, a "Tutora fee" line and monthly statement are added here.',
	empty: ['No payments yet', 'Payments appear when students send proof.', ''],
	body: `${H('Earnings')}${kv([
		['$190', 'confirmed this month'],
		['$40', 'waiting for you'],
		['$1,420', 'this year'],
		['18', 'lessons this month']
	])}${card('To confirm', list([['Mrs Chikore · $40', 'EcoCash · proof uploaded today', acts(btn('Confirm', 'sm'), btn('Not received', 'sm sec'))]]))}`
});

screen({
	portal: 'tutor',
	id: 't-settings',
	title: 'Tutor profile & settings',
	url: '/tutor/settings',
	status: 'Exists',
	side: 'My page & settings',
	tab: 'Money',
	links: [],
	note: 'Exists (page, subjects & prices, free times, payment details, notifications, approval status). Extend: default video link (Meet / Teams) and curriculum.',
	states: false,
	body: `${H('My page & settings')}${cols(
		card(
			'',
			list([
				['My page', 'tutora…/t/mr-moyo · approved', '<a>Edit</a>'],
				['Subjects & prices', '2 subjects', '<a>Edit</a>'],
				['Free times', 'Mon–Thu, Sat', '<a>Edit</a>'],
				['Payment details', 'EcoCash, bank', '<a>Edit</a>'],
				['Video lessons', 'Default: Google Meet link', '<a>Edit</a>']
			])
		),
		card(
			'Notifications',
			list([
				['New booking', 'In app · phone · email'],
				['Check-in missed 3 days', 'In app']
			])
		)
	)}`
});
