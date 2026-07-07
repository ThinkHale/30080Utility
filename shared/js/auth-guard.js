// Shared login gate for every page in the 30080 Utility platform. Expects
// the page to have already loaded the Supabase JS SDK
// (@supabase/supabase-js@2 via CDN) and this file's supabase-config.js
// before this script, and to contain the overlay markup this file looks
// for (#platformAuthOverlay etc. — see any apps/*/index.html for the block
// to copy).
//
// Blocks the rest of the page (via the .platform-auth-unlocked class on
// <body>, see auth-overlay.css) until a Supabase user is signed in. If the
// shared project hasn't been configured yet (supabase-config.js still has
// placeholder values), it unlocks the page but leaves a visible warning
// instead of silently pretending the app is protected.
//
// Exposes:
//   window.platformSupabase — the Supabase client, for each app's own
//     data-access code to reuse instead of creating its own.
//   window.platformAuth — { client, signOut() }
//   window.platformAuthReady — a Promise that resolves once the *initial*
//     signed-in/signed-out state is known. App init code that queries
//     Supabase on page load (e.g. loading saved records) should
//     `await window.platformAuthReady` first — otherwise it can run before
//     any session exists and RLS will silently return zero rows. If the
//     auth state later *changes* (user signs in or out after the page
//     already loaded), the page reloads so all app init code re-runs with
//     the new session rather than being left stale.
(function () {
  const overlay = document.getElementById("platformAuthOverlay");
  const msg = document.getElementById("platformAuthMsg");
  const form = document.getElementById("platformAuthForm");
  const emailInput = document.getElementById("platformAuthEmail");
  const passwordInput = document.getElementById("platformAuthPassword");
  if (!overlay) return;

  const configured =
    typeof PLATFORM_SUPABASE_URL !== "undefined" &&
    !!PLATFORM_SUPABASE_URL &&
    !PLATFORM_SUPABASE_URL.startsWith("YOUR_");

  function unlock() {
    document.body.classList.add("platform-auth-unlocked");
  }

  if (!configured) {
    msg.textContent =
      "Platform sign-in isn't configured yet, so this app is currently unprotected. See README.md for setup.";
    overlay.classList.add("platform-auth-warning");
    unlock();
    window.platformAuthReady = Promise.resolve(null);
    return;
  }

  const client = supabase.createClient(PLATFORM_SUPABASE_URL, PLATFORM_SUPABASE_ANON_KEY);
  window.platformSupabase = client;
  window.platformAuth = {
    client,
    signOut: () => client.auth.signOut(),
  };

  let resolveReady;
  window.platformAuthReady = new Promise((resolve) => {
    resolveReady = resolve;
  });

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

  let initialCheckDone = false;
  client.auth.onAuthStateChange((_event, session) => {
    if (!initialCheckDone) return; // getSession() below handles the first state
    // Auth state changed after the page already rendered (sign in/out) —
    // reload so every app's own init code picks up the new session.
    location.reload();
  });

  client.auth.getSession().then(({ data }) => {
    if (data.session) showSignedIn();
    else showSignedOut();
    initialCheckDone = true;
    resolveReady(data.session || null);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await client.auth.signInWithPassword({
      email: emailInput.value,
      password: passwordInput.value,
    });
    if (error) showSignedOut("Sign-in failed: " + error.message);
  });
})();
