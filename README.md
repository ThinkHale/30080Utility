# 30080 Utility

One dashboard for the core staffing-team tools, each kept as its own
self-contained app under `apps/`, with a shared login gate and a "back to
dashboard" link stitched on top. Nothing about how each app talks to its own
backend has changed — this repo just gives them one home and one front door.

Open `index.html` to see the dashboard, or serve the repo locally:

```bash
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## Apps

| App | Path | What it does | Backend / data |
|---|---|---|---|
| Resume Review | `apps/resume-review/` | AI resume screening, enhancement, generation, interview questions | Azure Function App (`email/`, `enhance/`, `generate/`, `interview/`) → Azure OpenAI. Deployed by `.github/workflows/deploy-resume-review-function.yml`. |
| Email Generator | `apps/email-generator/` | Template-based New Start / Assignment End / Reminder emails | localStorage, with optional Firebase (Auth + Firestore) cloud sync to its own project — see `apps/email-generator/firestore.rules`. |
| Staffing Planner | `apps/staffing-planner/` | Daily shift staffing, waitlist, core team, badge/DNR check | Firebase Realtime Database (`staffingtool-1ab4f`), with a SharePoint→Power Automate sync path — see `apps/staffing-planner/SYNC-AND-AUTH-SETUP.md`. Also ships `sync-roster.js` (Node) and `gmail-roster-sync.gs` (Google Apps Script) as standalone roster-sync utilities, run independently of the web app. |
| Hot List | `apps/hot-list/` | AI-generated candidate hot-list bullets | Supabase (candidates + **its own email/password login** — this app already gates itself, so it's the one app *not* wrapped in the platform login below) + a Cloudflare Worker (`worker.js`) proxying to the Anthropic API. |
| Labor Reconcile | `apps/labor-reconcile/` | Compare two timesheet exports, flag discrepancies | Client-side only — files are parsed and compared in the browser, nothing is stored or transmitted. |
| Crescent Core | `apps/crescent-core/` | Hours tracker with CSV/Excel import | Firebase Realtime Database (own project, configured via the in-app config panel). |

## Platform login

Every app above except Hot List (which already has its own Supabase login)
is wrapped in a shared sign-in gate — `shared/js/auth-guard.js` plus the
overlay markup at the top of each `apps/*/index.html`. It blocks the page
until a user is signed in, using **one Firebase project dedicated only to
platform login** (not any app's own data project).

This is deliberately separate from each app's own data backend: signing into
the platform doesn't change what Firestore/Realtime Database/Supabase
project that app talks to underneath, and none of the existing per-app data
was moved or re-pointed.

### Activating real sign-in

Right now `shared/js/firebase-config.js` has placeholder values, so every
app shows a visible **"platform sign-in isn't configured yet"** warning and
stays open — that's intentional (fail loud, not fail secure-looking). To
turn it on:

1. [Firebase Console](https://console.firebase.google.com/) → **Add
   project** (e.g. `30080-utility-platform`) → add a **Web app** → copy the
   config object.
2. Paste those values into `shared/js/firebase-config.js`.
3. **Authentication → Sign-in method** → enable **Email/Password**.
4. **Authentication → Users** → add one account per teammate who should have
   access (temporary password; have them change it after first login).
5. Reload any app — the warning banner is replaced by a real login form.

### Still needed per app (can't be done without your Firebase console access)

- **Staffing Planner**: its Realtime Database is currently wide open
  (`".read"/".write": true`). Per `SYNC-AND-AUTH-SETUP.md`, once the shared
  platform login is live, lock its rules to `"auth != null"` — but note that
  check is against *that project's own* Firebase Auth, so this only locks
  down after you also add sign-in to that specific project (or point the
  rule at custom claims from the shared project, if you want one login to
  satisfy both — that's a follow-up, not done automatically here).
- **Email Generator**: its own `firestore.rules` already scope data per
  signed-in UID; publish them in that project's console if you haven't.
- **Crescent Core**: its Realtime Database has no rules/auth today either —
  same "lock down after wiring auth" step applies.

## Adding the next app

Copy its files into `apps/<name>/`, then in its `index.html`:

- If it has **no auth of its own**: add the overlay block + `firebase-app-compat.js` +
  `firebase-auth-compat.js` + `shared/js/firebase-config.js` +
  `shared/js/auth-guard.js` + `shared/js/dash-link.js` right after `<body>`
  (copy the block from `apps/labor-reconcile/index.html` — it's the
  simplest example).
- If it **already loads Firebase itself**: don't load a second copy of the
  SDK — add only `firebase-auth-compat.js` (if missing) plus
  `shared/js/firebase-config.js` + `shared/js/auth-guard.js` right after its
  existing Firebase script tags, reusing that SDK load (see
  `apps/staffing-planner/index.html` or `apps/crescent-core/index.html`).
- If it **already has its own real login** (like Hot List): skip the auth
  overlay entirely, just add `shared/css/dash-link.css` +
  `shared/js/dash-link.js`.

Then add a tile for it in the root `index.html`.
