// Ported from apps/hot-list/worker.js (Cloudflare Worker) — same prompt
// and response shape, now calling the Anthropic API via fetch, running as
// a Supabase Edge Function instead of a Cloudflare Worker.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// verify_jwt only checks that *some* valid Supabase JWT was presented,
// which includes the public anon key — it does not by itself require a
// signed-in user. This confirms the token belongs to an actual signed-in
// platform user before spending Anthropic budget on the request.
async function requireUser(req: Request): Promise<Response | null> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
  if (!token) return jsonResponse({ error: "Missing Authorization header" }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return jsonResponse({ error: "Unauthorized" }, 401);
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const unauthorized = await requireUser(req);
  if (unauthorized) return unauthorized;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const inputText = body.inputText;
  if (!inputText || typeof inputText !== "string" || !inputText.trim()) {
    return jsonResponse({ error: "inputText is required" }, 400);
  }

  const prompt = `You are a staffing recruiter writing a candidate hot list for Employbridge Staffing. Given the following candidate notes or resume text, generate EXACTLY 5 concise bullet points that sell this candidate to potential employers. Each bullet should highlight a specific skill, experience, or quality. Also extract: role title (e.g. "CNC Machinist", "Maintenance Technician"), candidate ID if mentioned, pay rate if mentioned, and shift preference if mentioned.

Respond ONLY with valid JSON, no markdown, no extra text:
{
  "title": "Role Title",
  "id": "candidate id or empty string",
  "payRate": "e.g. $30/HR or empty string",
  "shift": "e.g. 1st shift or empty string",
  "bullets": ["bullet 1", "bullet 2", "bullet 3", "bullet 4", "bullet 5"]
}

Candidate info:
${inputText}`;

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "Anthropic credentials not configured on the server." }, 500);
  }

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    return jsonResponse({ error: "Failed to reach Anthropic API" }, 502);
  }

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text();
    return jsonResponse({ error: "Anthropic API error", detail: errText }, anthropicRes.status);
  }

  const data = await anthropicRes.json();
  const text = data.content?.[0]?.text || "";
  const clean = text.replace(/```json|```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    return jsonResponse({ error: "Failed to parse Claude response", raw: text }, 502);
  }

  return jsonResponse(parsed, 200);
});
