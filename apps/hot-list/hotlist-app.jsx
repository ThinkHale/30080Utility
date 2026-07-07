import { useState, useEffect, useRef } from "react";

// ── Employbridge brand colors ──────────────────────────────────────────
const EB = {
  purple: "#4B2E83",
  purpleLight: "#6B46C1",
  purpleDark: "#3B2068",
  accent: "#8B5CF6",
  gray50: "#F9F8FF",
  gray100: "#F0EEF8",
  gray200: "#DDD9EE",
  gray400: "#9B93C0",
  gray600: "#5B5480",
  gray800: "#2D2850",
  white: "#FFFFFF",
};

// ── Default data ───────────────────────────────────────────────────────
const DEFAULT_LOCATIONS = [
  { id: "wichita", label: "Wichita" },
  { id: "kansas-city", label: "Kansas City" },
  { id: "omaha", label: "Omaha" },
  { id: "iowa", label: "Iowa" },
  { id: "peoria", label: "Peoria" },
  { id: "st-louis", label: "St. Louis" },
];

const DEFAULT_INDUSTRIES = [{ id: "general", label: "General" }];

// ── Storage helpers ────────────────────────────────────────────────────
const load = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));

// ── Claude API call ────────────────────────────────────────────────────
async function generateBullets(inputText) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `You are a staffing recruiter writing a candidate hot list for Employbridge Staffing. Given the following candidate notes or resume text, generate EXACTLY 5 concise bullet points that sell this candidate to potential employers. Each bullet should highlight a specific skill, experience, or quality. Also extract: role title (e.g. "CNC Machinist", "Maintenance Technician"), candidate ID if mentioned, pay rate if mentioned, and shift preference if mentioned.

Respond ONLY with valid JSON, no markdown, no extra text:
{
  "title": "Role Title",
  "id": "candidate id or empty string",
  "payRate": "e.g. $30/HR or empty string",
  "shift": "e.g. 1st shift or empty string",
  "bullets": ["bullet 1", "bullet 2", "bullet 3", "bullet 4", "bullet 5"]
}

Candidate info:
${inputText}`,
        },
      ],
    }),
  });
  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

// ── Components ─────────────────────────────────────────────────────────

function Logo({ size = 28 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <img
        src="employbridge_logo.png"
        alt="Employbridge"
        style={{ height: size * 1.5, width: "auto" }}
      />
    </div>
  );
}

function NavTab({ label, active, onClick, icon }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? EB.white : "transparent",
        border: "none",
        borderRadius: "8px 8px 0 0",
        padding: "10px 20px",
        cursor: "pointer",
        fontFamily: "'Trebuchet MS', sans-serif",
        fontWeight: active ? 700 : 400,
        fontSize: 14,
        color: active ? EB.purple : "rgba(255,255,255,0.8)",
        display: "flex",
        alignItems: "center",
        gap: 6,
        transition: "all 0.15s",
      }}
    >
      <span>{icon}</span> {label}
    </button>
  );
}

function Select({ value, onChange, options, style }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: EB.white,
        border: `2px solid ${EB.gray200}`,
        borderRadius: 8,
        padding: "8px 12px",
        fontFamily: "'Trebuchet MS', sans-serif",
        fontSize: 14,
        color: EB.gray800,
        cursor: "pointer",
        outline: "none",
        ...style,
      }}
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Btn({ children, onClick, variant = "primary", disabled, style }) {
  const base = {
    border: "none",
    borderRadius: 8,
    padding: "9px 18px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "'Trebuchet MS', sans-serif",
    fontWeight: 700,
    fontSize: 13,
    transition: "all 0.15s",
    opacity: disabled ? 0.5 : 1,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    ...style,
  };
  const variants = {
    primary: { background: EB.purple, color: EB.white },
    secondary: { background: EB.gray100, color: EB.purple },
    danger: { background: "#FEE2E2", color: "#DC2626" },
    success: { background: "#D1FAE5", color: "#065F46" },
    accent: { background: EB.accent, color: EB.white },
  };
  return (
    <button onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant] }}>
      {children}
    </button>
  );
}

// ── ADD CANDIDATE PAGE ─────────────────────────────────────────────────
function AddCandidatePage({ locations, industries, candidates, setCandidates }) {
  const [location, setLocation] = useState(locations[0]?.id || "");
  const [industry, setIndustry] = useState(industries[0]?.id || "general");
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);
  const [batch, setBatch] = useState(null); // { total, current, results: [{name, success, title?}] }
  const fileRef = useRef();

  const loadMammoth = () => {
    if (window.mammoth) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://unpkg.com/mammoth@1/mammoth.browser.min.js";
      s.onload = resolve;
      s.onerror = () => reject(new Error("Failed to load mammoth.js"));
      document.head.appendChild(s);
    });
  };

  const loadPdfJs = () => {
    if (window.pdfjsLib) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.onload = resolve;
      s.onerror = () => reject(new Error("Failed to load pdf.js"));
      document.head.appendChild(s);
    });
  };

  const extractText = async (file) => {
    if (file.name.toLowerCase().endsWith(".docx")) {
      await loadMammoth();
      const arrayBuffer = await file.arrayBuffer();
      const result = await window.mammoth.extractRawText({ arrayBuffer });
      return result.value;
    }
    if (file.name.toLowerCase().endsWith(".pdf")) {
      await loadPdfJs();
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        pages.push(content.items.map((item) => item.str).join(" "));
      }
      return pages.join("\n");
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleFile = async (e) => {
    const files = Array.from(e.target.files);
    e.target.value = "";
    if (!files.length) return;

    if (files.length === 1) {
      try {
        const text = await extractText(files[0]);
        setInputText(text);
      } catch {
        setError("Could not read file. Please try a different file.");
      }
      return;
    }

    // Batch mode: auto-generate and add all candidates
    setBatch({ total: files.length, current: 0, results: [] });
    setError("");
    setPreview(null);
    for (let i = 0; i < files.length; i++) {
      setBatch((b) => ({ ...b, current: i + 1 }));
      try {
        const text = await extractText(files[i]);
        const result = await generateBullets(text);
        const candidate = {
          id: Date.now().toString(),
          candidateId: result.id || "",
          title: result.title,
          payRate: result.payRate || "",
          shift: result.shift || "",
          bullets: result.bullets,
          location,
          industry,
          addedAt: new Date().toISOString(),
        };
        setCandidates((prev) => {
          const updated = [...prev, candidate];
          save("eb_candidates", updated);
          return updated;
        });
        setBatch((b) => ({ ...b, results: [...b.results, { name: files[i].name, success: true, title: result.title }] }));
      } catch {
        setBatch((b) => ({ ...b, results: [...b.results, { name: files[i].name, success: false }] }));
      }
    }
  };

  const handleGenerate = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setError("");
    setPreview(null);
    setAdded(false);
    try {
      const result = await generateBullets(inputText);
      setPreview(result);
    } catch (e) {
      setError("Could not parse candidate. Please check your input and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToList = () => {
    const candidate = {
      id: Date.now().toString(),
      candidateId: preview.id || "",
      title: preview.title,
      payRate: preview.payRate || "",
      shift: preview.shift || "",
      bullets: preview.bullets,
      location,
      industry,
      addedAt: new Date().toISOString(),
    };
    setCandidates((prev) => {
      const updated = [...prev, candidate];
      save("eb_candidates", updated);
      return updated;
    });
    setPreview(null);
    setInputText("");
    setAdded(true);
    setTimeout(() => setAdded(false), 3000);
  };

  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <h2 style={{ fontFamily: "'Trebuchet MS', sans-serif", color: EB.purple, marginBottom: 4 }}>
        Add Candidate
      </h2>
      <p style={{ color: EB.gray600, marginBottom: 24, fontSize: 14 }}>
        Paste resume text or notes below. Claude will generate 5 selling points for the hot list.
      </p>

      {/* Location + Industry */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: EB.gray600, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
            Market / Location
          </label>
          <Select value={location} onChange={setLocation} options={locations} style={{ minWidth: 180 }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: EB.gray600, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
            Industry
          </label>
          <Select value={industry} onChange={setIndustry} options={industries} style={{ minWidth: 150 }} />
        </div>
      </div>

      {/* Text input */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: EB.gray600, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
          Candidate Notes or Resume Text
        </label>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste resume text, recruiter notes, or any candidate information here..."
          rows={10}
          style={{
            width: "100%",
            borderRadius: 10,
            border: `2px solid ${EB.gray200}`,
            padding: 14,
            fontFamily: "'Trebuchet MS', sans-serif",
            fontSize: 14,
            color: EB.gray800,
            resize: "vertical",
            outline: "none",
            boxSizing: "border-box",
            background: EB.white,
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        <Btn onClick={() => fileRef.current.click()} variant="secondary">
          📎 Upload Resume(s)
        </Btn>
        <input ref={fileRef} type="file" accept=".txt,.doc,.docx,.pdf" multiple style={{ display: "none" }} onChange={handleFile} />
        <Btn onClick={handleGenerate} disabled={!inputText.trim() || loading} variant="primary">
          {loading ? "⏳ Generating..." : "✨ Generate Bullets"}
        </Btn>
      </div>

      {batch && (
        <div style={{ background: EB.gray100, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          {batch.current < batch.total ? (
            <div style={{ color: EB.purple, fontWeight: 700, fontSize: 14 }}>
              ⏳ Processing {batch.current} of {batch.total} resumes...
            </div>
          ) : (
            <>
              <div style={{ color: EB.gray800, fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
                Batch complete: {batch.results.filter((r) => r.success).length} of {batch.total} added to hot list
              </div>
              {batch.results.map((r, i) => (
                <div key={i} style={{ fontSize: 13, color: r.success ? "#065F46" : "#DC2626", marginBottom: 4 }}>
                  {r.success ? "✅" : "❌"} {r.name}{r.title ? ` → ${r.title}` : ""}
                </div>
              ))}
              <div style={{ marginTop: 8 }}>
                <Btn onClick={() => setBatch(null)} variant="secondary">Dismiss</Btn>
              </div>
            </>
          )}
        </div>
      )}

      {error && (
        <div style={{ background: "#FEE2E2", color: "#DC2626", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}

      {added && (
        <div style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 14, fontWeight: 700 }}>
          ✅ Candidate added to the {locations.find((l) => l.id === location)?.label} hot list!
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div
          style={{
            background: EB.white,
            border: `2px solid ${EB.purple}`,
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
            boxShadow: "0 4px 20px rgba(75,46,131,0.08)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div>
              <h3 style={{ margin: 0, fontFamily: "'Trebuchet MS', sans-serif", color: EB.purple, fontSize: 18 }}>
                {preview.title}
                {preview.id && (
                  <span style={{ fontWeight: 400, color: EB.gray400, fontSize: 14, marginLeft: 8 }}>
                    #{preview.id}
                  </span>
                )}
              </h3>
              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                {preview.payRate && (
                  <span style={{ fontSize: 13, color: EB.gray600 }}>💰 {preview.payRate}</span>
                )}
                {preview.shift && (
                  <span style={{ fontSize: 13, color: EB.gray600 }}>🕐 {preview.shift}</span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={() => setPreview(null)} variant="secondary">
                ✕ Discard
              </Btn>
              <Btn onClick={handleAddToList} variant="accent">
                ✓ Add to Hot List
              </Btn>
            </div>
          </div>

          {/* Editable bullets */}
          <div>
            {preview.bullets.map((b, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                <span style={{ color: EB.purple, marginTop: 2, flexShrink: 0 }}>•</span>
                <textarea
                  value={b}
                  onChange={(e) => {
                    const updated = [...preview.bullets];
                    updated[i] = e.target.value;
                    setPreview({ ...preview, bullets: updated });
                  }}
                  rows={2}
                  style={{
                    flex: 1,
                    border: `1px solid ${EB.gray200}`,
                    borderRadius: 6,
                    padding: "6px 10px",
                    fontSize: 14,
                    fontFamily: "'Trebuchet MS', sans-serif",
                    color: EB.gray800,
                    resize: "vertical",
                    outline: "none",
                  }}
                />
                <button onClick={() => setPreview({ ...preview, bullets: preview.bullets.filter((_, idx) => idx !== i) })} title="Remove bullet" style={{ background: "none", border: "none", cursor: "pointer", color: EB.gray400, fontSize: 16, padding: "6px 2px", flexShrink: 0, lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>

          {/* Editable fields */}
          <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
            <div>
              <label style={{ fontSize: 11, color: EB.gray600, display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: 1 }}>Role Title</label>
              <input value={preview.title} onChange={(e) => setPreview({ ...preview, title: e.target.value })} style={{ border: `1px solid ${EB.gray200}`, borderRadius: 6, padding: "5px 10px", fontSize: 13, fontFamily: "'Trebuchet MS', sans-serif", outline: "none" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: EB.gray600, display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: 1 }}>Candidate ID</label>
              <input value={preview.id} onChange={(e) => setPreview({ ...preview, id: e.target.value })} style={{ border: `1px solid ${EB.gray200}`, borderRadius: 6, padding: "5px 10px", fontSize: 13, fontFamily: "'Trebuchet MS', sans-serif", outline: "none", width: 120 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: EB.gray600, display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: 1 }}>Pay Rate</label>
              <input value={preview.payRate} onChange={(e) => setPreview({ ...preview, payRate: e.target.value })} style={{ border: `1px solid ${EB.gray200}`, borderRadius: 6, padding: "5px 10px", fontSize: 13, fontFamily: "'Trebuchet MS', sans-serif", outline: "none", width: 100 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: EB.gray600, display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: 1 }}>Shift</label>
              <input value={preview.shift} onChange={(e) => setPreview({ ...preview, shift: e.target.value })} style={{ border: `1px solid ${EB.gray200}`, borderRadius: 6, padding: "5px 10px", fontSize: 13, fontFamily: "'Trebuchet MS', sans-serif", outline: "none", width: 120 }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── EDITOR PAGE ────────────────────────────────────────────────────────
function EditorPage({ locations, industries, candidates, setCandidates }) {
  const [filterLoc, setFilterLoc] = useState("all");
  const [filterInd, setFilterInd] = useState("all");
  const [editing, setEditing] = useState(null);

  const filtered = candidates.filter((c) => {
    if (filterLoc !== "all" && c.location !== filterLoc) return false;
    if (filterInd !== "all" && c.industry !== filterInd) return false;
    return true;
  });

  const remove = (id) => {
    const updated = candidates.filter((c) => c.id !== id);
    setCandidates(updated);
    save("eb_candidates", updated);
  };

  const updateCandidate = (updated) => {
    const all = candidates.map((c) => (c.id === updated.id ? updated : c));
    setCandidates(all);
    save("eb_candidates", all);
    setEditing(null);
  };

  const locOptions = [{ id: "all", label: "All Locations" }, ...locations];
  const indOptions = [{ id: "all", label: "All Industries" }, ...industries];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontFamily: "'Trebuchet MS', sans-serif", color: EB.purple, margin: 0 }}>
            Candidate Editor
          </h2>
          <p style={{ color: EB.gray600, fontSize: 14, marginTop: 4, marginBottom: 0 }}>
            {filtered.length} candidate{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Select value={filterLoc} onChange={setFilterLoc} options={locOptions} />
          <Select value={filterInd} onChange={setFilterInd} options={indOptions} />
        </div>
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: EB.gray400, fontSize: 15 }}>
          No candidates found. Add some from the "Add Candidate" tab.
        </div>
      )}

      {filtered.map((c) =>
        editing?.id === c.id ? (
          <EditForm key={c.id} candidate={editing} locations={locations} industries={industries} onSave={updateCandidate} onCancel={() => setEditing(null)} />
        ) : (
          <CandidateCard key={c.id} candidate={c} locations={locations} industries={industries} onEdit={() => setEditing({ ...c })} onRemove={() => remove(c.id)} />
        )
      )}
    </div>
  );
}

function CandidateCard({ candidate: c, locations, industries, onEdit, onRemove }) {
  const loc = locations.find((l) => l.id === c.location)?.label || c.location;
  const ind = industries.find((i) => i.id === c.industry)?.label || c.industry;

  return (
    <div
      style={{
        background: EB.white,
        borderRadius: 12,
        border: `1px solid ${EB.gray200}`,
        padding: 20,
        marginBottom: 14,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'Trebuchet MS', sans-serif", fontWeight: 700, color: EB.purple, fontSize: 16 }}>
              {c.title}
            </span>
            {c.candidateId && (
              <span style={{ background: EB.gray100, color: EB.gray600, borderRadius: 4, padding: "2px 8px", fontSize: 12 }}>
                #{c.candidateId}
              </span>
            )}
            <span style={{ background: "#EDE9FE", color: EB.purple, borderRadius: 4, padding: "2px 8px", fontSize: 12 }}>
              {loc}
            </span>
            {ind !== "General" && (
              <span style={{ background: EB.gray100, color: EB.gray600, borderRadius: 4, padding: "2px 8px", fontSize: 12 }}>
                {ind}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            {c.payRate && <span style={{ fontSize: 13, color: EB.gray600 }}>💰 {c.payRate}</span>}
            {c.shift && <span style={{ fontSize: 13, color: EB.gray600 }}>🕐 {c.shift}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn onClick={onEdit} variant="secondary">✏️ Edit</Btn>
          <Btn onClick={onRemove} variant="danger">🗑 Remove</Btn>
        </div>
      </div>

      <ul style={{ margin: "12px 0 0", paddingLeft: 20 }}>
        {c.bullets.map((b, i) => (
          <li key={i} style={{ fontSize: 14, color: EB.gray800, marginBottom: 4, lineHeight: 1.5 }}>
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EditForm({ candidate, locations, industries, onSave, onCancel }) {
  const [form, setForm] = useState({ ...candidate });

  const setBullet = (i, val) => {
    const bullets = [...form.bullets];
    bullets[i] = val;
    setForm({ ...form, bullets });
  };

  const removeBullet = (i) => {
    const bullets = form.bullets.filter((_, idx) => idx !== i);
    setForm({ ...form, bullets });
  };

  return (
    <div
      style={{
        background: EB.white,
        borderRadius: 12,
        border: `2px solid ${EB.purple}`,
        padding: 20,
        marginBottom: 14,
      }}
    >
      <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <label style={{ fontSize: 11, color: EB.gray600, display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: 1 }}>Role Title</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ border: `1px solid ${EB.gray200}`, borderRadius: 6, padding: "6px 10px", fontSize: 14, fontFamily: "'Trebuchet MS', sans-serif", outline: "none" }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: EB.gray600, display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: 1 }}>Candidate ID</label>
          <input value={form.candidateId} onChange={(e) => setForm({ ...form, candidateId: e.target.value })} style={{ border: `1px solid ${EB.gray200}`, borderRadius: 6, padding: "6px 10px", fontSize: 14, fontFamily: "'Trebuchet MS', sans-serif", outline: "none", width: 100 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: EB.gray600, display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: 1 }}>Pay Rate</label>
          <input value={form.payRate} onChange={(e) => setForm({ ...form, payRate: e.target.value })} style={{ border: `1px solid ${EB.gray200}`, borderRadius: 6, padding: "6px 10px", fontSize: 14, fontFamily: "'Trebuchet MS', sans-serif", outline: "none", width: 90 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: EB.gray600, display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: 1 }}>Shift</label>
          <input value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} style={{ border: `1px solid ${EB.gray200}`, borderRadius: 6, padding: "6px 10px", fontSize: 14, fontFamily: "'Trebuchet MS', sans-serif", outline: "none", width: 110 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: EB.gray600, display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: 1 }}>Location</label>
          <Select value={form.location} onChange={(v) => setForm({ ...form, location: v })} options={locations} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: EB.gray600, display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: 1 }}>Industry</label>
          <Select value={form.industry} onChange={(v) => setForm({ ...form, industry: v })} options={industries} />
        </div>
      </div>

      {form.bullets.map((b, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
          <span style={{ color: EB.purple, marginTop: 8, flexShrink: 0 }}>•</span>
          <textarea value={b} onChange={(e) => setBullet(i, e.target.value)} rows={2} style={{ flex: 1, border: `1px solid ${EB.gray200}`, borderRadius: 6, padding: "6px 10px", fontSize: 14, fontFamily: "'Trebuchet MS', sans-serif", outline: "none", resize: "vertical" }} />
          <button onClick={() => removeBullet(i)} title="Remove bullet" style={{ background: "none", border: "none", cursor: "pointer", color: EB.gray400, fontSize: 16, padding: "6px 2px", flexShrink: 0, lineHeight: 1 }}>×</button>
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <Btn onClick={() => onSave(form)} variant="primary">💾 Save Changes</Btn>
        <Btn onClick={onCancel} variant="secondary">Cancel</Btn>
      </div>
    </div>
  );
}

// ── EXPORT PAGE ────────────────────────────────────────────────────────
function ExportPage({ locations, industries, candidates }) {
  const [filterLoc, setFilterLoc] = useState(locations[0]?.id || "");
  const [filterInd, setFilterInd] = useState("all");

  const indOptions = [{ id: "all", label: "All Industries" }, ...industries];
  const filtered = candidates.filter((c) => {
    if (c.location !== filterLoc) return false;
    if (filterInd !== "all" && c.industry !== filterInd) return false;
    return true;
  });

  const locLabel = locations.find((l) => l.id === filterLoc)?.label || "";

  const handlePrint = () => {
    const printContent = buildPrintHTML(filtered, locLabel);
    const w = window.open("", "_blank");
    w.document.write(printContent);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
    }, 500);
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ fontFamily: "'Trebuchet MS', sans-serif", color: EB.purple, marginBottom: 4 }}>
        Export Hot List
      </h2>
      <p style={{ color: EB.gray600, fontSize: 14, marginBottom: 24 }}>
        Select a location and industry, preview the hot list, then export to PDF.
      </p>

      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <label style={{ fontSize: 12, color: EB.gray600, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>
            Location
          </label>
          <Select value={filterLoc} onChange={setFilterLoc} options={locations} style={{ minWidth: 180 }} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: EB.gray600, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>
            Industry
          </label>
          <Select value={filterInd} onChange={setFilterInd} options={indOptions} style={{ minWidth: 160 }} />
        </div>
        <Btn onClick={handlePrint} variant="primary" disabled={filtered.length === 0}>
          📄 Export to PDF
        </Btn>
      </div>

      {/* Preview */}
      <div
        style={{
          background: EB.white,
          border: `1px solid ${EB.gray200}`,
          borderRadius: 12,
          padding: 40,
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
          maxWidth: 700,
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontFamily: "'Trebuchet MS', sans-serif", fontWeight: 900, fontSize: 36, color: EB.purple }}>
              employ
            </span>
            <span style={{ fontFamily: "'Trebuchet MS', sans-serif", fontWeight: 900, fontSize: 36, color: EB.accent }}>
              bridge
            </span>
          </div>
          <div style={{ width: 60, height: 3, background: EB.accent, margin: "0 auto 14px" }} />
          <p style={{ color: EB.purple, fontSize: 13, margin: 0, lineHeight: 1.6, fontFamily: "'Trebuchet MS', sans-serif" }}>
            Local {locLabel} talent interested in new opportunities. We're happy to make introductions and schedule conversations if you're interested. We also have additional candidates available, so if you don't see the skill set you're looking for, let's connect and discuss your openings and how we can partner.
          </p>
        </div>

        {filtered.length === 0 && (
          <p style={{ textAlign: "center", color: EB.gray400, padding: "30px 0" }}>
            No candidates for this selection.
          </p>
        )}

        {filtered.map((c, i) => (
          <div key={c.id} style={{ marginBottom: i < filtered.length - 1 ? 28 : 0 }}>
            <h3
              style={{
                fontFamily: "'Trebuchet MS', sans-serif",
                color: EB.purple,
                fontSize: 16,
                borderBottom: `2px solid ${EB.gray100}`,
                paddingBottom: 6,
                marginBottom: 10,
              }}
            >
              {c.title}
              {c.candidateId && ` – #${c.candidateId}`}
            </h3>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {c.bullets.map((b, j) => (
                <li key={j} style={{ fontSize: 13.5, color: "#1a1a2e", marginBottom: 5, lineHeight: 1.5, fontFamily: "'Trebuchet MS', sans-serif" }}>
                  {b}
                </li>
              ))}
              {(c.payRate || c.shift) && (
                <li style={{ fontSize: 13.5, color: "#1a1a2e", marginBottom: 5, lineHeight: 1.5, fontFamily: "'Trebuchet MS', sans-serif" }}>
                  {[c.shift && `Available for ${c.shift}`, c.payRate && `seeking ${c.payRate}`].filter(Boolean).join(", ")}.
                </li>
              )}
            </ul>
          </div>
        ))}

        <div style={{ marginTop: 32, borderTop: `1px solid ${EB.gray200}`, paddingTop: 12, textAlign: "left" }}>
          <span style={{ fontFamily: "'Trebuchet MS', sans-serif", fontSize: 11, color: EB.gray400 }}>
            Presented by Employbridge Staffing
          </span>
        </div>
      </div>
    </div>
  );
}

function buildPrintHTML(candidates, locLabel) {
  const rows = candidates
    .map(
      (c) => `
    <div class="candidate">
      <h3>${c.title}${c.candidateId ? ` – #${c.candidateId}` : ""}</h3>
      <ul>
        ${c.bullets.map((b) => `<li>${b}</li>`).join("")}
        ${c.payRate || c.shift ? `<li>${[c.shift && `Available for ${c.shift}`, c.payRate && `seeking ${c.payRate}`].filter(Boolean).join(", ")}.</li>` : ""}
      </ul>
    </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Employbridge Hot List – ${locLabel}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Trebuchet+MS&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Trebuchet MS', Arial, sans-serif; padding: 40px; max-width: 750px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 28px; }
    .logo img { height: 60px; width: auto; }
    .divider { width: 60px; height: 3px; background: #8B5CF6; margin: 10px auto; }
    .intro { color: #4B2E83; font-size: 13px; line-height: 1.6; text-align: center; }
    .candidate { margin-bottom: 26px; }
    .candidate h3 { color: #4B2E83; font-size: 15px; font-weight: bold; border-bottom: 2px solid #F0EEF8; padding-bottom: 5px; margin-bottom: 8px; }
    ul { padding-left: 20px; }
    li { font-size: 13px; color: #1a1a2e; margin-bottom: 4px; line-height: 1.5; }
    .footer { margin-top: 30px; border-top: 1px solid #DDD9EE; padding-top: 10px; font-size: 11px; color: #9B93C0; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo"><img src="employbridge_logo.png" alt="Employbridge" /></div>
    <div class="divider"></div>
    <p class="intro">Local ${locLabel} talent interested in new opportunities. We're happy to make introductions and schedule conversations if you're interested. We also have additional candidates available, so if you don't see the skill set you're looking for, let's connect and discuss your openings and how we can partner.</p>
  </div>
  ${rows}
  <div class="footer">Presented by Employbridge Staffing</div>
</body>
</html>`;
}

// ── SETTINGS PAGE ──────────────────────────────────────────────────────
function SettingsPage({ locations, setLocations, industries, setIndustries }) {
  const [newLoc, setNewLoc] = useState("");
  const [newInd, setNewInd] = useState("");

  const addLocation = () => {
    if (!newLoc.trim()) return;
    const updated = [...locations, { id: newLoc.toLowerCase().replace(/\s+/g, "-"), label: newLoc.trim() }];
    setLocations(updated);
    save("eb_locations", updated);
    setNewLoc("");
  };

  const removeLocation = (id) => {
    const updated = locations.filter((l) => l.id !== id);
    setLocations(updated);
    save("eb_locations", updated);
  };

  const addIndustry = () => {
    if (!newInd.trim()) return;
    const updated = [...industries, { id: newInd.toLowerCase().replace(/\s+/g, "-"), label: newInd.trim() }];
    setIndustries(updated);
    save("eb_industries", updated);
    setNewInd("");
  };

  const removeIndustry = (id) => {
    if (id === "general") return;
    const updated = industries.filter((i) => i.id !== id);
    setIndustries(updated);
    save("eb_industries", updated);
  };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <h2 style={{ fontFamily: "'Trebuchet MS', sans-serif", color: EB.purple, marginBottom: 4 }}>
        Settings
      </h2>
      <p style={{ color: EB.gray600, fontSize: 14, marginBottom: 28 }}>
        Manage markets and industries. Changes take effect immediately.
      </p>

      {/* Locations */}
      <div style={{ background: EB.white, borderRadius: 12, border: `1px solid ${EB.gray200}`, padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontFamily: "'Trebuchet MS', sans-serif", color: EB.purple, marginBottom: 16, fontSize: 16 }}>
          Markets / Locations
        </h3>
        {locations.map((l) => (
          <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${EB.gray100}` }}>
            <span style={{ fontFamily: "'Trebuchet MS', sans-serif", color: EB.gray800 }}>{l.label}</span>
            <Btn onClick={() => removeLocation(l.id)} variant="danger" style={{ padding: "4px 10px", fontSize: 12 }}>Remove</Btn>
          </div>
        ))}
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <input
            value={newLoc}
            onChange={(e) => setNewLoc(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addLocation()}
            placeholder="New location name..."
            style={{ flex: 1, border: `2px solid ${EB.gray200}`, borderRadius: 8, padding: "8px 12px", fontFamily: "'Trebuchet MS', sans-serif", fontSize: 14, outline: "none" }}
          />
          <Btn onClick={addLocation} variant="primary">+ Add</Btn>
        </div>
      </div>

      {/* Industries */}
      <div style={{ background: EB.white, borderRadius: 12, border: `1px solid ${EB.gray200}`, padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontFamily: "'Trebuchet MS', sans-serif", color: EB.purple, marginBottom: 8, fontSize: 16 }}>
          Industries
        </h3>
        <p style={{ color: EB.gray600, fontSize: 13, marginBottom: 14 }}>
          Future state: separate hot lists per industry. Adding industries here prepares the system for that feature.
        </p>
        {industries.map((ind) => (
          <div key={ind.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${EB.gray100}` }}>
            <span style={{ fontFamily: "'Trebuchet MS', sans-serif", color: EB.gray800 }}>{ind.label}</span>
            {ind.id !== "general" ? (
              <Btn onClick={() => removeIndustry(ind.id)} variant="danger" style={{ padding: "4px 10px", fontSize: 12 }}>Remove</Btn>
            ) : (
              <span style={{ fontSize: 12, color: EB.gray400 }}>Default</span>
            )}
          </div>
        ))}
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <input
            value={newInd}
            onChange={(e) => setNewInd(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addIndustry()}
            placeholder="New industry name..."
            style={{ flex: 1, border: `2px solid ${EB.gray200}`, borderRadius: 8, padding: "8px 12px", fontFamily: "'Trebuchet MS', sans-serif", fontSize: 14, outline: "none" }}
          />
          <Btn onClick={addIndustry} variant="primary">+ Add</Btn>
        </div>
      </div>

      <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, padding: 16 }}>
        <p style={{ fontFamily: "'Trebuchet MS', sans-serif", color: "#92400E", fontSize: 13, margin: 0 }}>
          <strong>Note:</strong> All data is stored locally in this browser. Candidate lists, locations, and settings persist across sessions on this device.
        </p>
      </div>
    </div>
  );
}

// ── APP ROOT ────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("add");
  const [locations, setLocations] = useState(() => load("eb_locations", DEFAULT_LOCATIONS));
  const [industries, setIndustries] = useState(() => load("eb_industries", DEFAULT_INDUSTRIES));
  const [candidates, setCandidates] = useState(() => load("eb_candidates", []));

  const tabs = [
    { id: "add", label: "Add Candidate", icon: "➕" },
    { id: "editor", label: "Editor", icon: "✏️" },
    { id: "export", label: "Export", icon: "📄" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: EB.gray50, fontFamily: "'Trebuchet MS', sans-serif" }}>
      {/* Top bar */}
      <div style={{ background: `linear-gradient(135deg, ${EB.purpleDark} 0%, ${EB.purple} 60%, ${EB.purpleLight} 100%)`, paddingTop: 16, paddingLeft: 24, paddingRight: 24, boxShadow: "0 2px 16px rgba(75,46,131,0.25)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <Logo size={24} />
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
              Hot List Generator
            </span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {tabs.map((t) => (
              <NavTab key={t.id} label={t.label} active={tab === t.id} onClick={() => setTab(t.id)} icon={t.icon} />
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
        {tab === "add" && (
          <AddCandidatePage locations={locations} industries={industries} candidates={candidates} setCandidates={setCandidates} />
        )}
        {tab === "editor" && (
          <EditorPage locations={locations} industries={industries} candidates={candidates} setCandidates={setCandidates} />
        )}
        {tab === "export" && (
          <ExportPage locations={locations} industries={industries} candidates={candidates} />
        )}
        {tab === "settings" && (
          <SettingsPage locations={locations} setLocations={setLocations} industries={industries} setIndustries={setIndustries} />
        )}
      </div>
    </div>
  );
}
