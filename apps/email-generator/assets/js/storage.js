// Local persistence layer. Everything lives in localStorage so the app works
// entirely from static GitHub Pages hosting with no backend.
const STORAGE_KEYS = {
  templates: 'nse_templates_v1',
  settings: 'nse_settings_v1',
};

const RESERVED_TOKENS = [
  'emailType', 'client', 'shift', 'date',
  'senderName', 'senderTitle', 'senderPhone', 'senderEmail', 'senderCompany',
  'recipientEmail',
];

const RESERVED_TOKEN_LABELS = {
  emailType: 'Email Type',
  client: 'Client',
  shift: 'Shift',
  date: 'Date',
  senderName: 'Sender Name',
  senderTitle: 'Sender Title',
  senderPhone: 'Sender Phone',
  senderEmail: 'Sender Email',
  senderCompany: 'Sender Company',
  recipientEmail: 'Recipient Email',
};

function uid() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// loadTemplates()/saveTemplates() are the public API the rest of the app
// uses; they read/write localStorage as usual and, when cloud.js has a
// signed-in Firebase user, mirror saves up to Firestore too. loadTemplates()
// waits for cloudReady (resolved by cloud.js once any initial cloud data has
// been pulled into the local cache) so callers always see synced data.
async function loadTemplates() {
  if (typeof cloudReady !== 'undefined') await cloudReady;
  return loadLocalTemplates();
}

async function loadLocalTemplates() {
  const raw = localStorage.getItem(STORAGE_KEYS.templates);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) { /* fall through to seed */ }
  }
  try {
    const res = await fetch('data/templates.json');
    if (!res.ok) throw new Error('seed fetch failed');
    const seed = await res.json();
    saveLocalTemplates(seed);
    return seed;
  } catch (e) {
    return [];
  }
}

function saveLocalTemplates(templates) {
  localStorage.setItem(STORAGE_KEYS.templates, JSON.stringify(templates));
}

async function saveTemplates(templates) {
  saveLocalTemplates(templates);
  if (typeof cloudUser !== 'undefined' && cloudUser) {
    try {
      await cloudSaveTemplates(templates);
    } catch (e) {
      console.warn('Cloud save failed, kept locally', e);
      showToast('Saved locally — cloud sync failed.', true);
    }
  }
}

function loadSettings() {
  const raw = localStorage.getItem(STORAGE_KEYS.settings);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) { /* fall through */ }
  }
  return {
    senderName: '',
    senderTitle: '',
    senderPhone: '',
    senderEmail: '',
    senderCompany: '',
  };
}

function saveLocalSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
}

async function saveSettings(settings) {
  saveLocalSettings(settings);
  if (typeof cloudUser !== 'undefined' && cloudUser) {
    try {
      await cloudSaveSettings(settings);
    } catch (e) {
      console.warn('Cloud save failed, kept locally', e);
      showToast('Saved locally — cloud sync failed.', true);
    }
  }
}
