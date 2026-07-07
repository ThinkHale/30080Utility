# Setup: SharePoint Sync & Auth (Supabase)

Operational setup for the **Badge Check** feature, now backed by the shared
platform Supabase project instead of a per-app Firebase Realtime Database.

> **Status.** Authentication and RLS (row-level security) are **already
> live** platform-wide — every app in 30080 Utility, including this one,
> requires a signed-in Supabase user before any data loads. The remaining
> operational task below is wiring the **daily SharePoint → Supabase sync**
> (Power Automate), which now needs a service-role credential instead of the
> old Firebase legacy database secret.

Your Supabase project (used by every app on the platform, not just this
one): see the root [README.md](../../README.md) for the project URL. The
`badge_status_raw` table (this feature's data) has one row, `id = 'current'`,
with `submissions`, `corrective`, `source`, and `updated_at` columns.

---

## 1. Power Automate flow

**Goal:** every morning, read both tabs of the SharePoint tracking workbook
and push them to Supabase so every device sees today's suspensions/DNRs.

### Prerequisites

- The tracking workbook lives in SharePoint/OneDrive (Excel Online).
- **Each tab must be formatted as an Excel Table** (select the data → *Home → Format as Table*, and note the table names). The "List rows present in a table" action only sees named tables.
- An **HTTP** action is available. This is a **premium** Power Automate connector — confirm your plan includes it, or have an admin grant it.
- A Supabase **service role key** for this project — see [Getting the service role key](#getting-the-service-role-key) below. This bypasses RLS, which is required since the flow itself doesn't sign in as a platform user.

### Steps

1. **Create the flow** → *Scheduled cloud flow*.
   - Name it e.g. `Crescent — Status Sync`.
   - Repeat every **1 day** at your start time (e.g. 4:00 AM). Set the correct time zone.

2. **Store the secret safely.** Add an action **Azure Key Vault → Get secret** (recommended) to pull the Supabase service role key, *or* add an **Initialize variable** (Name: `SupabaseServiceKey`, Type: String) and paste the key — but if you do this, set the flow's inputs to *secure*. Never leave the key in plain text in a shared flow.

3. **Read tab 1 (submission log).** Add **Excel Online (Business) → List rows present in a table**.
   - Location / Document Library / File = your workbook.
   - Table = the submission-log table.
   - **⚠ Turn on pagination (critical).** "List rows present in a table" returns only **256 rows by default**. The tracking sheet is an append-only log well past 256 rows, so without this you only get the *oldest* rows and the recent/active suspensions & DNRs never reach Supabase. Open the action's **⚙ Settings → Pagination → On**, and set the **Threshold** high (e.g. `100000`). Do this on **both** "List rows" actions, especially the corrective-actions one.

4. **Project tab 1 to clean fields.** Add a **Select** action (Data Operation → Select) on the output of step 3. Map (From = `value`):

   | Key | Value |
   |-----|-------|
   | `eid` | `item()?['EID']` |
   | `name` | `item()?['Associate Name']` |
   | `action` | `item()?['Corrective Action']` |
   | `date` | `item()?['Date']` |
   | `category` | `item()?['Category']` |
   | `reason` | `item()?['Reason']` |
   | `timeLeft` | `item()?['Time Left']` |

5. **Read tab 2 (corrective actions).** Another **List rows present in a table** pointed at the corrective-actions table.

6. **Project tab 2.** Another **Select** on step 5 (From = `value`):

   | Key | Value |
   |-----|-------|
   | `eid` | `item()?['EID']` |
   | `name` | `item()?['Associate Name']` |
   | `action` | `item()?['Corrective Action']` |
   | `date` | `item()?['Date']` |
   | `offense` | `item()?['Offense Category']` |

7. **Build the payload.** Add **Compose** (Data Operation → Compose) with this JSON (swap the `Select` references for your actual action names):

   ```json
   {
     "id": "current",
     "submissions": @{body('Select_submissions')},
     "corrective": @{body('Select_corrective')},
     "source": "sharepoint-sync",
     "updated_at": "@{utcNow()}"
   }
   ```

8. **Upsert to Supabase.** Add an **HTTP** action:
   - **Method:** `POST`
   - **URI:** `https://<your-project-ref>.supabase.co/rest/v1/badge_status_raw`
   - **Headers:**
     - `Content-Type` = `application/json`
     - `apikey` = `@{variables('SupabaseServiceKey')}`
     - `Authorization` = `Bearer @{variables('SupabaseServiceKey')}`
     - `Prefer` = `resolution=merge-duplicates` *(upsert on the `id` primary key — replaces the one `current` row cleanly each run)*
   - **Body:** `@{outputs('Compose')}`

### Verify

- Run the flow manually. The HTTP action should return **200/201**.
- In the Supabase dashboard → Table Editor → `badge_status_raw`, confirm the
  `submissions` / `corrective` columns updated and `updated_at` is recent.
- In the app's **Badge Check** tab, the status line should show the new "updated" time plus `N on file, M flagged`. If it says *0 on file*, the payload shape didn't match — confirm `submissions`/`corrective` are arrays (row field names are matched leniently, but the two arrays must be named `submissions` and `corrective`).

### Getting the service role key

Supabase dashboard → **Project Settings → API → Project API keys → `service_role`**.
This key bypasses RLS entirely — treat it like a root password: store it only
in Key Vault or a secure flow variable, never in the flow body or committed
anywhere.

---

## 2. Row-level security (already applied)

`badge_status_raw` (like every table in this project) has RLS enabled,
requiring `auth.uid() is not null` for both read and write — i.e. any
signed-in platform user can read/write it, but a fully anonymous request
cannot. This is already live; there's nothing left to configure here. The
Power Automate flow bypasses this rule entirely by authenticating with the
service role key above, so it keeps working regardless.

If you want tighter control later (e.g. read-only for most staff, write
restricted to a specific role), that would mean adding a `role` column to
each user's profile and updating the RLS policy to check it — a deliberate
follow-up, not something this setup assumes.

---

## Quick reference

| Item | Value |
|------|-------|
| Table | `badge_status_raw` (single row, `id = 'current'`) |
| Columns | `submissions jsonb`, `corrective jsonb`, `source text`, `updated_at timestamptz` |
| PA field names (submissions) | `eid, name, action, date, category, reason, timeLeft` |
| PA field names (corrective) | `eid, name, action, date, offense` |
| RLS | `auth.uid() is not null` for read and write |
