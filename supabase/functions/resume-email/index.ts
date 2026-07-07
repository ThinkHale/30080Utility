// Ported from apps/resume-review/email/index.js (Azure Function) — same
// system/user prompts and response shape, now calling Azure OpenAI via
// fetch instead of node:https, running as a Supabase Edge Function.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// verify_jwt only checks that *some* valid Supabase JWT was presented,
// which includes the public anon key — it does not by itself require a
// signed-in user. This confirms the token belongs to an actual signed-in
// platform user before spending Azure OpenAI budget on the request.
async function requireUser(req: Request): Promise<Response | null> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
      status: 401,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
  return null;
}

async function callAzureOpenAI(messages: unknown, maxTokens: number, temperature: number) {
  const endpoint = Deno.env.get("AZURE_OPENAI_ENDPOINT");
  const apiKey = Deno.env.get("AZURE_OPENAI_KEY");
  const deployment = Deno.env.get("AZURE_OPENAI_DEPLOYMENT") || "gpt-4o";
  if (!endpoint || !apiKey) {
    throw new Error("Azure OpenAI credentials not configured on the server.");
  }
  const url = `${endpoint}openai/deployments/${deployment}/chat/completions?api-version=2024-08-01-preview`;

  let res: Response | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify({ messages, max_tokens: maxTokens, temperature }),
    });
    if (res.status === 429 && attempt < 3) {
      await new Promise((r) => setTimeout(r, attempt * 2000));
      continue;
    }
    break;
  }
  return res!;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const unauthorized = await requireUser(req);
  if (unauthorized) return unauthorized;

  const { candidateName, role, resumeText, analysisContext } = await req.json().catch(() => ({}));

  if (!candidateName) {
    return new Response(JSON.stringify({ error: "candidateName is required" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const systemPrompt = `You are a professional staffing recruiter writing an email to present a candidate to a hiring manager or client. Your emails are warm, concise, and professional — you lead with the candidate's strongest qualities and why they are a fit for the role.

Your email should:
- Have a clear, specific subject line referencing the candidate name and role
- Open with a brief, enthusiastic introduction of the candidate
- Highlight 2-4 specific strengths or standout qualifications drawn from the resume and analysis context
- Note why this candidate is a strong match for the role
- Close with a clear call to action (schedule a call, review the attached resume, etc.)
- Be written in first person from the recruiter's perspective
- Be 150-250 words in the body — professional but not overly formal

Respond ONLY with a valid JSON object in this exact format (no markdown, no extra text):
{
  "subject": "Email subject line",
  "body": "Full email body text, using \\n for line breaks"
}`;

  const userPrompt = `Generate a candidate presentation email with the following context:

CANDIDATE NAME: ${candidateName}
${role ? `ROLE / JOB DESCRIPTION SNIPPET:\n${role}` : ""}
${analysisContext ? `\nCANDIDATE CONTEXT / ANALYSIS:\n${analysisContext}` : ""}
${resumeText ? `\nRESUME EXCERPT (first 1500 chars):\n${resumeText.substring(0, 1500)}` : ""}

Write a professional recruiter email presenting this candidate.`;

  try {
    const response = await callAzureOpenAI(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      800,
      0.5,
    );

    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: "Azure OpenAI rate limit exceeded. Please wait a moment and try again." }),
        { status: 429, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }
    const bodyText = await response.text();
    if (response.status !== 200) {
      return new Response(JSON.stringify({ error: "Azure OpenAI error: " + bodyText }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(bodyText);
    const raw = parsed.choices?.[0]?.message?.content || "";

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      return new Response(JSON.stringify({ error: "AI returned unexpected format", raw }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to contact Azure OpenAI: " + (err as Error).message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
