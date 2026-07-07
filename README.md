# 30080 Utility

One dashboard for the core staffing-team tools, each kept as its own
self-contained app under `apps/`, all sharing **one Supabase backend** —
one login, one database, and one set of Edge Functions for AI calls. Each
app used to have its own Firebase project, Azure Function, or Cloudflare
Worker; those have all been folded into this project (except Hot List,
which was already Supabase-based).

Open `index.html` to see the dashboard, or serve the repo locally:

```bash
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## Apps

| App | Path | What it does | Data (table/function in the shared project) |
|---|---|---|---|
| Resume Review | `apps/resume-review/` | AI resume screening, enhancement, generation, interview questions | `resume_review_records` table (saved jobs + history) + Edge Functions `resume-analyze`, `resume-email`, `resume-enhance`, `resume-generate`, `resume-interview` → Azure OpenAI |
| Email Generator | `apps/email-generator/` | Template-based New Start / Assignment End / Reminder emails | `email_templates` / `email_settings` tables (one row per signed-in user), localStorage as offline cache |
| Staffing Planner | `apps/staffing-planner/` | Daily shift staffing, waitlist, core team, badge/DNR check | `staffing_sheets`, `staffing_settings`, `staffing_roster`, `badge_status_raw` tables — see `apps/staffing-planner/SYNC-AND-AUTH-SETUP.md` for the SharePoint→Power Automate sync into `badge_status_raw`, and `sync-roster.js` / `gmail-roster-sync.gs` for the roster sync utilities |
| Hot List | `apps/hot-list/` | AI-generated candidate hot-list bullets | `candidates` / `hot_list_entries` tables + Edge Function `hotlist-generate` → Anthropic. Has its **own** email/password login (predates the platform gate) — the only app not wrapped in the shared login below |
| Labor Reconcile | `apps/labor-reconcile/` | Compare two timesheet exports, flag discrepancies | Client-side only — files are parsed and compared in the browser, nothing is stored or transmitted |
| Crescent Core | `apps/crescent-core/` | Hours tracker with CSV/Excel import | `hours_weeks` table (one row per week) |

## Backend

Everything lives in one Supabase project (`supabase/functions/` holds the
Edge Function source; schema is applied via migrations run against that
project — there's no `migrations/` folder checked in since they were
applied directly, but every table's DDL is reconstructable from
`supabase/functions/*/index.ts` comments and this README's table list
above).

**Auth**: Supabase Auth (email/password), one project, one set of accounts
for the whole platform — `shared/js/supabase-config.js` (project URL +
publishable anon key) + `shared/js/auth-guard.js` (the login gate every app
except Hot List includes). Add teammates via the Supabase dashboard →
Authentication → Users.

**Row-level security**: every table requires `auth.uid() is not null` to
read or write (i.e. any signed-in platform user), except the per-user
tables (`hot_list_entries`, `email_templates`, `email_settings`) which are
scoped to `auth.uid() = owner/user_id`.

**Edge Functions**: `resume-analyze`, `resume-email`, `resume-enhance`,
`resume-generate`, `resume-interview` (Resume Review, calling Azure OpenAI)
and `hotlist-generate` (Hot List, calling Anthropic) — source in
`supabase/functions/`. Each requires the caller's own signed-in Supabase
session token (not just the public anon key — see the `requireUser()` check
in each function), so there's no shared function key to distribute or leak.
Required secrets (set via the Supabase dashboard or CLI, never committed):

| Secret | Used by |
|---|---|
| `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `AZURE_OPENAI_DEPLOYMENT` | `resume-*` functions |
| `ANTHROPIC_API_KEY` | `hotlist-generate` |

## Old per-app backends (retired, not migrated)

Staffing Planner, Email Generator, and Crescent Core each used to have their
own Firebase project. Per an explicit decision when consolidating: **no data
was migrated** — those three Firebase projects still exist with whatever
historical data they had, but nothing reads or writes to them anymore. If
you need old history, look it up there directly; new data only exists in
Supabase going forward. Resume Review's Azure Function App and Hot List's
Cloudflare Worker are similarly retired in favor of the Edge Functions above.

## Adding the next app

Copy its files into `apps/<name>/`, then in its `index.html`, right after
`<body>`:

- If it has **no auth of its own**: add the overlay block +
  `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>`
  + `shared/js/supabase-config.js` + `shared/js/auth-guard.js` +
  `shared/js/dash-link.js` (copy the block from
  `apps/labor-reconcile/index.html` — it's the simplest example).
- If it **already has its own real login** (like Hot List): skip the auth
  overlay entirely, just add `shared/css/dash-link.css` +
  `shared/js/dash-link.js`.
- Any Supabase queries the app makes on page load (not just in response to
  a user action) should `await window.platformAuthReady` first — otherwise
  they can run before a session exists and RLS will silently return zero
  rows (see `apps/resume-review/index.html`'s `initStorage()` for the
  pattern).

Then add a tile for it in the root `index.html`, and a migration + (if it
needs AI calls) an Edge Function under `supabase/functions/`.
