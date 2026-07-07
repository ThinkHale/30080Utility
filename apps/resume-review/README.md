# Resume Review Tool

AI-powered resume screening tool built on Azure OpenAI. Part of the 30080
Utility platform — see the root [README.md](../../README.md) for the shared
Supabase setup (login, secrets) that this app depends on.

## Architecture

```
Your Team (browser, signed in via the shared platform login)
      │
      ▼
Supabase Edge Functions (resume-analyze, resume-enhance, resume-generate,
resume-email, resume-interview — see supabase/functions/)
      │  requires the caller's own Supabase session token
      ▼
Azure OpenAI (GPT-4o)
```

Saved job descriptions and analysis/enhance/generate/interview history are
stored in the shared Supabase project's `resume_review_records` table
(replacing the old Azure Table Storage account) — any signed-in platform
user can read/write it.

## Using the Tool

### Single Resume Mode
1. Paste the job description in the **Job Description** field
2. Optionally add context in **Position Notes** (client preferences, deal-breakers, etc.)
3. Upload one resume file (`.txt` works best; `.pdf` and `.doc` will attempt text extraction)
4. Click **Analyze**

### Batch Mode
1. Toggle to **Batch** in the Resumes section
2. Upload multiple resume files at once
3. Click **Analyze** — each resume is analyzed individually and sequentially
4. A progress bar shows status as each file completes

### Results
- Each candidate is assigned **Viable**, **Review**, or **Reject**
- A **Fit Score** (0-100) and **Confidence** level are provided
- Click any result card to expand it and see Strengths, Concerns, Follow-up Items, and full AI reasoning
- Use the filter buttons to view only Viable, Review, or Reject candidates

## Resume File Tips

For best accuracy, upload resumes as plain `.txt` files. To convert:
- **PDF**: Open in Adobe Reader or browser, select all text, paste into Notepad/TextEdit, save as .txt
- **Word**: File > Save As > Plain Text (.txt)

The tool will attempt to read PDF/DOC files directly, but text extraction quality varies.

## Costs

Azure OpenAI (GPT-4o) is charged per token. A typical resume analysis uses
roughly 1,500-2,500 tokens total — fractions of a cent per resume. For a
team doing 50-100 resumes/week, expect costs under $5/month. Supabase Edge
Functions and GitHub Pages are free at this scale.

## Security Notes

- Every request to the Edge Functions must carry the caller's own signed-in
  Supabase session token — there's no shared function key to distribute or
  leak.
- `AZURE_OPENAI_ENDPOINT` / `AZURE_OPENAI_KEY` / `AZURE_OPENAI_DEPLOYMENT`
  are set as Supabase Edge Function secrets, never in frontend code.
