// Ported from apps/resume-review/interview/index.js (Azure Function) — same
// mode dispatch (generateQuestions / generateFollowUps / wrapUp), same
// prompts and response shapes, now calling Azure OpenAI via fetch instead
// of node:https, running as a Supabase Edge Function.
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
// platform user before spending Azure OpenAI budget on the request.
async function requireUser(req: Request): Promise<Response | null> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
  if (!token) return jsonResponse({ error: "Missing Authorization header" }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return jsonResponse({ error: "Unauthorized" }, 401);
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
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const unauthorized = await requireUser(req);
  if (unauthorized) return unauthorized;

  const body = await req.json().catch(() => ({}));
  const { mode } = body;

  try {
    if (mode === "generateQuestions") {
      const { resumeText, jobDescription } = body;
      if (!resumeText || !jobDescription) {
        return jsonResponse({ error: "resumeText and jobDescription are required" }, 400);
      }

      const systemPrompt = `You are an expert talent acquisition specialist and structured interviewer.
Your job is to generate a set of focused, role-specific interview questions for a recruiter conducting a screening interview.

The questions must be grounded in the candidate's actual resume and the specific job description provided. Do not generate generic questions.

Return ONLY a valid JSON object (no markdown, no extra text):
{
  "categories": [
    {
      "category": "Work History",
      "description": "Drilling into specific roles, responsibilities, and transitions",
      "questions": [
        { "id": "wh1", "question": "..." },
        { "id": "wh2", "question": "..." }
      ]
    },
    {
      "category": "Skills Correlation",
      "description": "Matching job description requirements to resume claims",
      "questions": [...]
    },
    {
      "category": "Employment Gaps",
      "description": "Addressing any detected gaps in employment history",
      "questions": [...]
    },
    {
      "category": "General Fit / Motivation",
      "description": "Understanding candidate interest and cultural alignment",
      "questions": [...]
    },
    {
      "category": "Behavioral / Situational",
      "description": "STAR-format questions tied to key role competencies",
      "questions": [...]
    }
  ]
}

Rules:
- Work History: 3-5 questions drilling into the most relevant or recent roles. Reference specific companies, titles, or dates from the resume.
- Skills Correlation: 2-4 questions for each major requirement in the JD that appears in the resume — probe depth of experience. If a required skill is absent from the resume, include a gap question.
- Employment Gaps: Only include this category if there is a detectable gap of 3+ months between roles. If no gaps, return an empty questions array for this category.
- General Fit / Motivation: 2-3 questions about why this role, this company type, career goals.
- Behavioral / Situational: 3-4 STAR-format questions tied to the 3 most important competencies in the job description.
- Each question must be specific, not generic. Reference actual details from the resume or JD.
- Total questions: 12-20 across all categories.`;

      const userPrompt = `JOB DESCRIPTION:
${jobDescription}

CANDIDATE RESUME:
${resumeText}

Generate structured interview questions for this candidate against this role.`;

      const response = await callAzureOpenAI(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        2500,
        0.4,
      );

      if (response.status === 429) {
        return jsonResponse({ error: "Azure OpenAI rate limit exceeded. Please wait a moment and try again." }, 429);
      }
      const bodyText = await response.text();
      if (response.status !== 200) {
        return jsonResponse({ error: "Azure OpenAI error: " + bodyText }, 500);
      }

      const parsed = JSON.parse(bodyText);
      const raw = parsed.choices?.[0]?.message?.content || "";

      let result;
      try {
        result = JSON.parse(raw);
      } catch {
        return jsonResponse({ error: "AI returned unexpected format", raw }, 500);
      }
      if (!Array.isArray(result.categories)) {
        return jsonResponse({ error: "AI response missing categories array", raw }, 500);
      }

      return jsonResponse(result, 200);
    } else if (mode === "generateFollowUps") {
      const { originalQuestion, recruiterNotes, resumeText, jobDescription } = body;
      if (!originalQuestion || !recruiterNotes) {
        return jsonResponse({ error: "originalQuestion and recruiterNotes are required" }, 400);
      }

      const systemPrompt = `You are an expert interviewer helping a recruiter generate targeted follow-up questions based on a candidate's response during a screening interview.

The recruiter has taken notes on what the candidate said. Your job is to generate 2-4 specific follow-up questions that:
- Probe deeper into what the candidate revealed in their notes
- Clarify any vague, incomplete, or contradictory statements
- Surface quantifiable evidence if the notes mention accomplishments without metrics
- Expose potential weaknesses or gaps suggested by the response
- Build on positive signals to confirm depth of experience

Return ONLY a valid JSON array of strings (no markdown, no extra text):
["Follow-up question 1", "Follow-up question 2", "Follow-up question 3"]

Rules:
- Questions must be directly derived from the recruiter's notes — do not ask about things the candidate didn't mention.
- If the notes suggest a strong answer, still generate probing follow-ups to verify depth.
- If the notes suggest a weak or vague answer, generate clarifying and challenge questions.
- 2-4 questions total. Quality over quantity.`;

      const userPrompt = `ORIGINAL INTERVIEW QUESTION:
${originalQuestion}

RECRUITER'S NOTES ON CANDIDATE'S RESPONSE:
${recruiterNotes}
${resumeText ? `\nCANDIDATE RESUME (for context):\n${resumeText.substring(0, 1500)}` : ""}
${jobDescription ? `\nJOB DESCRIPTION (for context):\n${jobDescription.substring(0, 800)}` : ""}

Generate targeted follow-up questions based on what the candidate said.`;

      const response = await callAzureOpenAI(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        600,
        0.5,
      );

      if (response.status === 429) {
        return jsonResponse({ error: "Azure OpenAI rate limit exceeded. Please wait a moment and try again." }, 429);
      }
      const bodyText = await response.text();
      if (response.status !== 200) {
        return jsonResponse({ error: "Azure OpenAI error: " + bodyText }, 500);
      }

      const parsed = JSON.parse(bodyText);
      const raw = parsed.choices?.[0]?.message?.content || "";

      let followUps;
      try {
        followUps = JSON.parse(raw);
        if (!Array.isArray(followUps)) throw new Error("not an array");
      } catch {
        return jsonResponse({ error: "AI returned unexpected format", raw }, 500);
      }

      return jsonResponse({ followUps }, 200);
    } else if (mode === "wrapUp") {
      const { questionsAndNotes, resumeText, jobDescription } = body;
      if (!Array.isArray(questionsAndNotes) || questionsAndNotes.length === 0) {
        return jsonResponse({ error: "questionsAndNotes must be a non-empty array" }, 400);
      }

      const systemPrompt = `You are a senior talent acquisition specialist. A recruiter has just completed a structured screening interview. You are given all interview questions, organized by category, along with the recruiter's notes for each question.

Your job is to synthesize everything into a professional candidate fit summary.

Return ONLY a valid JSON object (no markdown, no extra text):
{
  "fitAssessment": "2-3 sentence overall assessment of this candidate's fit for the role",
  "keyStrengths": ["strength 1", "strength 2", "strength 3"],
  "keyRisks": ["risk or gap 1", "risk or gap 2"],
  "hiringRecommendation": "ADVANCE",
  "recommendationRationale": "1-2 sentences explaining the recommendation",
  "overallNotes": "Free-form paragraph of detailed recruiter synthesis"
}

Rules:
- Base ALL conclusions on the recruiter's actual notes. Do not invent information.
- If notes are sparse or missing for some questions, acknowledge this in overallNotes.
- hiringRecommendation must be exactly one of: ADVANCE, HOLD, or DECLINE
- keyStrengths: 2-4 items. Only things supported by the notes.
- keyRisks: 1-3 items. Gaps, vague answers, missing evidence, or concerning patterns from the notes.
- Be direct and professional. This is an internal recruiter document, not for the candidate.`;

      const transcript = questionsAndNotes
        .map(
          (item: Record<string, string>, i: number) =>
            `[${item.category}]\nQ${i + 1}: ${item.question}\nNotes: ${item.notes || "(no notes recorded)"}`,
        )
        .join("\n\n");

      const userPrompt = `INTERVIEW TRANSCRIPT:
${transcript}
${resumeText ? `\nCANDIDATE RESUME:\n${resumeText.substring(0, 1500)}` : ""}
${jobDescription ? `\nJOB DESCRIPTION:\n${jobDescription.substring(0, 800)}` : ""}

Generate a candidate fit summary based on this interview.`;

      const response = await callAzureOpenAI(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        1200,
        0.3,
      );

      if (response.status === 429) {
        return jsonResponse({ error: "Azure OpenAI rate limit exceeded. Please wait a moment and try again." }, 429);
      }
      const bodyText = await response.text();
      if (response.status !== 200) {
        return jsonResponse({ error: "Azure OpenAI error: " + bodyText }, 500);
      }

      const parsed = JSON.parse(bodyText);
      const raw = parsed.choices?.[0]?.message?.content || "";

      let result;
      try {
        result = JSON.parse(raw);
      } catch {
        return jsonResponse({ error: "AI returned unexpected format", raw }, 500);
      }

      return jsonResponse(result, 200);
    } else {
      return jsonResponse({ error: "Invalid mode. Expected: generateQuestions, generateFollowUps, or wrapUp" }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: "Internal error: " + (err as Error).message }, 500);
  }
});
