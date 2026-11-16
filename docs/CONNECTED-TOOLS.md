# Connected Tools: shortcuts only

Since the overnight build of 16 Nov 2026, Connected Tools are **shortcuts**: Teams, Google
Meet, Zoom, Google Drive and Kahoot! buttons that open the app or website in a new tab.
Tutora never signs in to those accounts, never makes meetings through their APIs and never
syncs anything. **No API keys or OAuth apps are needed**, and nothing here costs money.

| Tool            | What the button does                           | How it is used in Tutora                                                                 |
| --------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Microsoft Teams | opens teams.microsoft.com                      | tutors paste one recurring meeting link per student (or per class) on the student's page |
| Google Meet     | opens meet.google.com                          | same as Teams                                                                            |
| Zoom            | opens zoom.us/join                             | same as Teams (shown with Tutora's own video icon, not Zoom's logo)                      |
| Google Drive    | opens drive.google.com                         | tutors paste a file's share link with "Add a link" on a lesson or in Resources           |
| Kahoot!         | tutors: create.kahoot.it · students: kahoot.it | quiz links on lessons; scores typed in or read from a Kahoot! report file                |

Students join lessons with the **Join lesson** button (from 10 minutes before), as guests —
no Teams, Meet or Zoom account needed. The link checks (real Teams/Meet/Zoom addresses only,
the shared-link warning, the waiting-room tip) are in `src/lib/server/meeting-links.ts`.

What was removed: the Google/Microsoft sign-in ("Connect") flow, Meet/Teams meetings made
through the Calendar and Graph APIs, the Google Drive picker and file sharing, and every
"Connected" badge. The `connected_account` table is left in the database (no destructive
migration) but nothing reads or writes it any more. The optional `GOOGLE_*`, `MS_*` and
`TOOLS_KEY` secrets are no longer used; they can be deleted from GitHub → Settings → Secrets.

Tutora's own low-data video room is also hidden: Owner → Settings → "Tutora video room (old)"
(off by default) brings it back if it is ever needed.
