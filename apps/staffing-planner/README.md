# Crescent Staffing Planner

A compact, cloud-enabled staffing management tool for production environments. Built for managers who need to quickly staff 120+ associates per shift with auto-save and remote access capabilities. Part of the 30080 Utility platform — see the root [README.md](../../README.md) for the shared Supabase setup (login) this app depends on.

## Features

### Compact Design
- **Table-based layout** - Maximizes visible associates on screen
- **Inline editing** - Type names directly into positions
- **Small fonts & tight spacing** - Optimized for high-density data entry
- **Responsive design** - Works on tablets and computers

### Staffing Management
- **Direct name input** - Simply type associate names into position slots
- **New associate checkbox** - Mark first-day associates with one click
- **Waitlist integration** - Separate waitlist section within the same table
- **Date & shift tracking** - Every staffing sheet is saved with date and shift
- **Real-time stats** - See filled positions, new hires, and waitlist count at a glance

### Cloud Sync & Remote Access
- **Auto-save** - Changes automatically save 2 seconds after editing
- **Supabase integration** - Shared platform database for remote access, gated behind the platform login
- **Local fallback** - Works offline with localStorage
- **Reporting tab** - View and download historical staffing data

### Additional Features
- **Core associates management** - Pre-configure regular team members
- **Export functionality** - Download staffing data as JSON
- **Multiple shifts** - Support for Day, Night, and Swing shifts
- **Production line setup** - Configure multiple lines with leads

## Quick Start

1. **Open the file** - Simply open `index.html` in any modern web browser
2. **Go to Setup tab** - Configure your production lines
3. **Start Staffing** - Begin entering associate names
4. **Auto-save** - Your changes save automatically

## Cloud Setup

Cloud storage now comes from the shared platform Supabase project (see the
root README) rather than a per-app Firebase project — there's nothing to
configure in this app specifically. Signing in at the platform dashboard is
enough; staffing sheets, core associates, roster, and Badge Check data all
read/write through `shared/js/supabase-config.js` (loaded by this page).

## Usage Guide

### Setting Up a Shift

1. **Go to Setup tab**
2. Enter production line information:
   - Line Letter (A, B, C, etc.)
   - Line Lead name
   - Number of associates needed
3. Click "Add Another Line" for multiple lines
4. Click "Start Staffing"

### Staffing Associates

1. **Select Date & Shift** at the top of the staffing view
2. **Type names** directly into the position slots
3. **Check "New" box** for first-day associates
4. Changes auto-save after 2 seconds

### Managing Waitlist

1. Scroll to the **WAITLIST** section at the bottom
2. Click **"+ Add"** to add a new waitlist entry
3. Type the associate's name
4. Check "New" if applicable
5. Click **×** to remove from waitlist

### Viewing Reports

1. Go to **Reports tab**
2. Click any saved shift to view details
3. Click **"Load into Staffing"** to edit a previous shift
4. Reports show filled positions, new hires, and waitlist

### Managing Core Associates

1. Go to **Core Team tab**
2. Select an existing lead or enter a new one
3. Add core associates with optional notes
4. Core associates can be pre-loaded when setting up shifts (optional)

## Badge Check (Suspensions / DNR / Early Leaves)

The **Badge Check** tab lets you scan a badge (or type an EID) and instantly see
whether an associate is suspended, DNR, terminated, or clear to work. The data
comes from the group SharePoint tracking workbook (the same data that goes out
in the per-submission emails).

### How matching works

- Associates are matched on **EID** (employee/badge ID) — not name — so flipped
  names and typos don't cause misses.
- The workbook is scanned across **all tabs**. Any row with an `EID` column and a
  `Corrective Action` of DNR / Suspension / Termination becomes a status entry.
  Rows with only a `Category` / `Time Left` (the submission log) are counted as
  **early-leave events** (informational, not blocking).
- One EID can appear many times; the tool resolves to a single effective status:
  **DNR / Termination always outrank a Suspension**, and ties break to the most
  recent date.

### Suspension return dates

Return dates are **calculated**, not entered. The workweek is **Mon–Thu**, and a
suspension is served for **5 working days after the issuance date**. Example: a
suspension issued Thu 6/25 returns **Mon 7/6**. The badge then shows
`SUSPENDED until Mon 7/6` and auto-clears on the return date. To change the rule,
edit `STATUS_WORKING_DAYS` / `SUSPENSION_WORKING_DAYS` in `index.html`.

### Where status shows

The same live status data drives both the **Badge Check** scan and the **inline
pills** on the staffing screen (line slots + waitlist). Inline pills match on
**either a typed name or a scanned EID**, so both staffing styles flag correctly.

### "Last lead they worked for"

To keep crews consistent under a lead even when that lead runs a different line,
the tool reads saved staffing reports and shows the **lead each associate last
worked for**:
- **Inline while staffing** — a small `↳ <lead>` hint under each name (turns
  **amber** when that lead differs from the current line's lead).
- **On the badge scan result** — `↳ Usually works for: <lead>` (only for people
  whose EID↔name is known, i.e. those in the tracking sheet).

### Getting the data in

Both ingestion paths funnel through the **same `statusRaw` node** — a raw
`{ submissions, corrective }` payload — which the app resolves into statuses on
load. This keeps the precedence + return-date logic in one place no matter how the
data arrives.

**Manual upload:** On the Badge Check tab, click **Upload Tracking Sheet** and pick
the exported `.xlsx`. It writes the rows to `statusRaw` (+ `statusMeta`); every
device resolves and sees it.

**Automated daily sync from SharePoint (Power Automate):** Supabase's REST
API (PostgREST) lets a scheduled flow push the data without any app backend —
see [`SYNC-AND-AUTH-SETUP.md`](SYNC-AND-AUTH-SETUP.md) for the exact flow
shape and credentials to use.

> **Why push raw rows (`statusRaw`) instead of a resolved status list?** It keeps
> the DNR-outranks-suspension precedence and the working-day return-date math in
> one place (the app), so Power Automate just dumps rows — no date logic in the
> flow. The app resolves `statusRaw` on load, and live-updates open screens when
> the sync runs. Row field names are matched leniently, so the clean names from the
> Power Automate Select step *and* the original Excel headers both work.

### Security

This list contains sensitive HR/PII data. It now sits behind the platform's
real Supabase login (`badge_status_raw` table, RLS requires `auth.uid() is
not null`) instead of Firebase's old wide-open default rule — see
[`SYNC-AND-AUTH-SETUP.md`](SYNC-AND-AUTH-SETUP.md) for how the sync flow
authenticates now that reads/writes require a signed-in session.

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Data Storage

- **Signed in**: Data synced to the shared Supabase project (accessible from any device)
- **Offline**: Falls back to browser localStorage
- **Auto-save**: Triggers 2 seconds after last change
- **Manual export**: Available via Export button

## Support

For issues or questions:
- Check browser console for error messages
- Confirm you're signed in to the platform
- Ensure internet connection for cloud sync
- Test with different browsers if issues persist

## Technical Details

- **Framework**: React 18 (via CDN)
- **Database**: Supabase (shared platform project)
- **Fallback**: Browser localStorage
- **File size**: Single HTML file (~50KB)
- **Dependencies**: None (all loaded via CDN)

---

**Version**: 2.0
**Last Updated**: 2025
**License**: Proprietary - Crescent Staffing
