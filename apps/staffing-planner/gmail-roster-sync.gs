/**
 * Crescent Staffing — Roster Auto-Sync
 * Google Apps Script — runs on Google's free servers, no installation needed.
 *
 * ─── TWO TRIGGER OPTIONS ──────────────────────────────────────────────────────
 *
 *  A) EMAIL FORWARD (simplest):
 *     Forward your daily roster email to your Gmail.
 *     This script finds the attachment automatically.
 *
 *  B) GOOGLE DRIVE (via Power Automate or manual upload):
 *     Power Automate saves the file to a specific Drive folder.
 *     This script picks it up from there.
 *
 *  Configure TRIGGER_MODE below to choose which you want.
 *
 * ─── SETUP STEPS ──────────────────────────────────────────────────────────────
 *  1. Go to https://script.google.com → New project → paste this file
 *  2. Fill in CONFIG below
 *  3. If using Drive mode: also enable the Drive API
 *        Left sidebar → Services (+) → Google Drive API → Add
 *  4. Click Run → runManualSync to authorize and test
 *  5. Add a daily trigger:
 *        Left sidebar → Triggers (clock icon) → Add Trigger
 *        Function: dailySync  |  Time-driven → Day timer → 6am–7am
 */

// ─── CONFIGURE THESE ──────────────────────────────────────────────────────────

var TRIGGER_MODE = 'gmail'; // 'gmail' or 'drive'

var CONFIG = {

    // ── Gmail mode ────────────────────────────────────────────────────────────
    // Gmail search that finds your forwarded roster email.
    // Tips: 'from:you@work.com subject:"roster" has:attachment newer_than:2d'
    GMAIL_SEARCH: 'subject:"Daily Roster" has:attachment newer_than:2d',

    // Only grab attachments whose filename contains this string (case-insensitive).
    // Set to '' to accept any .csv/.xlsx attachment.
    ATTACHMENT_NAME_CONTAINS: 'roster',

    // ── Drive mode ────────────────────────────────────────────────────────────
    // The Google Drive FOLDER ID where Power Automate drops the file.
    // (From the URL: drive.google.com/drive/folders/THIS_PART)
    DRIVE_FOLDER_ID: 'YOUR_FOLDER_ID_HERE',

    // ── Firebase ──────────────────────────────────────────────────────────────
    FIREBASE_DB_URL: 'https://staffingtool-1ab4f-default-rtdb.firebaseio.com',

    // Firebase Console → Project Settings → Service Accounts → Database Secrets → Show
    FIREBASE_SECRET: 'YOUR_DATABASE_SECRET_HERE',

    // Send a summary email after each sync? Uses your Google account email.
    // Set to '' to disable.
    NOTIFY_EMAIL: Session.getActiveUser().getEmail(),

    // Row number (1-based) where column headers live. Rows above it are skipped.
    HEADER_ROW: 11,

    // Exact column header names from your export file.
    // Set COL_FULL_NAME when first/last are in one column (script splits on space or comma).
    // Leave COL_FIRST_NAME and COL_LAST_NAME blank when using COL_FULL_NAME.
    COL_ID:         'Person Placed: Legacy Contact ID',
    COL_FULL_NAME:  'Person Placed Name',
    COL_FIRST_NAME: '',
    COL_LAST_NAME:  '',

    // Column containing the associate's assigned shift (e.g. "1st", "2nd", "3rd").
    // Set to '' to skip shift tracking.
    COL_SHIFT: 'Shift',
};

// ──────────────────────────────────────────────────────────────────────────────

/**
 * Entry point called by the daily trigger.
 */
function dailySync() {
    if (TRIGGER_MODE === 'gmail') {
        syncFromGmail();
    } else {
        syncFromDrive();
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// OPTION A: GMAIL MODE
// ═══════════════════════════════════════════════════════════════════════════════

function syncFromGmail() {
    var threads = GmailApp.search(CONFIG.GMAIL_SEARCH, 0, 10);
    if (threads.length === 0) {
        log('No emails found matching: ' + CONFIG.GMAIL_SEARCH);
        return;
    }

    var props = PropertiesService.getScriptProperties();
    var processedIds = JSON.parse(props.getProperty('processedMsgIds') || '{}');

    // Collect every unprocessed message with a matching attachment across all threads
    var toProcess = [];
    threads.forEach(function(thread) {
        thread.getMessages().forEach(function(message) {
            if (processedIds[message.getId()]) return; // already handled
            var attachment = findRosterAttachment(message.getAttachments());
            if (attachment) toProcess.push({ message: message, attachment: attachment });
        });
    });

    if (toProcess.length === 0) {
        log('No new roster attachments found.');
        return;
    }

    // Sort by the YYYY-MM-DD-HH-MM-SS timestamp embedded in the filename
    // so the most recent snapshot is always the last write to Firebase.
    toProcess.sort(function(a, b) {
        return filenameTimestamp(a.attachment.getName()) - filenameTimestamp(b.attachment.getName());
    });

    log('Found ' + toProcess.length + ' new attachment(s) to process (oldest → newest):');
    toProcess.forEach(function(item) { log('  ' + item.attachment.getName()); });

    // Each attachment is a full roster snapshot — process oldest→newest so the
    // latest timestamp wins in Firebase.
    var lastResult, lastName;
    toProcess.forEach(function(item) {
        log('Processing: ' + item.attachment.getName());
        try {
            lastResult = performSync(item.attachment);
            lastName   = item.attachment.getName();
            processedIds[item.message.getId()] = new Date().toISOString();
        } catch (e) {
            log('ERROR processing ' + item.attachment.getName() + ': ' + e.message);
        }
    });

    // Prune old entries from processedIds to keep it from growing unbounded (keep last 60 days)
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    Object.keys(processedIds).forEach(function(id) {
        if (new Date(processedIds[id]) < cutoff) delete processedIds[id];
    });
    props.setProperty('processedMsgIds', JSON.stringify(processedIds));

    if (lastResult) finalize(lastResult, lastName);
}

// ═══════════════════════════════════════════════════════════════════════════════
// OPTION B: DRIVE MODE (Power Automate drops file into a Drive folder)
// ═══════════════════════════════════════════════════════════════════════════════

function syncFromDrive() {
    if (CONFIG.DRIVE_FOLDER_ID === 'YOUR_FOLDER_ID_HERE') {
        throw new Error('Set DRIVE_FOLDER_ID in CONFIG to use Drive mode.');
    }

    var folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
    var files  = folder.getFiles();
    var props  = PropertiesService.getScriptProperties();
    var lastFileId = props.getProperty('lastProcessedFileId');

    // Find the most recently modified file
    var newest = null;
    while (files.hasNext()) {
        var file = files.next();
        var name = file.getName().toLowerCase();
        if (!name.endsWith('.csv') && !name.endsWith('.xlsx') && !name.endsWith('.xls')) continue;
        if (CONFIG.ATTACHMENT_NAME_CONTAINS && !name.includes(CONFIG.ATTACHMENT_NAME_CONTAINS.toLowerCase())) continue;
        if (!newest || file.getLastUpdated() > newest.getLastUpdated()) newest = file;
    }

    if (!newest) {
        log('No roster file found in Drive folder.');
        return;
    }
    if (newest.getId() === lastFileId) {
        log('Drive file already processed: ' + newest.getName());
        return;
    }

    log('Processing Drive file: ' + newest.getName());
    var blob = newest.getBlob();
    // Wrap the Drive blob as an attachment-like object
    var attachment = {
        getName: function() { return newest.getName(); },
        copyBlob: function() { return blob; },
        getContentType: function() { return blob.getContentType(); },
    };
    var result = performSync(attachment);
    props.setProperty('lastProcessedFileId', newest.getId());
    finalize(result, newest.getName());
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORE SYNC LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

function performSync(attachment) {
    var rows = parseAttachment(attachment);
    if (rows.length === 0) throw new Error('No data rows found in file.');

    var headers = Object.keys(rows[0]);

    // Resolve ID column: config name first, then auto-detect
    var idCol = (CONFIG.COL_ID && headers.indexOf(CONFIG.COL_ID) !== -1)
        ? CONFIG.COL_ID
        : findColumn(headers, ['employeeid', 'empid', 'employee#', 'employeenumber', 'badgeid', 'id']);

    // Resolve name columns
    var fullNameCol  = (CONFIG.COL_FULL_NAME  && headers.indexOf(CONFIG.COL_FULL_NAME)  !== -1) ? CONFIG.COL_FULL_NAME  : null;
    var firstNameCol = (CONFIG.COL_FIRST_NAME && headers.indexOf(CONFIG.COL_FIRST_NAME) !== -1) ? CONFIG.COL_FIRST_NAME : null;
    var lastNameCol  = (CONFIG.COL_LAST_NAME  && headers.indexOf(CONFIG.COL_LAST_NAME)  !== -1) ? CONFIG.COL_LAST_NAME  : null;

    // Fall back to auto-detect if config columns not found
    if (!fullNameCol && !firstNameCol) {
        firstNameCol = findColumn(headers, ['firstname', 'first', 'fname', 'givenname']);
        lastNameCol  = findColumn(headers, ['lastname',  'last',  'lname', 'surname', 'familyname']);
        if (!firstNameCol) fullNameCol = findColumn(headers, ['fullname', 'name', 'personplaced', 'associate']);
    }

    if (!idCol || (!fullNameCol && !firstNameCol)) {
        throw new Error(
            'Cannot identify required columns.\n' +
            'Found: ' + headers.join(', ') + '\n' +
            'Update COL_ID / COL_FULL_NAME in CONFIG to match your exact column headers.'
        );
    }

    // Resolve shift column
    var shiftCol = (CONFIG.COL_SHIFT && headers.indexOf(CONFIG.COL_SHIFT) !== -1)
        ? CONFIG.COL_SHIFT
        : findColumn(headers, ['shift', 'assignedshift', 'workshift']);

    log('Columns — ID: "' + idCol + '"' +
        (fullNameCol ? ', Full Name: "' + fullNameCol + '"' : ', First: "' + firstNameCol + '", Last: "' + lastNameCol + '"') +
        (shiftCol ? ', Shift: "' + shiftCol + '"' : ''));

    // Build incoming roster from the file
    var fileAssociates = {};
    var skipped = 0;
    rows.forEach(function(row) {
        var empId = String(row[idCol] || '').trim();
        if (!empId) { skipped++; return; }

        var firstName, lastName, fullName;

        if (fullNameCol) {
            fullName = String(row[fullNameCol] || '').trim();
            if (!fullName) { skipped++; return; }
            // Split "Last, First" or "First Last"
            if (fullName.indexOf(',') !== -1) {
                var parts = fullName.split(',');
                lastName  = parts[0].trim();
                firstName = parts.slice(1).join(',').trim();
            } else {
                var space = fullName.indexOf(' ');
                firstName = space !== -1 ? fullName.slice(0, space).trim()  : fullName;
                lastName  = space !== -1 ? fullName.slice(space + 1).trim() : '';
            }
        } else {
            firstName = String(row[firstNameCol] || '').trim();
            lastName  = lastNameCol ? String(row[lastNameCol] || '').trim() : '';
            fullName  = (firstName + ' ' + lastName).trim();
            if (!firstName) { skipped++; return; }
        }

        var assignedShift = shiftCol ? String(row[shiftCol] || '').trim() : '';

        fileAssociates[empId] = {
            employeeId:    empId,
            firstName:     firstName,
            lastName:      lastName,
            fullName:      fullName,
            isActive:      true,
            assignedShift: assignedShift || null,
        };
    });
    if (skipped > 0) log('Skipped ' + skipped + ' incomplete/empty rows.');

    var fileIds = Object.keys(fileAssociates);
    log('Associates in file: ' + fileIds.length);

    // Fetch current roster from Firebase
    var currentRoster = firebaseGet('/roster/associates') || {};
    var currentIds = Object.keys(currentRoster);

    // Merge: in file → active. Missing from file → inactive.
    var updatedRoster = {};
    fileIds.forEach(function(id) { updatedRoster[id] = fileAssociates[id]; });
    currentIds.forEach(function(id) {
        if (!fileAssociates[id]) {
            updatedRoster[id] = Object.assign({}, currentRoster[id], { isActive: false });
        }
    });

    var newCount      = fileIds.filter(function(id) { return !currentRoster[id]; }).length;
    var inactiveCount = currentIds.filter(function(id) { return currentRoster[id].isActive && !fileAssociates[id]; }).length;
    var syncTime      = new Date().toISOString();

    firebasePut('/roster', { associates: updatedRoster, lastSync: syncTime });

    var activeCount = Object.values(updatedRoster).filter(function(a) { return a.isActive; }).length;
    return { total: fileIds.length, active: activeCount, newAdded: newCount, newlyInactive: inactiveCount, syncTime: syncTime };
}

function finalize(result, filename) {
    log('Sync complete — Active: ' + result.active + ', New: ' + result.newAdded + ', Newly inactive: ' + result.newlyInactive);
    if (CONFIG.NOTIFY_EMAIL) {
        var subject = '[Staffing Tool] Roster synced — ' + result.active + ' active associates';
        var body = [
            'Roster sync completed.',
            '',
            'File: ' + filename,
            'Time: ' + result.syncTime,
            '',
            'Active associates : ' + result.active,
            'New this sync     : ' + result.newAdded,
            'Newly inactive    : ' + result.newlyInactive,
            'Total in file     : ' + result.total,
            '',
            'The Staffing Planner roster is now up to date.',
        ].join('\n');
        GmailApp.sendEmail(CONFIG.NOTIFY_EMAIL, subject, body);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extracts the YYYY-MM-DD-HH-MM-SS timestamp from a filename and returns it
 * as a numeric value suitable for sorting (larger = more recent).
 * Falls back to 0 if no timestamp pattern is found.
 * Example: "roster-2025-06-25-14-30-00.xlsx" → 20250625143000
 */
function filenameTimestamp(filename) {
    var m = filename.match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/);
    if (!m) return 0;
    // Concatenate into a single sortable integer: YYYYMMDDHHmmss
    return parseInt(m[1] + m[2] + m[3] + m[4] + m[5] + m[6], 10);
}

function findRosterAttachment(attachments) {
    for (var i = 0; i < attachments.length; i++) {
        var name = attachments[i].getName().toLowerCase();
        var matchesName = !CONFIG.ATTACHMENT_NAME_CONTAINS || name.includes(CONFIG.ATTACHMENT_NAME_CONTAINS.toLowerCase());
        var validType   = name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls');
        if (matchesName && validType) return attachments[i];
    }
    return null;
}

function parseAttachment(attachment) {
    var name    = attachment.getName().toLowerCase();
    var blob    = attachment.copyBlob();
    var headerRowIdx = (CONFIG.HEADER_ROW || 1) - 1; // convert 1-based to 0-based

    if (name.endsWith('.csv')) {
        var allRows = Utilities.parseCsv(blob.getDataAsString('UTF-8'));
        if (allRows.length <= headerRowIdx + 1) return [];
        var headers = allRows[headerRowIdx].map(function(h) { return String(h).trim(); });
        return allRows.slice(headerRowIdx + 1).map(function(row) {
            var obj = {};
            headers.forEach(function(h, i) { obj[h] = row[i] !== undefined ? String(row[i]).trim() : ''; });
            return obj;
        });
    }

    // XLSX/XLS: upload to Drive and convert to Google Sheets for parsing.
    if (typeof Drive === 'undefined') {
        throw new Error(
            'Drive Advanced Service not enabled.\n' +
            'Apps Script editor → Services (+) → Google Drive API → Add\n' +
            'Or export your roster as CSV to skip this requirement.'
        );
    }

    var fileId = xlsxToSheetId(blob);
    try {
        var ss   = SpreadsheetApp.openById(fileId);
        var data = ss.getSheets()[0].getDataRange().getValues();
        if (data.length <= headerRowIdx + 1) return [];
        var headers = data[headerRowIdx].map(function(h) { return String(h).trim(); });
        return data.slice(headerRowIdx + 1).map(function(row) {
            var obj = {};
            headers.forEach(function(h, i) { obj[h] = row[i] !== undefined ? String(row[i]).trim() : ''; });
            return obj;
        });
    } finally {
        try { DriveApp.getFileById(fileId).setTrashed(true); } catch(e) {}
    }
}

/**
 * Uploads an XLSX blob to Drive as a Google Sheet and returns the file ID.
 * Tries Drive API v3 (Files.create) first, falls back to v2 (Files.insert).
 */
function xlsxToSheetId(blob) {
    // Drive API v3 (most new projects)
    if (typeof Drive.Files.create === 'function') {
        var f = Drive.Files.create(
            { name: '_temp_roster_import_', mimeType: 'application/vnd.google-apps.spreadsheet' },
            blob,
            { fields: 'id' }
        );
        return f.id;
    }
    // Drive API v2 fallback
    if (typeof Drive.Files.insert === 'function') {
        var f2 = Drive.Files.insert(
            { title: '_temp_roster_import_', mimeType: MimeType.GOOGLE_SHEETS },
            blob,
            { convert: true }
        );
        return f2.id;
    }
    throw new Error('Drive API is enabled but neither Files.create (v3) nor Files.insert (v2) is available. Try re-adding the service.');
}

function csvToObjects(csv) {
    var lines = csv.replace(/\r\n|\r/g, '\n').split('\n').filter(function(l) { return l.trim(); });
    if (lines.length < 2) return [];
    var headers = parseCsvLine(lines[0]);
    return lines.slice(1).map(function(line) {
        var vals = parseCsvLine(line);
        var obj  = {};
        headers.forEach(function(h, i) { obj[h] = vals[i] !== undefined ? vals[i] : ''; });
        return obj;
    });
}

function parseCsvLine(line) {
    var result = [], current = '', inQ = false;
    for (var i = 0; i < line.length; i++) {
        var c = line[i];
        if (c === '"')       inQ = !inQ;
        else if (c === ',' && !inQ) { result.push(current.trim()); current = ''; }
        else                 current += c;
    }
    result.push(current.trim());
    return result;
}

function findColumn(headers, options) {
    return headers.find(function(h) {
        var n = h.toLowerCase().replace(/[\s_\-#]/g, '');
        return options.some(function(o) { return n.includes(o); });
    });
}

function firebaseGet(path) {
    var url  = CONFIG.FIREBASE_DB_URL + path + '.json?auth=' + CONFIG.FIREBASE_SECRET;
    var resp = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) throw new Error('Firebase GET failed: ' + resp.getContentText());
    return JSON.parse(resp.getContentText());
}

function firebasePut(path, body) {
    var url  = CONFIG.FIREBASE_DB_URL + path + '.json?auth=' + CONFIG.FIREBASE_SECRET;
    var resp = UrlFetchApp.fetch(url, {
        method: 'put',
        contentType: 'application/json',
        payload: JSON.stringify(body),
        muteHttpExceptions: true,
    });
    if (resp.getResponseCode() < 200 || resp.getResponseCode() >= 300) {
        throw new Error('Firebase PUT failed (' + resp.getResponseCode() + '): ' + resp.getContentText());
    }
}

function log(msg) {
    var line = '[' + new Date().toISOString() + '] ' + msg;
    Logger.log(line);
    console.log(line);
}

/**
 * Test manually: Run → runManualSync in the Apps Script editor.
 */
function runManualSync() {
    dailySync();
}
