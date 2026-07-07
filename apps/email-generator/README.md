# Email Generator

A small static web app for building consistent, repeatable emails (New Start,
Assignment End, Reminder, Interview Scheduled, etc.) from reusable templates,
then copying or downloading them for use in Outlook. Part of the 30080
Utility platform — see the root [README.md](../../README.md) for the shared
Supabase setup (login) this app depends on.

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

Templates and settings live in your browser's local storage as an offline
cache, and sync to the shared platform Supabase project
(`email_templates` / `email_settings` tables, one row per signed-in user) —
see [`assets/js/cloud.js`](assets/js/cloud.js). Use **Export JSON** /
**Import JSON** on the Templates page to back them up or move them between
accounts. You can also overwrite [`data/templates.json`](data/templates.json)
with an exported file and commit it, so a fresh browser starts pre-seeded
with your templates before the first cloud sync.

## Local development

No build step is required — just open `index.html` in a browser, or serve the
folder locally, e.g.:

```bash
python3 -m http.server 8000
```

then visit `http://localhost:8000`.
