/**
 * Cloudflare Worker – Anthropic API proxy for Employbridge Hot List Generator
 *
 * Deploy steps:
 *   1. npm install -g wrangler
 *   2. wrangler login
 *   3. wrangler secret put ANTHROPIC_API_KEY   (paste your key when prompted)
 *   4. wrangler deploy
 *
 * The worker URL printed after deploy goes into index.html as WORKER_URL.
 */

const ALLOWED_ORIGIN = "*"; // Restrict to your GitHub Pages domain in production,
                             // e.g. "https://your-org.github.io"

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders(ALLOWED_ORIGIN),
      });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const { inputText } = body;
    if (!inputText || typeof inputText !== "string" || !inputText.trim()) {
      return json({ error: "inputText is required" }, 400);
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

    let anthropicRes;
    try {
      anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
    } catch (err) {
      return json({ error: "Failed to reach Anthropic API" }, 502);
    }

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return json({ error: "Anthropic API error", detail: errText }, anthropicRes.status);
    }

    const data = await anthropicRes.json();
    const text = data.content?.[0]?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return json({ error: "Failed to parse Claude response", raw: text }, 502);
    }

    return json(parsed, 200);
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(ALLOWED_ORIGIN),
    },
  });
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
