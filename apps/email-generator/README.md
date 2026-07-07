# Email Generator

A small static web app for building consistent, repeatable emails (New Start,
Assignment End, Reminder, Interview Scheduled, etc.) from reusable templates,
then copying or downloading them for use in Outlook. Everything runs in the
browser — no backend, no build step, no external dependencies — so it hosts
directly on GitHub Pages.

## Pages

- **`index.html` — Generate Email**: pick an email type, client, shift, and
  date, fill in any additional fields the template defines, and get a live
  preview you can copy or download.
- **`templates.html` — Templates & Settings**: create/edit the base templates
  (subject + rich-text body), including inline images (facility photos, map
  screenshots), and set your default sender info (name, title, phone, email,
  company) used across every template.

## How it works

- Templates are stored as JSON (in your browser's `localStorage`), seeded on
  first load from [`data/templates.json`](data/templates.json).
- A template's subject/body can contain `{{tokens}}`. Standard tokens
  (`{{client}}`, `{{shift}}`, `{{date}}`, `{{emailType}}`, `{{senderName}}`,
  `{{senderTitle}}`, `{{senderPhone}}`, `{{senderEmail}}`,
  `{{senderCompany}}`, `{{recipientEmail}}`) are filled from the form/settings
  automatically. Any other token (e.g. `{{employeeName}}`, `{{reportTime}}`)
  is auto-detected as a custom field and the Templates page lets you set its
  label, input type (text, text area, date, time, dropdown), and dropdown
  options — the Generate page then builds the form for it automatically.
- Images are inserted as embedded (base64) `<img>` tags directly in the
  template, so there's nothing external to host or break.
- On the Generate page:
  - **Copy Rich Email** copies formatted HTML (with images) to the
    clipboard — paste directly into a new Outlook message.
  - **Copy Plain Text** copies a plain-text version.
  - **Download .eml** saves a standard email file with inline images that
    Outlook can open. Since Outlook opens `.eml` files as a *received*
    message, use **Forward** or **Edit Message** inside Outlook to make it
    editable, add a real recipient, and send.

## Data & backups

Templates and settings live in your browser's local storage, so they're
per-browser/device unless you turn on [cloud sync](#cloud-sync-optional-firebase).
Use **Export JSON** / **Import JSON** on the Templates page to back them up
or move them between machines. You can also overwrite
[`data/templates.json`](data/templates.json) with an exported file and commit
it, so a fresh browser starts pre-seeded with your templates.

## Cloud sync (optional, Firebase)

By default the app is exactly as described above — everything stays in
`localStorage`. You can optionally turn on cloud sync so templates and
sender settings follow you across browsers/devices, backed by
[Firebase](https://firebase.google.com/) (Auth + Firestore):

1. In the [Firebase console](https://console.firebase.google.com/), create a
   project, then add a **Web app** to it (Project settings → General →
   Your apps) and copy the `firebaseConfig` object it gives you.
2. Paste those values into
   [`assets/js/firebase-config.js`](assets/js/firebase-config.js), replacing
   the `YOUR_...` placeholders. These values aren't secret — anyone can see
   them in your site's source — access is controlled by Firestore's
   security rules, not by hiding this file.
3. In the console, enable **Authentication → Sign-in method → Google**.
4. In the console, create a **Firestore Database** (production mode is
   fine), then publish the rules in
   [`firestore.rules`](firestore.rules) (Firestore → Rules tab, paste and
   publish). These rules scope every user to their own data by Firebase
   Auth UID, so only you can read or write what you sync.
5. Reload the site — a "Sign in with Google" button appears in the header.
   Once signed in, saving a template or your sender settings also writes to
   Firestore (`users/{your-uid}/data/templates` and `.../settings`), and any
   other browser you sign into with the same account pulls that data down.

If you skip all of this, the header just shows "Local only (Firebase not
configured)" and the app works exactly as it did before.

## Hosting on GitHub Pages

This repo includes a workflow at
[`.github/workflows/pages.yml`](.github/workflows/pages.yml) that deploys the
site automatically on every push to `main`. To enable it:

1. In the repo, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main` (or run the workflow manually from the **Actions** tab).

The site will be published at `https://<your-username>.github.io/<repo-name>/`.

## Local development

No build step is required — just open `index.html` in a browser, or serve the
folder locally, e.g.:

```bash
python3 -m http.server 8000
```

then visit `http://localhost:8000`.
