// Ported from apps/resume-review/generate/index.js (Azure Function) — same
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

  const { candidateName, contactInfo, workHistory, education, skills, jobDescription } = await req
    .json()
    .catch(() => ({}));

  if (!candidateName || !workHistory || workHistory.length === 0) {
    return new Response(
      JSON.stringify({ error: "candidateName and at least one workHistory entry are required" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const systemPrompt = `You are an expert resume writer specializing in creating modern, compelling resumes for job seekers. Your goal is to craft a polished, professional resume from the candidate information provided.

Your resume should:
- Open with a strong professional summary (2-3 sentences) that captures the candidate's value proposition
- Present work experience in reverse chronological order with strong action verbs and quantified accomplishments where the provided information supports it
- Use clear, consistent formatting with plain text (all-caps section headers, dash bullets)
- Naturally incorporate keywords from the job description if one is provided
- Sound authentic and specific to this individual — not generic

Format rules:
- Use ALL CAPS for section headers (e.g., PROFESSIONAL SUMMARY, WORK EXPERIENCE)
- Use dashes (- ) for bullet points
- Keep contact info on separate lines at the top
- Do not invent facts — only use what is provided
- Only include sections for data that was actually provided — if education or skills are not provided, omit those sections entirely. Do not add placeholder text or prompts to fill them in.

Respond ONLY with a valid JSON object in this exact format (no markdown, no extra text):
{
  "generatedResume": "The full text of the generated resume in plain text format",
  "summary": "One sentence describing what kind of professional this resume presents"
}`;

  const contactBlock = contactInfo
    ? [contactInfo.email, contactInfo.phone, contactInfo.location, contactInfo.linkedin].filter(Boolean).join(" | ")
    : "";

  const workBlock = workHistory
    .map(
      (w: Record<string, string>) =>
        `${w.title || ""}${w.company ? " at " + w.company : ""}${
          w.startDate || w.endDate ? " (" + [w.startDate, w.endDate].filter(Boolean).join(" - ") + ")" : ""
        }\n${w.responsibilities || ""}`,
    )
    .join("\n\n");

  const userPrompt = `Please generate a professional resume for the following candidate.

CANDIDATE NAME: ${candidateName}
${contactBlock ? `CONTACT: ${contactBlock}` : ""}

WORK EXPERIENCE:
${workBlock}

${education ? `EDUCATION:\n${education}` : ""}
${skills ? `SKILLS:\n${skills}` : ""}
${jobDescription ? `\nTARGET JOB DESCRIPTION (tailor the resume to this role):\n${jobDescription}` : ""}

Generate a complete, polished, modern resume for this candidate.`;

  try {
    const response = await callAzureOpenAI(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      3000,
      0.4,
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
