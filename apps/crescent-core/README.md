# Crescent Core

Hours tracker with CSV/Excel import, one snapshot per week. Part of the
30080 Utility platform — see the root [README.md](../../README.md) for the
shared Supabase setup (login) this app depends on.

Weekly hours data lives in the shared Supabase project's `hours_weeks`
table (one row per week, keyed by week-ending date), replacing the app's
old standalone Firebase Realtime Database project.
