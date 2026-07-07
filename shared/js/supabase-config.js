// Shared Supabase project for the whole 30080 Utility platform — one login,
// one backend, for every app. This anon key is safe to publish in
// client-side code: access is controlled by the RLS policies on each table
// (see supabase/functions and the migration in the project), not by
// hiding this value.
const PLATFORM_SUPABASE_URL = "https://oavksqgwjqlbnyairljn.supabase.co";
const PLATFORM_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hdmtzcWd3anFsYm55YWlybGpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NDMwNzksImV4cCI6MjA5OTAxOTA3OX0.ku5qwEmISqCEJFTx9U10q-84Ip6YaOmc7jVu9BXxur8";
