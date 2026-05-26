import { useState, useCallback } from "react";
import { callClaude } from "../lib/ai.js";
import { uuid, today } from "../lib/utils.js";
import { dbGetByIndex } from "../lib/db.js";

const FW_KEY = "ww_fw_sessions";
const loadSessions = () => { try { return JSON.parse(localStorage.getItem(FW_KEY)) || []; } catch { return []; } };
const saveSessions = (s) => localStorage.setItem(FW_KEY, JSON.stringify(s));

const FRAMEWORKS = [
  {
    id: "five-whys",
    name: "5 WHYS",
    desc: "Drill to root cause in 5 steps",
    icon: "🔍",
    color: "accent",
    steps: [
      "Describe the problem clearly. What exactly happened?",
      "Why did this happen? (1st Why)",
      "Why did that happen? (2nd Why)",
      "Why did that happen? (3rd Why)",
      "Why did that happen? (4th Why)",
      "Why did that happen? (5th Why — this is your root cause)",
    ],
    system: `You are a root cause analysis expert using the 5 Whys method. Based on the user's answers, provide:

**ROOT CAUSE**
[Clear statement of the root cause identified through the 5 Whys chain]

**CORRECTIVE ACTIONS**
1. [Immediate action]
2. [Short-term action]
3. [Systemic/preventive action]

**MICROSOFT COPILOT PROMPT**
[A ready-to-paste prompt for the user to use in Microsoft Copilot to document or track this fix in Excel/Teams]

Keep it concise and actionable.`,
  },
  {
    id: "dmaic",
    name: "DMAIC",
    desc: "Define · Measure · Analyze · Improve · Control",
    icon: "📊",
    color: "purple",
    steps: [
      "DEFINE: What is the problem and what does success look like when it's solved?",
      "MEASURE: What data do you have? How is this process currently performing?",
      "ANALYZE: What are the likely root causes? What patterns do you see?",
      "IMPROVE: What solutions have you tried or are you considering?",
      "CONTROL: How will you sustain the improvement and prevent recurrence?",
    ],
    system: `You are a Six Sigma DMAIC expert. Based on the user's phase-by-phase inputs, provide:

**DMAIC SUMMARY**
[2–3 sentence summary of the problem and proposed solution]

**KEY INSIGHTS BY PHASE**
- Define: [insight]
- Measure: [insight]
- Analyze: [insight]
- Improve: [insight]
- Control: [insight]

**TOP 3 NEXT ACTIONS**
1. [Action]
2. [Action]
3. [Action]

**MICROSOFT COPILOT PROMPT**
[Ready-to-paste prompt to create a DMAIC tracking sheet in Excel or Teams]`,
  },
  {
    id: "kaizen",
    name: "KAIZEN",
    desc: "Rapid continuous improvement",
    icon: "🌊",
    color: "amber",
    steps: [
      "What process needs improvement? Describe the current state in detail.",
      "What waste exists? (Defects, overprocessing, waiting, unused talent, transport, excess inventory, motion)",
      "What would the ideal future state look like?",
      "What quick wins (under 1 week) could you implement immediately?",
      "What longer-term changes require more resources or approval?",
    ],
    system: `You are a Kaizen facilitator. Based on the user's inputs, provide:

**CURRENT STATE ANALYSIS**
[Summary with waste categories identified]

**FUTURE STATE VISION**
[Clear description of the target state]

**QUICK WINS (This Week)**
1. [Action]
2. [Action]
3. [Action]

**LONGER-TERM IMPROVEMENTS**
1. [Action]
2. [Action]

**MICROSOFT COPILOT PROMPT**
[Ready-to-paste prompt to create a Kaizen tracking board in Teams or Excel]`,
  },
  {
    id: "scrum-retro",
    name: "SCRUM RETRO",
    desc: "What worked · What didn't · Next steps",
    icon: "🔄",
    color: "green",
    steps: [
      "What went well this period? What should you keep doing?",
      "What didn't go well? What obstacles did you face?",
      "What was unclear or caused confusion?",
      "What will you try differently next period?",
      "What is the single most important improvement to make?",
    ],
    system: `You are a Scrum retrospective facilitator. Based on the user's inputs, provide:

**RETROSPECTIVE SUMMARY**
[2–3 sentence synthesis]

**ACTION ITEMS**
1. [Action] — [Suggested timing]
2. [Action] — [Suggested timing]
3. [Action] — [Suggested timing]

**SUCCESS METRICS**
[How will you know the improvements are working?]

**MICROSOFT COPILOT PROMPT**
[Ready-to-paste prompt to document this retrospective in Teams]`,
  },
  {
    id: "pdca",
    name: "PDCA",
    desc: "Plan · Do · Check · Act",
    icon: "📐",
    color: "accent",
    steps: [
      "PLAN: What problem are you solving and what is your hypothesis for fixing it?",
      "DO: What small-scale test or pilot have you run (or will you run)?",
      "CHECK: What results did you observe? Did the test work as expected?",
      "ACT: Based on results, will you standardize, adjust, or try something different?",
    ],
    system: `You are a PDCA cycle facilitator. Based on the user's inputs, provide:

**CYCLE SUMMARY**
[What was tested and what was learned]

**KEY LEARNINGS**
[2–3 bullet points]

**RECOMMENDATION**
[Standardize / Iterate / Pivot — with reasoning]

**NEXT CYCLE**
[What should the next PDCA cycle focus on?]

**MICROSOFT COPILOT PROMPT**
[Ready-to-paste prompt to track implementation in Excel]`,
  },
  {
    id: "toc",
    name: "CONSTRAINTS",
    desc: "Find and eliminate your bottleneck",
    icon: "🎯",
    color: "purple",
    steps: [
      "Describe your workflow or process from start to finish.",
      "Where does work pile up or slow down the most? What is your biggest bottleneck?",
      "How are you currently managing work around this constraint?",
      "What would it take to fully exploit or eliminate this constraint?",
      "Once this constraint is resolved, what do you expect to become the next bottleneck?",
    ],
    system: `You are a Theory of Constraints expert. Based on the user's inputs, provide:

**CONSTRAINT IDENTIFIED**
[Clear statement of the core bottleneck]

**EXPLOITATION STRATEGIES**
[Get more out of the current constraint without spending money]
1. [Strategy]
2. [Strategy]

**ELEVATION STRATEGIES**
[Remove the constraint — bigger changes]
1. [Strategy]
2. [Strategy]

**PREDICTED NEXT CONSTRAINT**
[What will become the bottleneck after this one is resolved?]

**MICROSOFT COPILOT PROMPT**
[Ready-to-paste prompt to visualize workflow and constraints in Excel]`,
  },
];

const colorMap = { accent: (T) => T.accent, purple: (T) => T.purple, amber: (T) => T.amber, green: (T) => T.green };
const dimMap   = { accent: (T) => T.accentDim, purple: (T) => T.purpleDim, amber: (T) => T.amberDim, green: (T) => T.greenDim };

function Btn({ T, onClick, children, variant = "primary", disabled = false }) {
  const s = {
    primary: { background: T.accent, color: "#fff" },
    ghost:   { background: "transparent", color: T.muted, border: `1px solid ${T.border}` },
    success: { background: T.greenDim, color: T.green, border: `1px solid ${T.green}40` },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: "100%", padding: "14px", borderRadius: 12, border: "none",
      fontFamily: "'Unbounded', sans-serif", fontSize: 11, letterSpacing: "1px",
      fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1, marginTop: 8, ...s[variant],
    }}>{children}</button>
  );
}

// ─── Framework Facilitator ─────────────────────────────────────
function Facilitator({ T, fw, onBack, settings }) {
  const [step, setStep]       = useState(0);
  const [answers, setAnswers] = useState(Array(fw.steps.length).fill(""));
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied]   = useState(false);

  const setAnswer = (i, v) => {
    const next = [...answers];
    next[i] = v;
    setAnswers(next);
  };

  const isLast = step === fw.steps.length - 1;
  const done   = step >= fw.steps.length;

  const next = () => {
    if (!answers[step].trim()) return;
    if (isLast) {
      generate();
    } else {
      setStep((s) => s + 1);
    }
  };

  const generate = async () => {
    if (!settings.apiKey) {
      alert("Add your Anthropic API key in MORE → Settings to generate analysis.");
      return;
    }
    setLoading(true);
    setStep(fw.steps.length);
    try {
      const content = fw.steps.map((q, i) => `**${q}**\n${answers[i]}`).join("\n\n");
      const result = await callClaude(
        [{ role: "user", content }],
        fw.system,
        settings.apiKey,
        1500
      );
      setAnalysis(result);
      const session = {
        id: uuid(),
        frameworkId: fw.id,
        frameworkName: fw.name,
        answers: fw.steps.map((q, i) => ({ question: q, answer: answers[i] })),
        analysis: result,
        date: today(),
        createdAt: new Date().toISOString(),
      };
      const sessions = loadSessions();
      saveSessions([session, ...sessions]);
    } catch (err) {
      setAnalysis(`⚠️ Error generating analysis: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const extractCopilotPrompt = (text) => {
    const match = text.match(/\*\*MICROSOFT COPILOT PROMPT\*\*\n([\s\S]+?)(?:\n\n|$)/);
    return match ? match[1].trim() : null;
  };

  const copilotPrompt = analysis ? extractCopilotPrompt(analysis) : null;

  const copyPrompt = () => {
    if (!copilotPrompt) return;
    navigator.clipboard.writeText(copilotPrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const accentColor = colorMap[fw.color]?.(T) || T.accent;
  const accentDimColor = dimMap[fw.color]?.(T) || T.accentDim;

  return (
    <div style={{ padding: "0 16px" }}>
      {/* Header */}
      <div style={{ padding: "16px 0 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", cursor: "pointer",
          color: T.accent, fontSize: 20, padding: "4px 8px 4px 0",
        }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 14, fontWeight: 700, color: T.text }}>
            {fw.name}
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{fw.desc}</div>
        </div>
        <div style={{ background: accentDimColor, borderRadius: 10, padding: "6px 10px" }}>
          <span style={{ fontSize: 20 }}>{fw.icon}</span>
        </div>
      </div>

      {/* Progress bar */}
      {!done && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 9, color: T.muted, letterSpacing: 1 }}>
              STEP {step + 1} OF {fw.steps.length}
            </span>
            <span style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 9, color: accentColor }}>
              {Math.round(((step) / fw.steps.length) * 100)}%
            </span>
          </div>
          <div style={{ height: 3, background: T.surface2, borderRadius: 2 }}>
            <div style={{ height: "100%", borderRadius: 2, background: accentColor,
              width: `${(step / fw.steps.length) * 100}%`, transition: "width 0.3s" }} />
          </div>
        </div>
      )}

      {/* Step content */}
      {!done && (
        <div>
          <div style={{ background: T.surface, borderRadius: 16, padding: "20px",
            border: `1px solid ${T.border}`, borderLeft: `3px solid ${accentColor}`, marginBottom: 16 }}>
            <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 11, fontWeight: 600,
              color: accentColor, letterSpacing: "0.5px", marginBottom: 12 }}>
              {fw.steps[step]}
            </div>
            <textarea
              value={answers[step]}
              onChange={(e) => setAnswer(step, e.target.value)}
              placeholder="Type your answer here..."
              rows={5}
              autoFocus
              style={{
                width: "100%", background: T.surface2, border: `1px solid ${T.border}`,
                borderRadius: 10, padding: "12px 14px", fontSize: 14, color: T.text,
                lineHeight: 1.6, resize: "none", outline: "none",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
              onFocus={(e) => { e.target.style.borderColor = accentColor; }}
              onBlur={(e) => { e.target.style.borderColor = T.border; }}
            />
          </div>

          {/* Previous answers */}
          {step > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 9,
                color: T.muted, letterSpacing: 1, marginBottom: 8 }}>PREVIOUS ANSWERS</div>
              {answers.slice(0, step).map((ans, i) => ans.trim() && (
                <div key={i} style={{ background: T.surface, borderRadius: 12, padding: "12px 14px",
                  marginBottom: 6, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 10, color: T.muted, marginBottom: 4 }}>
                    Step {i + 1}: {fw.steps[i].slice(0, 40)}...
                  </div>
                  <div style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}>{ans}</div>
                </div>
              ))}
            </div>
          )}

          <Btn T={T} onClick={next} disabled={!answers[step].trim()}>
            {isLast ? "GENERATE ANALYSIS" : "NEXT STEP →"}
          </Btn>
          {step > 0 && <Btn T={T} onClick={() => setStep((s) => s - 1)} variant="ghost">← BACK</Btn>}
        </div>
      )}

      {/* Loading */}
      {done && loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: T.muted }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>{fw.icon}</div>
          <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 11, letterSpacing: 1, color: accentColor }}>
            ANALYZING...
          </div>
          <div style={{ fontSize: 13, marginTop: 8 }}>AI is generating your framework analysis</div>
        </div>
      )}

      {/* Analysis result */}
      {done && !loading && analysis && (
        <div>
          <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 10, letterSpacing: "1.5px",
            color: T.muted, marginBottom: 12 }}>ANALYSIS COMPLETE</div>

          <div style={{ background: T.surface, borderRadius: 16, padding: "20px",
            border: `1px solid ${T.border}`, borderLeft: `3px solid ${accentColor}`,
            fontSize: 14, color: T.text, lineHeight: 1.7, whiteSpace: "pre-wrap",
            marginBottom: 16 }}>
            {analysis.replace(/\*\*(.*?)\*\*/g, "$1")}
          </div>

          {copilotPrompt && (
            <div style={{ background: accentDimColor, borderRadius: 14, padding: "16px",
              border: `1px solid ${accentColor}40`, marginBottom: 12 }}>
              <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 10, letterSpacing: 1,
                color: accentColor, marginBottom: 10 }}>COPILOT PROMPT — READY TO PASTE</div>
              <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6, marginBottom: 12 }}>
                {copilotPrompt}
              </div>
              <button onClick={copyPrompt} style={{
                background: accentColor, color: "#fff", border: "none", borderRadius: 10,
                padding: "10px 16px", fontFamily: "'Unbounded', sans-serif", fontSize: 10,
                letterSpacing: "1px", fontWeight: 600, cursor: "pointer",
              }}>
                {copied ? "✓ COPIED!" : "COPY PROMPT"}
              </button>
            </div>
          )}

          <Btn T={T} onClick={onBack} variant="ghost">← BACK TO FRAMEWORKS</Btn>
          <div style={{ height: 16 }} />
        </div>
      )}
    </div>
  );
}

// ─── Session History ───────────────────────────────────────────
function SessionHistory({ T, sessions, onBack }) {
  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ padding: "16px 0 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer",
          color: T.accent, fontSize: 20, padding: "4px 8px 4px 0" }}>←</button>
        <h2 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 16, fontWeight: 700, color: T.text, margin: 0 }}>
          PAST SESSIONS
        </h2>
      </div>
      {sessions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: T.muted }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 11, letterSpacing: 1 }}>NO SESSIONS YET</div>
        </div>
      ) : (
        sessions.map((s) => (
          <div key={s.id} style={{ background: T.surface, borderRadius: 14, padding: "16px",
            marginBottom: 10, border: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 12, fontWeight: 600, color: T.text }}>
                {s.frameworkName}
              </span>
              <span style={{ fontSize: 11, color: T.muted }}>{s.date}</span>
            </div>
            <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
              {s.answers[0]?.answer?.slice(0, 80)}...
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Main FrameworksScreen ─────────────────────────────────────
export default function FrameworksScreen({ T, settings }) {
  const [selected, setSelected] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const sessions = loadSessions();

  if (showHistory) {
    return <SessionHistory T={T} sessions={sessions} onBack={() => setShowHistory(false)} />;
  }

  if (selected) {
    return <Facilitator T={T} fw={selected} settings={settings} onBack={() => setSelected(null)} />;
  }

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ padding: "20px 0 8px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 26, fontWeight: 700,
            color: T.text, margin: 0, lineHeight: 1.1 }}>TOOLS</h1>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 6 }}>
            AI-facilitated improvement frameworks
          </div>
        </div>
        <button onClick={() => setShowHistory(true)} style={{
          background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10,
          padding: "8px 12px", fontFamily: "'Unbounded', sans-serif", fontSize: 9,
          letterSpacing: "0.8px", color: T.muted, cursor: "pointer",
        }}>HISTORY</button>
      </div>

      <div style={{ fontSize: 13, color: T.muted, marginBottom: 20, lineHeight: 1.5,
        background: T.surface, borderRadius: 12, padding: "12px 14px", border: `1px solid ${T.border}` }}>
        Pick a framework, answer guided questions, and receive an AI analysis with a ready-to-paste Microsoft Copilot prompt.
      </div>

      {FRAMEWORKS.map((fw) => {
        const accent = colorMap[fw.color]?.(T) || T.accent;
        const dim    = dimMap[fw.color]?.(T) || T.accentDim;
        return (
          <div key={fw.id} onClick={() => setSelected(fw)} style={{
            background: T.surface, borderRadius: 16, padding: "18px",
            marginBottom: 10, border: `1px solid ${T.border}`,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 14,
            transition: "border-color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = accent; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; }}
          >
            <div style={{ width: 48, height: 48, borderRadius: 14, background: dim,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, flexShrink: 0 }}>
              {fw.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 13, fontWeight: 700,
                color: T.text, marginBottom: 4 }}>{fw.name}</div>
              <div style={{ fontSize: 12, color: T.muted }}>{fw.desc}</div>
              <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                {fw.steps.map((_, i) => (
                  <div key={i} style={{ width: 16, height: 3, borderRadius: 2, background: T.surface2 }} />
                ))}
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.muted}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        );
      })}

      <div style={{ height: 16 }} />
    </div>
  );
}
