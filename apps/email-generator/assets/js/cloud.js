// Optional cloud sync via Firebase (Auth + Firestore). If firebase-config.js
// still has placeholder values, or the Firebase SDK failed to load, cloud
// sync stays disabled and the app behaves exactly as it did with
// localStorage only — this file changes nothing in that case.
//
// When enabled, each signed-in user's templates/settings live under
// users/{uid}/data/{templates,settings} in Firestore. storage.js treats
// localStorage as an offline cache: it reads/writes local storage
// immediately, and mirrors saves up to Firestore when signed in. On sign-in,
// cloud data (if any) overwrites the local cache before the page renders.
const CLOUD_ENABLED = typeof firebase !== 'undefined'
  && typeof firebaseConfig !== 'undefined'
  && !!firebaseConfig.apiKey
  && !firebaseConfig.apiKey.startsWith('YOUR_');

let cloudUser = null;
let cloudAuth = null;
let cloudDb = null;

let resolveCloudReady;
const cloudReady = new Promise((resolve) => { resolveCloudReady = resolve; });

function cloudDocRef(kind) {
  return cloudDb.collection('users').doc(cloudUser.uid).collection('data').doc(kind);
}

async function cloudLoadTemplates() {
  if (!cloudUser) return null;
  const snap = await cloudDocRef('templates').get();
  return snap.exists ? (snap.data().list || []) : null;
}

async function cloudSaveTemplates(templates) {
  if (!cloudUser) return;
  await cloudDocRef('templates').set({
    list: templates,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

async function cloudLoadSettings() {
  if (!cloudUser) return null;
  const snap = await cloudDocRef('settings').get();
  return snap.exists ? snap.data() : null;
}

async function cloudSaveSettings(settings) {
  if (!cloudUser) return;
  await cloudDocRef('settings').set({
    ...settings,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

async function signInWithGoogle() {
  try {
    await cloudAuth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
  } catch (e) {
    showToast('Sign-in failed: ' + e.message, true);
  }
}

async function signOutOfCloud() {
  try {
    await cloudAuth.signOut();
  } catch (e) {
    showToast('Sign-out failed: ' + e.message, true);
  }
}

function renderCloudWidget() {
  const textEl = document.getElementById('cloudStatusText');
  const signInBtn = document.getElementById('cloudSignInBtn');
  const signOutBtn = document.getElementById('cloudSignOutBtn');
  if (!textEl) return; // widget not present on this page

  if (!CLOUD_ENABLED) {
    textEl.textContent = 'Local only (Firebase not configured)';
    signInBtn.style.display = 'none';
    signOutBtn.style.display = 'none';
    return;
  }
  if (cloudUser) {
    textEl.textContent = `Synced as ${cloudUser.displayName || cloudUser.email}`;
    signInBtn.style.display = 'none';
    signOutBtn.style.display = '';
  } else {
    textEl.textContent = 'Not signed in — changes stay on this device';
    signInBtn.style.display = '';
    signOutBtn.style.display = 'none';
  }
}

function bindCloudWidget() {
  const signInBtn = document.getElementById('cloudSignInBtn');
  const signOutBtn = document.getElementById('cloudSignOutBtn');
  if (signInBtn) signInBtn.addEventListener('click', signInWithGoogle);
  if (signOutBtn) signOutBtn.addEventListener('click', signOutOfCloud);
  renderCloudWidget();
}

async function pullCloudIntoLocalCache() {
  try {
    const [cloudTemplates, cloudSettings] = await Promise.all([cloudLoadTemplates(), cloudLoadSettings()]);
    if (cloudTemplates) {
      saveLocalTemplates(cloudTemplates);
    } else {
      // First sign-in with nothing in the cloud yet: push up whatever is
      // already cached locally so this device becomes the seed.
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

function initCloud() {
  if (!CLOUD_ENABLED) {
    resolveCloudReady();
    return;
  }

  firebase.initializeApp(firebaseConfig);
  cloudAuth = firebase.auth();
  cloudDb = firebase.firestore();

  let firstAuthCheck = true;
  cloudAuth.onAuthStateChanged(async (user) => {
    cloudUser = user;
    if (user) await pullCloudIntoLocalCache();
    renderCloudWidget();
    if (firstAuthCheck) {
      firstAuthCheck = false;
      resolveCloudReady();
    } else {
      // Auth state changed after the page already rendered (sign in/out) —
      // reload so every page module picks up the refreshed local cache.
      location.reload();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bindCloudWidget();
  initCloud();
});
