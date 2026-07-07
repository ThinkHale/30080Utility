#!/usr/bin/env node
/**
 * Crescent Staffing — Roster Sync Script
 *
 * Reads a CSV or XLSX roster export and pushes it to the shared platform
 * Supabase project (staffing_roster table), marking anyone no longer in
 * the file as inactive.
 *
 * Usage:
 *   node sync-roster.js path/to/roster.csv
 *   node sync-roster.js path/to/roster.xlsx
 *
 * Schedule (Linux/Mac cron — runs at 6 AM daily):
 *   0 6 * * * node /path/to/sync-roster.js /path/to/roster.csv >> /var/log/roster-sync.log 2>&1
 *
 * Schedule (Windows Task Scheduler):
 *   Action: node C:\path\to\sync-roster.js C:\path\to\roster.csv
 *
 * Setup:
 *   npm install xlsx node-fetch
 *   Set SUPABASE_SERVICE_KEY below (Supabase dashboard → Project Settings →
 *   API → Project API keys → service_role). This bypasses RLS, which is
 *   required since this script doesn't sign in as a platform user.
 */

const XLSX = require('xlsx');
const https = require('https');
const fs = require('fs');

// ─── CONFIGURE THESE ──────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://oavksqgwjqlbnyairljn.supabase.co';

// Get this from: Supabase dashboard → Project Settings → API → service_role key
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'YOUR_SERVICE_ROLE_KEY_HERE';
// ──────────────────────────────────────────────────────────────────────────────

const filePath = process.argv[2];

if (!filePath) {
    console.error('Usage: node sync-roster.js <path-to-roster.csv-or-xlsx>');
    process.exit(1);
}

if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

if (SUPABASE_SERVICE_KEY === 'YOUR_SERVICE_ROLE_KEY_HERE') {
    console.error('ERROR: Set your SUPABASE_SERVICE_KEY in the script or via environment variable.');
    console.error('  Find it at: Supabase dashboard → Project Settings → API → service_role key');
    process.exit(1);
}

// ─── Supabase REST (PostgREST) helpers ────────────────────────────────────────

function supabaseGet(queryPath) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${SUPABASE_URL}/rest/v1/${queryPath}`);
        https.get(url, {
            headers: {
                apikey: SUPABASE_SERVICE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            },
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

function supabaseUpsert(table, body) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                apikey: SUPABASE_SERVICE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
                Prefer: 'resolution=merge-duplicates',
            },
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) resolve(data ? JSON.parse(data) : null);
                else reject(new Error(`Supabase upsert failed ${res.statusCode}: ${data}`));
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

// ─── Column auto-detection ────────────────────────────────────────────────────

function findColumn(headers, options) {
    return headers.find(h =>
        options.some(o =>
            h.toLowerCase().replace(/[\s_\-#]/g, '').includes(o.toLowerCase().replace(/[\s_\-#]/g, ''))
        )
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`[${new Date().toISOString()}] Reading file: ${filePath}`);

    // Parse the file
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
        console.error('ERROR: No data rows found in file.');
        process.exit(1);
    }

    const headers = Object.keys(rows[0]);
    console.log(`Detected columns: ${headers.join(', ')}`);

    const idCol    = findColumn(headers, ['employeeid', 'empid', 'employee#', 'employeenumber', 'badgeid', 'id']);
    const firstCol = findColumn(headers, ['firstname', 'first', 'fname', 'givenname']);
    const lastCol  = findColumn(headers, ['lastname', 'last', 'lname', 'surname', 'familyname']);

    if (!idCol || !firstCol || !lastCol) {
        console.error(`ERROR: Could not identify required columns.`);
        console.error(`  Need: Employee ID, First Name, Last Name`);
        console.error(`  Found: ${headers.join(', ')}`);
        console.error(`  Tip: Rename columns in your export to match one of these patterns.`);
        process.exit(1);
    }

    console.log(`Using columns — ID: "${idCol}", First: "${firstCol}", Last: "${lastCol}"`);

    // Build the incoming roster from the file
    const fileAssociates = {};
    let skipped = 0;
    rows.forEach((row, i) => {
        const empId    = String(row[idCol]).trim();
        const firstName = String(row[firstCol]).trim();
        const lastName  = String(row[lastCol]).trim();
        if (!empId || !firstName || !lastName) { skipped++; return; }
        fileAssociates[empId] = {
            employeeId: empId,
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`,
            isActive: true,
        };
    });

    const fileIds = new Set(Object.keys(fileAssociates));
    console.log(`Parsed ${fileIds.size} associates from file (${skipped} rows skipped).`);

    // Fetch existing roster from Supabase
    console.log('Fetching current roster from Supabase...');
    let currentRoster = {};
    try {
        const rows = await supabaseGet('staffing_roster?id=eq.current&select=associates');
        currentRoster = (rows && rows[0] && rows[0].associates) || {};
    } catch (e) {
        console.warn('Warning: Could not fetch existing roster (will treat as empty):', e.message);
    }

    const currentIds = new Set(Object.keys(currentRoster));

    // Merge: file entries are active, missing entries become inactive
    const updatedRoster = { ...fileAssociates };
    let newCount      = 0;
    let updatedCount  = 0;
    let inactiveCount = 0;

    fileIds.forEach(id => {
        if (currentIds.has(id)) updatedCount++;
        else newCount++;
    });

    currentIds.forEach(id => {
        if (!fileIds.has(id)) {
            updatedRoster[id] = { ...currentRoster[id], isActive: false };
            if (currentRoster[id].isActive) inactiveCount++;
        }
    });

    console.log(`Changes — New: ${newCount}, Updated: ${updatedCount}, Newly inactive: ${inactiveCount}`);

    // Push to Supabase
    const syncTime = new Date().toISOString();
    console.log('Pushing to Supabase...');
    await supabaseUpsert('staffing_roster', {
        id: 'current',
        associates: updatedRoster,
        last_sync: syncTime,
    });

    const activeCount = Object.values(updatedRoster).filter(a => a.isActive).length;
    console.log(`Done. ${activeCount} active associates in roster. Synced at ${syncTime}`);
}

main().catch(err => {
    console.error('FATAL ERROR:', err.message);
    process.exit(1);
});
