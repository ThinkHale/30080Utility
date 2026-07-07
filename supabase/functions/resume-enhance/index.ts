// Ported from apps/resume-review/enhance/index.js (Azure Function) — same
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

  const { jobDescription, positionNotes, resumeText, candidateName, interviewNotes } = await req
    .json()
    .catch(() => ({}));

  if (!jobDescription || !resumeText) {
    return new Response(JSON.stringify({ error: "jobDescription and resumeText are required" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const systemPrompt = `You are an expert resume writer and talent acquisition specialist. Your job is to enhance a candidate's resume to better showcase their fit for a specific role — without fabricating experience, skills, or qualifications they do not have.

Your enhancements should:
- Expand brief or vague bullet points using context from the candidate's actual experience and any interview notes provided
- Strengthen language with strong action verbs and, where plausible from the provided context, quantify accomplishments
- Reorder or reframe content to lead with the most relevant experience for this specific role
- Naturally incorporate keywords and requirements from the job description where the candidate genuinely qualifies
- Use the interview notes to surface accomplishments or context the original resume underrepresents
- Improve the overall presentation, structure, and readability

You must NOT:
- Add experience, roles, skills, certifications, or qualifications the candidate does not have
- Invent numbers or metrics that are not grounded in the provided information
- Change job titles, company names, or dates
- Remove legitimate experience even if not directly relevant

Respond ONLY with a valid JSON object in this exact format (no markdown, no extra text):
{
  "enhancedResume": "The full text of the enhanced resume, formatted cleanly with clear section headers and bullet points using plain text (use dashes for bullets, all-caps for section headers)",
  "summary": "One sentence describing the overall enhancement approach taken",
  "changes": ["Specific change 1", "Specific change 2", "Specific change 3"],
  "keyAlignments": ["How the resume now maps to key requirement 1", "How the resume now maps to key requirement 2"]
}`;

  const userPrompt = `JOB DESCRIPTION:
${jobDescription}

${positionNotes ? `POSITION NOTES / CLIENT CONTEXT:\n${positionNotes}\n\n` : ""}${
    interviewNotes
      ? `INTERVIEW NOTES (what was learned about this candidate in the interview — use this context to expand and strengthen the resume):\n${interviewNotes}\n\n`
      : ""
  }CANDIDATE NAME: ${candidateName || "Unknown"}

ORIGINAL RESUME:
${resumeText}

Enhance this resume to better showcase the candidate's genuine fit for the role described above. Preserve all factual details while making their qualifications as compelling and relevant as possible.`;

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
