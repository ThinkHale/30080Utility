// Firebase config for the SHARED PLATFORM LOGIN (separate from any single
// app's own data project — this project only handles "who is allowed into
// 30080Utility at all," not any app's actual staffing/candidate/labor data).
//
// To activate real sign-in:
//   1. Firebase Console (https://console.firebase.google.com/) > Add project
//      (e.g. "30080-utility-platform").
//   2. Project settings > General > Your apps > Web app > copy the config
//      object and paste the values below.
//   3. Authentication > Sign-in method > enable Email/Password.
//   4. Authentication > Users > add one account per teammate who should have
//      access (email + temporary password — have them change it after
//      first login).
//
// These values are safe to publish in client-side code once real — access
// is controlled by which accounts you create in step 4, not by hiding this
// file. Until you fill them in, every app shows an "auth not configured"
// warning banner instead of pretending to be secure.
const platformFirebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
