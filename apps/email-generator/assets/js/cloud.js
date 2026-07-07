// Cloud sync via the shared platform Supabase project (see
// shared/js/auth-guard.js, loaded before this file). Sign-in is mandatory
// platform-wide now, so unlike the old optional Firebase version this
// always syncs once a session exists — storage.js's public API
// (loadTemplates/saveTemplates/loadSettings/saveSettings) is unchanged, so
// only this file and the cloud-status widget needed to change.
//
// Each signed-in user's templates/settings live in the shared
// email_templates / email_settings tables (one row per user, primary key
// = auth.uid()). storage.js treats localStorage as an offline cache: it
// reads/writes local storage immediately, and mirrors saves up to
// Supabase when signed in. On sign-in, cloud data (if any) overwrites the
// local cache before the page renders.
let cloudUser = null;

let resolveCloudReady;
const cloudReady = new Promise((resolve) => {
  resolveCloudReady = resolve;
});

async function cloudLoadTemplates() {
  if (!cloudUser) return null;
  const { data, error } = await window.platformSupabase
    .from('email_templates')
    .select('list')
    .eq('owner', cloudUser.id)
    .maybeSingle();
  if (error) throw error;
  return data ? data.list : null;
}

async function cloudSaveTemplates(templates) {
  if (!cloudUser) return;
  const { error } = await window.platformSupabase
    .from('email_templates')
    .upsert({ owner: cloudUser.id, list: templates, updated_at: new Date().toISOString() });
  if (error) throw error;
}

async function cloudLoadSettings() {
  if (!cloudUser) return null;
  const { data, error } = await window.platformSupabase
    .from('email_settings')
    .select('data')
    .eq('owner', cloudUser.id)
    .maybeSingle();
  if (error) throw error;
  return data ? data.data : null;
}

async function cloudSaveSettings(settings) {
  if (!cloudUser) return;
  const { error } = await window.platformSupabase
    .from('email_settings')
    .upsert({ owner: cloudUser.id, data: settings, updated_at: new Date().toISOString() });
  if (error) throw error;
}

function renderCloudWidget() {
  const textEl = document.getElementById('cloudStatusText');
  if (!textEl) return; // widget not present on this page
  textEl.textContent = cloudUser ? `Synced as ${cloudUser.email}` : 'Signed in';
}

function bindCloudWidget() {
  const signOutBtn = document.getElementById('cloudSignOutBtn');
  if (signOutBtn) signOutBtn.addEventListener('click', () => window.platformAuth.signOut());
  renderCloudWidget();
}

async function pullCloudIntoLocalCache() {
  try {
    const [cloudTemplates, cloudSettings] = await Promise.all([cloudLoadTemplates(), cloudLoadSettings()]);
    if (cloudTemplates) {
      saveLocalTemplates(cloudTemplates);
    } else {
      // First sign-in with nothing in the cloud yet: push up whatever is
      // already cached locally so this account becomes the seed.
      await cloudSaveTemplates(await loadLocalTemplates());
    }
    if (cloudSettings) {
      saveLocalSettings(cloudSettings);
    } else {
      await cloudSaveSettings(loadSettings());
    }
  } catch (e) {
    console.warn('Cloud sync failed, using local cache', e);
    showToast('Cloud sync failed — using the local copy for now.', true);
  }
}

async function initCloud() {
  const session = await window.platformAuthReady;
  cloudUser = session ? session.user : null;
  if (cloudUser) await pullCloudIntoLocalCache();
  renderCloudWidget();
  resolveCloudReady();
}

document.addEventListener('DOMContentLoaded', () => {
  bindCloudWidget();
  initCloud();
});
