# Setup: SharePoint Sync, Firebase Rules & Authentication

Operational setup for the **Badge Check** feature. Three independent jobs:

1. **[Power Automate flow](#1-power-automate-flow)** — push the SharePoint tracking sheet to Firebase daily.
2. **[Firebase Auth](#3-firebase-authentication)** — require a login so only your team can read the data.
3. **[Firebase Rules](#2-firebase-database-rules)** — lock the database down to logged-in users.

### Do them in this order

The three depend on each other, so sequence matters:

1. **Power Automate first**, while the database is still open — so you can build and test the sync without auth getting in the way.
2. **Then Authentication** (Section 3) — stand up logins and confirm the app still works for signed-in users.
3. **Lock the rules last** (Section 2) — once login works, close the door. The Power Automate flow keeps working because it authenticates with an admin secret that bypasses rules (explained below).

> **App code status.** The load-time resolver that turns the synced `statusRaw`
> rows into statuses is **built** — the sync takes effect automatically (open Badge
> Check screens update live when the flow runs). The remaining app-code item is the
> **Auth login gate**, marked **[needs app code]** in Section 3 — ask and I'll add it.

Your database URL (used throughout):
`https://staffingtool-1ab4f-default-rtdb.firebaseio.com`

---

## 1. Power Automate flow

**Goal:** every morning, read both tabs of the SharePoint tracking workbook and write them to Firebase so every device sees today's suspensions/DNRs.

### Prerequisites

- The tracking workbook lives in SharePoint/OneDrive (Excel Online).
- **Each tab must be formatted as an Excel Table** (select the data → *Home → Format as Table*, and note the table names). The "List rows present in a table" action only sees named tables.
- An **HTTP** action is available. This is a **premium** Power Automate connector — confirm your plan includes it, or have an admin grant it.
- A Firebase admin write token — see [Getting the Firebase write secret](#getting-the-firebase-write-secret) below.

### Steps

1. **Create the flow** → *Automated cloud flow* is not needed; choose **Scheduled cloud flow**.
   - Name it e.g. `Crescent — Status Sync`.
   - Repeat every **1 day** at your start time (e.g. 4:00 AM). Set the correct time zone.

2. **Store the secret safely.** Add an action **Azure Key Vault → Get secret** (recommended) to pull the Firebase secret, *or* add an **Initialize variable** (Name: `DbSecret`, Type: String) and paste the secret — but if you do this, set the flow’s inputs to *secure*. Never leave the secret in plain text in a shared flow.

3. **Read tab 1 (submission log).** Add **Excel Online (Business) → List rows present in a table**.
   - Location / Document Library / File = your workbook.
   - Table = the submission-log table.
   - **⚠ Turn on pagination (critical).** "List rows present in a table" returns only **256 rows by default**. The tracking sheet is an append-only log well past 256 rows, so without this you only get the *oldest* rows and the recent/active suspensions & DNRs never reach Firebase (this is why Badge Check showed very little). Open the action's **⚙ Settings → Pagination → On**, and set the **Threshold** high (e.g. `100000`). Do this on **both** "List rows" actions, especially the corrective-actions one.

4. **Project tab 1 to clean fields.** Add a **Select** action (Data Operation → Select) on the output of step 3. This renames columns to Firebase-safe keys and drops the rest. Map (From = `value`):

   | Key | Value |
   |-----|-------|
   | `eid` | `item()?['EID']` |
   | `name` | `item()?['Associate Name']` |
   | `action` | `item()?['Corrective Action']` |
   | `date` | `item()?['Date']` |
   | `category` | `item()?['Category']` |
   | `reason` | `item()?['Reason']` |
   | `timeLeft` | `item()?['Time Left']` |

   > **Why Select is required:** Firebase keys can’t contain `. # $ / [ ]`. Your header `1st Day/Week?` has a `/` and `?`, so pushing raw rows would be rejected. Select also shrinks the payload to just what the app needs.

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
     "submissions": @{body('Select_submissions')},
     "corrective": @{body('Select_corrective')},
     "updatedAt": "@{utcNow()}"
   }
   ```

8. **Write to Firebase.** Add an **HTTP** action:
   - **Method:** `PUT`  *(PUT replaces the whole node — a clean daily refresh.)*
   - **URI:** `https://staffingtool-1ab4f-default-rtdb.firebaseio.com/statusRaw.json?auth=@{variables('DbSecret')}`
     *(or `@{body('Get_secret')?['value']}` if using Key Vault)*
   - **Headers:** `Content-Type` = `application/json`
   - **Body:** `@{outputs('Compose')}`

9. **Stamp the update time.** Add a second **HTTP** action:
   - **Method:** `PUT`
   - **URI:** `https://staffingtool-1ab4f-default-rtdb.firebaseio.com/statusMeta.json?auth=@{variables('DbSecret')}`
   - **Body:**
     ```json
     { "updatedAt": "@{utcNow()}", "source": "sharepoint-sync" }
     ```

### Verify

- Run the flow manually. Each HTTP action should return **200**.
- In Firebase Console → Realtime Database, confirm a `statusRaw` node appeared with `submissions` / `corrective` arrays, and a `statusMeta`.
- In the app’s **Badge Check** tab, the status line should show the new "updated" time plus `N on file, M flagged`. If it says *0 on file*, the payload shape didn’t match — confirm `statusRaw` is `{ "submissions": [...], "corrective": [...] }` (row field names are matched leniently, but the two arrays must be named `submissions` and `corrective`).

### Getting the Firebase write secret

The HTTP call needs an admin credential that can write regardless of rules. Two options:

- **Legacy database secret (simplest):** Firebase Console → ⚙ *Project settings* → *Service accounts* → *Database secrets* → reveal/copy. Paste into Key Vault or `DbSecret`. (Google marks these legacy but they still work; if the section is hidden, use the option below.)
- **Service-account OAuth token (more secure, more work):** create a service account key, then in the flow mint a short-lived OAuth2 access token (scope `https://www.googleapis.com/auth/firebase.database` + `userinfo.email`) and pass it as `?access_token=...` instead of `?auth=...`. Use this if policy forbids long-lived secrets.

Both bypass the security rules in Section 2, so the flow keeps working after you lock the database.

---

## 2. Firebase Database Rules

**Goal:** stop anyone with the URL from reading suspension/DNR data. Do this **after** Auth (Section 3) works, or you’ll lock yourself out of the app.

### Steps

1. Firebase Console → **Realtime Database** → **Rules** tab.
2. Replace the contents with:

   ```json
   {
     "rules": {
       ".read": "auth != null",
       ".write": "auth != null"
     }
   }
   ```

   This requires every reader/writer to be a signed-in Firebase user. It covers the whole app (staffing sheets, core team, and the status data alike).

3. Click **Publish**.

### Verify

- Signed **out** of the app → it should fail to load data (expected).
- Signed **in** → everything loads normally.
- Re-run the Power Automate flow → still returns 200 (the admin secret bypasses these rules).

### Notes

- Want defense-in-depth? You can also turn on **App Check** later to block calls from outside your app, but `auth != null` is the essential step.
- **Rollback:** if something breaks, temporarily set both rules back to `true`, fix, then re-publish the locked version.

---

## 3. Firebase Authentication

**Goal:** give the team a login so the locked rules in Section 2 let them in. Keeping it to your people is the whole point.

### Choose a sign-in method

| Method | Effort | Restricts to your team? |
|--------|--------|--------------------------|
| **Email/Password** (recommended to start) | Low — you create each account | Yes — only accounts you create exist |
| **Microsoft (Entra ID)** | Higher — register an app in Entra | Yes — best fit since everyone has work accounts |
| **Google** | Low | No by default — *any* Google account can sign in unless you add an allowlist |

Start with **Email/Password**; move to **Microsoft** later if you want one-click work-account sign-in.

### Steps (Email/Password)

1. Firebase Console → **Authentication** → **Get started**.
2. **Sign-in method** tab → enable **Email/Password** → Save.
3. **Users** tab → **Add user** for each manager/supervisor (email + temporary password). Share credentials securely; have them change the password.

### Wire it into the app  **[needs app code]**

The page currently has no login screen — Auth does nothing until one is added. This is a change to `index.html`:

- Add the auth SDK alongside the existing Firebase scripts:
  ```html
  <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
  ```
- Add a **login gate**: if `firebase.auth().currentUser` is null, show an email/password form and call `firebase.auth().signInWithEmailAndPassword(...)`; otherwise render the app. Add a small **Sign out** button in the header.

I can implement this gate and test it — just say the word.

### Verify

- Open the app → you’re prompted to log in.
- Wrong password is rejected; a created account gets in.
- After signing in, with the Section 2 rules published, all data loads.

---

## Quick reference

| Item | Value |
|------|-------|
| Database URL | `https://staffingtool-1ab4f-default-rtdb.firebaseio.com` |
| Raw rows node (PA writes) | `statusRaw` → `{ submissions: [...], corrective: [...] }` |
| Last-sync stamp | `statusMeta` → `{ updatedAt, source }` |
| Resolved statuses (app upload path) | `statusList` (EID-keyed) |
| PA field names (submissions) | `eid, name, action, date, category, reason, timeLeft` |
| PA field names (corrective) | `eid, name, action, date, offense` |
| Locked rule | `".read"/".write": "auth != null"` |
