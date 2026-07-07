// Shared login gate for every page in the 30080 Utility platform. Expects
// the page to have already loaded the Firebase compat SDK (app + auth) and
// this file's firebase-config.js before this script, and to contain the
// overlay markup this file looks for (#platformAuthOverlay etc. — see any
// apps/*/index.html for the block to copy).
//
// Initializes its own NAMED Firebase app ("platformAuth") rather than the
// default app, so it can safely share a page with another app's own
// firebase.initializeApp() call (several mounted apps have their own
// Firebase project for data sync, separate from this platform-wide login).
//
// Blocks the rest of the page (via the .platform-auth-unlocked class on
// <body>, see auth-overlay.css) until a Firebase user is signed in. If the
// shared Firebase project hasn't been configured yet (firebase-config.js
// still has placeholder values), it unlocks the page but leaves a visible
// warning instead of silently pretending the app is protected.
(function () {
  const overlay = document.getElementById("platformAuthOverlay");
  const msg = document.getElementById("platformAuthMsg");
  const form = document.getElementById("platformAuthForm");
  const emailInput = document.getElementById("platformAuthEmail");
  const passwordInput = document.getElementById("platformAuthPassword");
  if (!overlay) return;

  const configured =
    typeof platformFirebaseConfig !== "undefined" &&
    !!platformFirebaseConfig.apiKey &&
    !platformFirebaseConfig.apiKey.startsWith("YOUR_");

  function unlock() {
    document.body.classList.add("platform-auth-unlocked");
  }

  if (!configured) {
    msg.textContent =
      "Platform sign-in isn't configured yet, so this app is currently unprotected. See README.md → “Activating real sign-in” to finish setup.";
    overlay.classList.add("platform-auth-warning");
    unlock();
    return;
  }

  const platformApp = firebase.initializeApp(platformFirebaseConfig, "platformAuth");
  const auth = firebase.auth(platformApp);
  window.platformAuth = auth; // exposed so pages can add e.g. a sign-out button

  function showSignedOut(errorText) {
    overlay.style.display = "";
    document.body.classList.remove("platform-auth-unlocked");
    msg.textContent = errorText || "Sign in with your work account to continue.";
    form.style.display = "";
  }

  function showSignedIn() {
    overlay.style.display = "none";
    unlock();
  }

  auth.onAuthStateChanged((user) => {
    if (user) showSignedIn();
    else showSignedOut();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await auth.signInWithEmailAndPassword(emailInput.value, passwordInput.value);
    } catch (err) {
      showSignedOut("Sign-in failed: " + err.message);
    }
  });
})();
