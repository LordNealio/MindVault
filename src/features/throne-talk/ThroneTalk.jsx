import { useState, useEffect, useRef, useCallback } from "react";
import {
  LENSES, LEVELS, DEPTH_RATINGS, SEED_OBSERVATIONS,
  getCurrentQuestion, getDayCategories, SOCRATIC_PROMPTS,
  getTotalPoints, getLevelForPoints, getNextLevel, getCurrentWeekId,
} from "./data.js";

// ── Design tokens (shared with App.jsx) ───────────────────────────────────
const D = {
  bg: "#F0EDE5", white: "#FAFAF7", bl: "#1D3557", rd: "#C1121F",
  yl: "#E8B84B", bk: "#0A0A0A", muted: "#9B9589", border: "#E8E4DA",
  shadow: "rgba(0,0,0,0.08)", r: 18,
};

// ── Persistence ────────────────────────────────────────────────────────────
const TT = {
  get: k => { try { const v = localStorage.getItem("tt_" + k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem("tt_" + k, JSON.stringify(v)); } catch {} },
};

const DEFAULT_USER = {
  lens: null,
  points: { depth: 0, clarity: 0, engagement: 0, acuity: 0 },
  streak: 0,
  lastSessionDate: null,
  totalSessions: 0,
  sessionDoneToday: false,
  token: "",
};

function loadUser() {
  const saved = TT.get("user");
  if (!saved) return { ...DEFAULT_USER };
  // Reset sessionDoneToday if last session was not today
  const today = new Date().toISOString().slice(0, 10);
  if (saved.lastSessionDate !== today) saved.sessionDoneToday = false;
  return { ...DEFAULT_USER, ...saved };
}

function loadObservations() {
  const saved = TT.get("observations");
  if (saved && saved.length > 0) return saved;
  TT.set("observations", SEED_OBSERVATIONS);
  return SEED_OBSERVATIONS;
}

function loadSessions() {
  return TT.get("sessions") || [];
}

// ── Small shared UI atoms ──────────────────────────────────────────────────
const Pill = ({ children, color = D.muted, bg = "transparent", style = {} }) => (
  <span style={{
    display: "inline-block", padding: "3px 9px", borderRadius: 20,
    fontSize: 9, fontWeight: 700, letterSpacing: ".08em",
    fontFamily: "'Unbounded',monospace", color, background: bg,
    border: `1px solid ${color}`, ...style,
  }}>{children}</span>
);

const SLabel = ({ children, color = D.rd, style = {} }) => (
  <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 8, fontWeight: 700, letterSpacing: ".14em", color, ...style }}>
    {children}
  </div>
);

const Card = ({ children, style = {} }) => (
  <div style={{
    background: D.white, borderRadius: D.r, border: `1px solid ${D.border}`,
    boxShadow: `0 2px 12px ${D.shadow}`, overflow: "hidden", ...style,
  }}>{children}</div>
);

const Btn = ({ children, onClick, primary, disabled, style = {} }) => (
  <button onClick={onClick} disabled={disabled} style={{
    width: "100%", padding: "15px 20px", borderRadius: 12,
    fontFamily: "'Unbounded',monospace", fontSize: 10, fontWeight: 700,
    letterSpacing: ".1em", transition: "all .2s",
    background: disabled ? D.border : primary ? D.bk : "transparent",
    color: disabled ? D.muted : primary ? D.yl : D.bk,
    border: `1.5px solid ${disabled ? D.border : D.bk}`,
    cursor: disabled ? "not-allowed" : "pointer", ...style,
  }}>{children}</button>
);

const Spinner = () => (
  <div style={{
    width: 20, height: 20, borderRadius: "50%",
    border: `2px solid ${D.border}`, borderTopColor: D.bk,
    animation: "spin .8s linear infinite", margin: "0 auto",
  }} />
);

// ── Lens icon helper ───────────────────────────────────────────────────────
function lensColor(id) {
  return LENSES.find(l => l.id === id)?.color || D.muted;
}
function lensIcon(id) {
  return LENSES.find(l => l.id === id)?.icon || "◎";
}

// ── AI Synthesis call ──────────────────────────────────────────────────────
async function callSynthesis({ token, weekQuestion, reviewObservation, reviewReflection, reviewRating, contributions, lens }) {
  if (!token) throw new Error("NO_TOKEN");

  const runId = crypto.randomUUID();
  const system = `You are a contemplative AI facilitator for Throne Talk — a platform for collective inquiry.

Your role: mirror, facilitate, and deepen. Never answer. Never conclude. Never resolve.

You receive a user's session data:
- The weekly question the community is exploring
- An observation from another person they reviewed (with their depth rating and reflection)
- Their own contributions written during the timed session

Your synthesis must:
1. Briefly mirror the core of their thinking (1–2 sentences, observational not evaluative)
2. Note one pattern or tension you observe — especially how their review of someone else's thinking may have influenced their own
3. Surface one contradiction or unexplored edge in their observations
4. Close with EXACTLY ONE emergent question — not an answer, not a summary. A question that opens the next layer.

Tone: warm, precise, contemplative. Like a skilled Socratic teacher, not a therapist or chatbot.
Format: 4 short paragraphs. No headers. No bullet points. No "I noticed that..." openers.
Length: 120–180 words total.`;

  const ratingLabel = DEPTH_RATINGS.find(r => r.value === reviewRating)?.label || "Considered";
  const userMsg = `Weekly question: "${weekQuestion}"

Observation reviewed (from another user, ${ratingLabel} depth):
"${reviewObservation}"

My reflection on their observation:
"${reviewReflection}"

My own contributions during the session:
${contributions.filter(Boolean).map((c, i) => `[${i + 1}] "${c}"`).join("\n")}

My philosophical lens: ${lens || "Secular/Explorer"}`;

  const res = await fetch("/api/automation/invoke", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      runId,
      model: "claude-sonnet-4-6",
      maxTokens: 512,
      system,
      messages: [{ role: "user", content: userMsg }],
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error("AUTH_ERROR");
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.text;
}

// ══════════════════════════════════════════════════════════════════════════
// SCREEN: Lens Select
// ══════════════════════════════════════════════════════════════════════════
function LensSelectScreen({ onSelect }) {
  const [selected, setSelected] = useState(null);
  return (
    <div style={{ padding: "24px 16px 120px", animation: "fadeUp .4s both" }}>
      <div style={{ marginBottom: 28 }}>
        <SLabel color={D.rd} style={{ marginBottom: 8 }}>CHOOSE YOUR LENS</SLabel>
        <h1 style={{ fontFamily: "'Unbounded',monospace", fontSize: 20, fontWeight: 900, lineHeight: 1.3, marginBottom: 10 }}>
          How do you approach<br />the deepest questions?
        </h1>
        <p style={{ fontSize: 12, color: D.muted, lineHeight: 1.75 }}>
          This is not a religious label — it's a philosophical frame for inquiry.
          You'll see scripture from this tradition paired with each weekly question.
          You can change it anytime.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {LENSES.map(l => (
          <button key={l.id} onClick={() => setSelected(l.id)} style={{
            display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
            borderRadius: 14, border: `2px solid ${selected === l.id ? l.color : D.border}`,
            background: selected === l.id ? l.color + "14" : D.white,
            transition: "all .18s", textAlign: "left",
          }}>
            <span style={{ fontSize: 22, width: 28, textAlign: "center" }}>{l.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: D.bk }}>{l.label}</span>
            {selected === l.id && (
              <span style={{ marginLeft: "auto", fontSize: 16, color: l.color }}>✓</span>
            )}
          </button>
        ))}
      </div>

      <Btn primary disabled={!selected} onClick={() => onSelect(selected)}>
        {selected ? `ENTER WITH ${selected.toUpperCase()}` : "SELECT A LENS TO CONTINUE"}
      </Btn>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SCREEN: Home
// ══════════════════════════════════════════════════════════════════════════
function HomeScreen({ user, weekQuestion, onBeginSession, onChangeLens }) {
  const lens = LENSES.find(l => l.id === user.lens);
  const scripture = weekQuestion.scripture?.[user.lens];
  const total = getTotalPoints(user.points);
  const level = getLevelForPoints(total);
  const nextLevel = getNextLevel(level);
  const categories = getDayCategories();
  const dayName = new Date().toLocaleDateString("en-US", { weekday: "long" });

  return (
    <div style={{ padding: "0 0 120px" }}>
      {/* Header */}
      <div style={{ background: D.bk, padding: "20px 16px 24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, right: 0, width: 60, height: 60, background: D.yl, opacity: .9 }} />
        <div style={{ position: "absolute", top: 60, right: 0, width: 60, height: 36, background: D.rd, opacity: .9 }} />

        {/* Golden throne */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16, position: "relative", zIndex: 1 }}>
          <div style={{
            width: 88, height: 88, borderRadius: "50%",
            background: "radial-gradient(circle at 38% 38%, #FFE066, #E8B84B 55%, #B8860B)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 46, lineHeight: 1,
            boxShadow: "0 0 0 4px #E8B84B44, 0 0 32px #E8B84B66, 0 6px 24px rgba(0,0,0,.5)",
          }}>🚽</div>
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          <SLabel color={D.yl} style={{ marginBottom: 4, textAlign: "center" }}>THRONE TALK</SLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <button onClick={onChangeLens} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "4px 10px",
              borderRadius: 20, border: `1px solid ${lens?.color || D.muted}`, color: lens?.color || D.muted,
              fontSize: 11, fontWeight: 600,
            }}>
              <span>{lens?.icon}</span>
              <span>{lens?.label}</span>
            </button>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 8, color: D.muted, letterSpacing: ".08em" }}>{level.name.toUpperCase()}</div>
              <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 14, color: D.yl, fontWeight: 900 }}>{total} PTS</div>
            </div>
          </div>
          {nextLevel && (
            <div style={{ height: 3, background: "rgba(255,255,255,.1)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", background: D.yl, borderRadius: 3, transition: "width .6s", width: `${Math.min(100, ((total - level.minPoints) / (nextLevel.minPoints - level.minPoints)) * 100)}%` }} />
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Today's status */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <SLabel color={D.muted}>{dayName.toUpperCase()}</SLabel>
          <div style={{ flex: 1, height: 1, background: D.border }} />
          <div style={{ display: "flex", gap: 6 }}>
            {categories.map(c => <Pill key={c} color={D.bl}>{c.toUpperCase()}</Pill>)}
          </div>
        </div>

        {/* Weekly Question */}
        <Card>
          <div style={{ padding: "18px 16px" }}>
            <SLabel color={D.rd} style={{ marginBottom: 10 }}>THIS WEEK'S QUESTION</SLabel>
            <blockquote style={{
              fontSize: 17, fontWeight: 700, lineHeight: 1.55, color: D.bk,
              borderLeft: `3px solid ${D.yl}`, paddingLeft: 14, margin: 0, marginBottom: scripture ? 16 : 0,
            }}>
              "{weekQuestion.text}"
            </blockquote>
            {scripture && (
              <div style={{ paddingTop: 14, borderTop: `1px solid ${D.border}` }}>
                <SLabel color={lensColor(user.lens)} style={{ marginBottom: 6 }}>
                  {lens?.icon} {user.lens.toUpperCase()}
                </SLabel>
                <p style={{ fontSize: 12, fontStyle: "italic", color: D.bk, lineHeight: 1.7, marginBottom: 4 }}>
                  "{scripture.text}"
                </p>
                <p style={{ fontSize: 10, color: D.muted }}>— {scripture.source}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Session CTA */}
        {user.sessionDoneToday ? (
          <Card style={{ borderLeft: `4px solid #16a34a` }}>
            <div style={{ padding: "16px", display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ fontSize: 24 }}>✓</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Session complete</div>
                <div style={{ fontSize: 11, color: D.muted, lineHeight: 1.6 }}>
                  You've contributed to today's collective inquiry.
                  Come back tomorrow when the prompts shift.
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <div>
            <Btn primary onClick={onBeginSession}>BEGIN SESSION</Btn>
            <p style={{ fontSize: 10, color: D.muted, textAlign: "center", marginTop: 8, lineHeight: 1.65 }}>
              3–12 minutes · Give before you get · Review first, then contribute
            </p>
          </div>
        )}

        {/* Stats strip */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { label: "STREAK", value: `${user.streak}d` },
            { label: "SESSIONS", value: user.totalSessions },
            { label: "LEVEL", value: level.name },
          ].map(s => (
            <Card key={s.label} style={{ textAlign: "center" }}>
              <div style={{ padding: "12px 8px" }}>
                <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 14, fontWeight: 900, color: D.bk, marginBottom: 2 }}>{s.value}</div>
                <SLabel color={D.muted} style={{ fontSize: 7 }}>{s.label}</SLabel>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SCREEN: Review Phase
// ══════════════════════════════════════════════════════════════════════════
function ReviewScreen({ observation, userLens, onComplete }) {
  const [rating, setRating] = useState(null);
  const [reflection, setReflection] = useState("");
  const [dwellDone, setDwellDone] = useState(false);
  const [dwellSecs, setDwellSecs] = useState(10);

  useEffect(() => {
    if (dwellDone) return;
    const t = setInterval(() => {
      setDwellSecs(s => {
        if (s <= 1) { setDwellDone(true); clearInterval(t); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const canUnlock = dwellDone && rating !== null && reflection.trim().length >= 20;
  const obsLens = LENSES.find(l => l.id === observation.lens);

  return (
    <div style={{ padding: "20px 16px 120px", animation: "fadeUp .4s both" }}>
      <SLabel color={D.rd} style={{ marginBottom: 6 }}>PHASE 1 — REVIEW</SLabel>
      <h2 style={{ fontFamily: "'Unbounded',monospace", fontSize: 16, fontWeight: 900, marginBottom: 6, lineHeight: 1.3 }}>
        Step outside your own position.
      </h2>
      <p style={{ fontSize: 11, color: D.muted, lineHeight: 1.7, marginBottom: 20 }}>
        What is this person seeing that you might not be?
      </p>

      {/* The observation */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ padding: "6px 14px", background: lensColor(observation.lens) + "18", borderBottom: `1px solid ${D.border}`, display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 14 }}>{obsLens?.icon}</span>
          <SLabel color={lensColor(observation.lens)}>{observation.lens.toUpperCase()} LENS</SLabel>
        </div>
        <div style={{ padding: "16px" }}>
          <p style={{ fontSize: 14, lineHeight: 1.75, color: D.bk, fontStyle: "italic" }}>
            "{observation.text}"
          </p>
        </div>
      </Card>

      {/* Depth rating */}
      <div style={{ marginBottom: 20 }}>
        <SLabel style={{ marginBottom: 10 }}>RATE THE DEPTH OF THIS OBSERVATION</SLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {DEPTH_RATINGS.map(r => (
            <button key={r.value} onClick={() => setRating(r.value)} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
              borderRadius: 12, border: `2px solid ${rating === r.value ? D.bk : D.border}`,
              background: rating === r.value ? D.bk : D.white,
              transition: "all .15s", textAlign: "left",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: rating === r.value ? D.yl : D.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'Unbounded',monospace", fontSize: 10, fontWeight: 900,
                color: rating === r.value ? D.bk : D.muted,
              }}>{r.value}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: rating === r.value ? D.yl : D.bk, marginBottom: 2 }}>{r.label}</div>
                <div style={{ fontSize: 10, color: rating === r.value ? "rgba(255,255,255,.6)" : D.muted }}>{r.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Reflection input */}
      <div style={{ marginBottom: 20 }}>
        <SLabel style={{ marginBottom: 8 }}>WRITE YOUR REFLECTION</SLabel>
        <p style={{ fontSize: 11, color: D.muted, marginBottom: 10, lineHeight: 1.65 }}>
          What do you notice in this person's thinking? What does their observation reveal that your own position might miss?
        </p>
        <div style={{
          background: D.white, borderRadius: 14, border: `1.5px solid ${reflection.length > 19 ? D.bk : D.border}`,
          padding: "14px", transition: "border-color .2s",
        }}>
          <textarea value={reflection} onChange={e => setReflection(e.target.value)}
            placeholder="Write at least 20 characters to unlock Phase 2…"
            rows={5} style={{ fontSize: 13, lineHeight: 1.75, color: D.bk, width: "100%" }} />
          <div style={{ fontSize: 10, color: D.muted, textAlign: "right", marginTop: 6 }}>{reflection.length} chars</div>
        </div>
      </div>

      <Btn primary onClick={() => onComplete(rating, reflection)} disabled={!canUnlock}>
        {!dwellDone
          ? `UNLOCK IN ${dwellSecs}s — KEEP READING`
          : rating === null
          ? "RATE THE OBSERVATION TO UNLOCK"
          : reflection.trim().length < 20
          ? "WRITE YOUR REFLECTION TO UNLOCK"
          : "UNLOCK PHASE 2 — CONTRIBUTE"}
      </Btn>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SCREEN: Contribute Phase
// ══════════════════════════════════════════════════════════════════════════
function ContributeScreen({ weekQuestion, userLevel, onComplete }) {
  const [duration, setDuration] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [running, setRunning] = useState(false);
  const [text, setText] = useState("");
  const [promptIdx, setPromptIdx] = useState(0);
  const [currentPrompt, setCurrentPrompt] = useState("");
  const timerRef = useRef(null);
  const promptRef = useRef(null);

  const categories = getDayCategories();

  const getNextPrompt = useCallback((idx) => {
    const allPrompts = categories.flatMap(cat => SOCRATIC_PROMPTS[cat] || []);
    return allPrompts[idx % allPrompts.length];
  }, [categories]);

  useEffect(() => {
    setCurrentPrompt(getNextPrompt(0));
  }, [getNextPrompt]);

  function startSession(mins) {
    setDuration(mins);
    setTimeLeft(mins * 60);
    setRunning(true);
  }

  useEffect(() => {
    if (!running || timeLeft === null) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setRunning(false);
          clearInterval(timerRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    promptRef.current = setInterval(() => {
      setPromptIdx(i => {
        const next = i + 1;
        setCurrentPrompt(getNextPrompt(next));
        return next;
      });
    }, 45000);
    return () => clearInterval(promptRef.current);
  }, [running, getNextPrompt]);

  const fmtTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const progress = duration ? (1 - timeLeft / (duration * 60)) : 0;

  if (!running && timeLeft === null) {
    return (
      <div style={{ padding: "20px 16px 120px", animation: "fadeUp .4s both" }}>
        <SLabel color={D.rd} style={{ marginBottom: 6 }}>PHASE 2 — CONTRIBUTE</SLabel>
        <h2 style={{ fontFamily: "'Unbounded',monospace", fontSize: 16, fontWeight: 900, marginBottom: 6, lineHeight: 1.3 }}>
          From stillness, inquire.
        </h2>
        <div style={{ background: D.bl, borderRadius: D.r, padding: "16px", marginBottom: 24, color: D.white }}>
          <p style={{ fontSize: 12, lineHeight: 1.85, fontStyle: "italic" }}>
            Notice your breath. Notice the surface beneath you. Now, from this stillness…
          </p>
        </div>

        <SLabel style={{ marginBottom: 12 }}>CHOOSE YOUR SESSION LENGTH</SLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {[
            { mins: 3, label: "3 MINUTES", desc: "Quick reflection — observation & noticing" },
            { mins: 7, label: "7 MINUTES", desc: "Standard session — deeper inquiry" },
            { mins: 12, label: "12 MINUTES", desc: "Full session — synthesis across lenses" },
          ].map(o => (
            <button key={o.mins} onClick={() => startSession(o.mins)} style={{
              display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
              borderRadius: 14, border: `2px solid ${D.border}`,
              background: D.white, textAlign: "left", transition: "all .15s",
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, background: D.bk, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'Unbounded',monospace", fontSize: 11, fontWeight: 900, color: D.yl,
              }}>{o.mins}m</div>
              <div>
                <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 10, fontWeight: 700, color: D.bk, marginBottom: 3 }}>{o.label}</div>
                <div style={{ fontSize: 11, color: D.muted }}>{o.desc}</div>
              </div>
            </button>
          ))}
        </div>

        <p style={{ fontSize: 10, color: D.muted, textAlign: "center", lineHeight: 1.7 }}>
          Prompts rotate every 45 seconds. Write freely — no right answers.
        </p>
      </div>
    );
  }

  const isDone = !running && timeLeft === 0;

  return (
    <div style={{ padding: "16px 16px 120px", animation: "fadeUp .4s both" }}>
      {/* Timer bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <SLabel color={D.rd}>PHASE 2 — CONTRIBUTE</SLabel>
          <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 16, fontWeight: 900, color: isDone ? "#16a34a" : D.bk }}>
            {isDone ? "DONE" : fmtTime(timeLeft)}
          </div>
        </div>
        <div style={{ height: 4, background: D.border, borderRadius: 4, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 4, transition: "width 1s linear",
            background: isDone ? "#16a34a" : D.rd,
            width: `${progress * 100}%`,
          }} />
        </div>
      </div>

      {/* Rotating prompt */}
      <Card style={{ marginBottom: 16, border: `2px solid ${D.bk}` }}>
        <div style={{ padding: "14px 16px" }}>
          <SLabel color={D.muted} style={{ marginBottom: 8 }}>{categories[promptIdx % categories.length]?.toUpperCase() || "CLARIFICATION"}</SLabel>
          <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.65, color: D.bk }}>
            {currentPrompt}
          </p>
        </div>
      </Card>

      {/* The week question (small) */}
      <p style={{ fontSize: 10, color: D.muted, marginBottom: 12, lineHeight: 1.65, fontStyle: "italic", paddingLeft: 10, borderLeft: `2px solid ${D.yl}` }}>
        "{weekQuestion.text}"
      </p>

      {/* Writing area */}
      <div style={{
        background: D.white, borderRadius: 14, border: `1.5px solid ${D.border}`,
        padding: "14px", marginBottom: 16, minHeight: 200,
      }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Write freely. Follow the question wherever it goes. Don't edit — just observe and record…"
          autoFocus
          style={{ fontSize: 14, lineHeight: 1.85, color: D.bk, width: "100%", minHeight: 180 }}
        />
      </div>

      {(isDone || text.trim().length > 30) && (
        <Btn primary onClick={() => onComplete(text)}>
          {isDone ? "TIME'S UP — CONTINUE TO SYNTHESIS" : "FINISH EARLY — CONTINUE TO SYNTHESIS"}
        </Btn>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SCREEN: Synthesis Phase
// ══════════════════════════════════════════════════════════════════════════
function SynthesisScreen({ sessionData, user, onDone }) {
  const [status, setStatus] = useState("loading");
  const [synthesis, setSynthesis] = useState("");
  const [error, setError] = useState("");
  const [tokenInput, setTokenInput] = useState(user.token || "");
  const [showTokenEntry, setShowTokenEntry] = useState(!user.token);

  useEffect(() => {
    if (!showTokenEntry && user.token) runSynthesis(user.token);
  }, []);

  async function runSynthesis(token) {
    setStatus("loading");
    setError("");
    try {
      const text = await callSynthesis({
        token,
        weekQuestion: sessionData.weekQuestion,
        reviewObservation: sessionData.reviewObservation,
        reviewReflection: sessionData.reviewReflection,
        reviewRating: sessionData.reviewRating,
        contributions: [sessionData.contribution],
        lens: user.lens,
      });
      setSynthesis(text);
      setStatus("done");
    } catch (err) {
      if (err.message === "NO_TOKEN" || err.message === "AUTH_ERROR") {
        setShowTokenEntry(true);
        setStatus("idle");
        setError("Access token required for AI synthesis.");
      } else {
        setStatus("error");
        setError(err.message);
      }
    }
  }

  function handleConnect() {
    const t = tokenInput.trim();
    if (!t) return;
    setShowTokenEntry(false);
    onDone(null, t, false);
    runSynthesis(t);
  }

  return (
    <div style={{ padding: "20px 16px 120px", animation: "fadeUp .4s both" }}>
      <SLabel color={D.rd} style={{ marginBottom: 6 }}>PHASE 3 — SYNTHESIS</SLabel>
      <h2 style={{ fontFamily: "'Unbounded',monospace", fontSize: 16, fontWeight: 900, marginBottom: 20, lineHeight: 1.3 }}>
        What the session revealed.
      </h2>

      {showTokenEntry && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ padding: "16px" }}>
            <SLabel style={{ marginBottom: 8 }}>AI SYNTHESIS</SLabel>
            <p style={{ fontSize: 11, color: D.muted, lineHeight: 1.7, marginBottom: 14 }}>
              Enter your access token to enable Claude AI synthesis. Without it, you can still record your session.
            </p>
            {error && <p style={{ fontSize: 11, color: D.rd, marginBottom: 10, fontWeight: 600 }}>{error}</p>}
            <input
              type="password"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              placeholder="Paste access token…"
              style={{
                background: D.bg, borderRadius: 10, padding: "10px 12px", fontSize: 13,
                border: `1.5px solid ${D.border}`, width: "100%", marginBottom: 10,
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={handleConnect} primary style={{ flex: 1 }}>CONNECT + SYNTHESIZE</Btn>
              <Btn onClick={() => onDone("", "", true)} style={{ flex: 1 }}>SKIP SYNTHESIS</Btn>
            </div>
          </div>
        </Card>
      )}

      {status === "loading" && !showTokenEntry && (
        <Card style={{ padding: "40px 20px", textAlign: "center" }}>
          <Spinner />
          <p style={{ fontSize: 12, color: D.muted, marginTop: 16, lineHeight: 1.7 }}>
            Reflecting on your session…<br />
            <span style={{ fontSize: 10 }}>Claude is reading your observations</span>
          </p>
        </Card>
      )}

      {status === "error" && (
        <Card style={{ marginBottom: 20, border: `2px solid ${D.rd}` }}>
          <div style={{ padding: "16px" }}>
            <p style={{ fontSize: 12, color: D.rd, marginBottom: 12, fontWeight: 600 }}>Synthesis failed: {error}</p>
            <Btn onClick={() => runSynthesis(user.token)}>RETRY</Btn>
          </div>
        </Card>
      )}

      {status === "done" && synthesis && (
        <>
          <Card style={{ marginBottom: 20, border: `2px solid ${D.bk}` }}>
            <div style={{ padding: "6px 14px", background: D.bk }}>
              <SLabel color={D.yl}>CLAUDE'S REFLECTION</SLabel>
            </div>
            <div style={{ padding: "18px 16px" }}>
              {synthesis.split("\n\n").filter(Boolean).map((para, i) => (
                <p key={i} style={{ fontSize: 13, lineHeight: 1.85, color: D.bk, marginBottom: i < synthesis.split("\n\n").length - 1 ? 14 : 0 }}>
                  {para}
                </p>
              ))}
            </div>
          </Card>

          {/* Session summary */}
          <Card style={{ marginBottom: 20 }}>
            <div style={{ padding: "14px 16px" }}>
              <SLabel style={{ marginBottom: 10 }}>SESSION COMPLETE</SLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { label: "ENGAGEMENT", value: "+10", color: D.bl },
                  { label: "CLARITY", value: "+5", color: D.rd },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: "center", padding: "10px", background: D.bg, borderRadius: 10 }}>
                    <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</div>
                    <SLabel color={D.muted} style={{ fontSize: 7, marginTop: 2 }}>{s.label}</SLabel>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Btn primary onClick={() => onDone(synthesis, tokenInput, true)}>DONE — RETURN HOME</Btn>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SCREEN: Dashboard
// ══════════════════════════════════════════════════════════════════════════
function DashboardScreen({ user, sessions }) {
  const total = getTotalPoints(user.points);
  const level = getLevelForPoints(total);
  const nextLevel = getNextLevel(level);
  const lens = LENSES.find(l => l.id === user.lens);

  const dims = [
    { key: "depth",      label: "DEPTH",      desc: "From peer depth ratings",        color: D.bl  },
    { key: "clarity",    label: "CLARITY",     desc: "From AI synthesis recognition",  color: D.rd  },
    { key: "engagement", label: "ENGAGEMENT",  desc: "Sessions & reviews completed",   color: "#16a34a" },
    { key: "acuity",     label: "ACUITY",      desc: "Cognitive game performance",     color: "#8B5E3C" },
  ];

  return (
    <div style={{ padding: "0 0 120px" }}>
      <div style={{ background: D.bk, padding: "20px 16px 24px" }}>
        <SLabel color={D.yl} style={{ marginBottom: 4 }}>DASHBOARD</SLabel>
        <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 24, fontWeight: 900, color: D.white, marginBottom: 4 }}>
          {total} PTS
        </div>
        <div style={{ fontSize: 12, color: D.muted }}>{level.name} · {level.bloom}</div>
        {nextLevel && (
          <>
            <div style={{ height: 4, background: "rgba(255,255,255,.1)", borderRadius: 4, overflow: "hidden", marginTop: 12 }}>
              <div style={{
                height: "100%", background: D.yl, borderRadius: 4,
                width: `${Math.min(100, ((total - level.minPoints) / (nextLevel.minPoints - level.minPoints)) * 100)}%`,
              }} />
            </div>
            <div style={{ fontSize: 10, color: D.muted, marginTop: 6 }}>
              {nextLevel.minPoints - total} pts to {nextLevel.name}
            </div>
          </>
        )}
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Point dimensions */}
        <SLabel style={{ marginBottom: 4 }}>POINT DIMENSIONS</SLabel>
        {dims.map(d => {
          const val = user.points[d.key] || 0;
          const maxVal = Math.max(50, total, 50);
          return (
            <Card key={d.key}>
              <div style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <SLabel color={d.color} style={{ marginBottom: 2 }}>{d.label}</SLabel>
                    <div style={{ fontSize: 10, color: D.muted }}>{d.desc}</div>
                  </div>
                  <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 20, fontWeight: 900, color: d.color }}>{val}</div>
                </div>
                <div style={{ height: 6, background: D.bg, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: d.color, borderRadius: 3, width: `${Math.min(100, (val / maxVal) * 100)}%`, transition: "width .6s" }} />
                </div>
              </div>
            </Card>
          );
        })}

        {/* Session history */}
        <SLabel style={{ marginTop: 8, marginBottom: 4 }}>RECENT SESSIONS</SLabel>
        {sessions.length === 0 ? (
          <Card>
            <div style={{ padding: "20px 16px", textAlign: "center", color: D.muted, fontSize: 12 }}>
              No sessions yet. Begin your first session from the Home tab.
            </div>
          </Card>
        ) : (
          sessions.slice(-5).reverse().map((s, i) => (
            <Card key={i}>
              <div style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{new Date(s.timestamp).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</div>
                  <Pill color={D.muted}>{s.duration}m</Pill>
                </div>
                <p style={{ fontSize: 11, color: D.muted, lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: (s.contribution || "").slice(0, 100) + "…" }} />
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SCREEN: Games Hub
// ══════════════════════════════════════════════════════════════════════════
function GamesScreen({ observations, onAcuityEarned }) {
  const [activeGame, setActiveGame] = useState(null);
  const [score, setScore] = useState(null);

  if (activeGame === "pattern") return (
    <PatternMatchGame
      observations={observations}
      onDone={pts => { onAcuityEarned(pts); setScore(pts); setActiveGame(null); }}
      onBack={() => setActiveGame(null)}
    />
  );
  if (activeGame === "contradiction") return (
    <ContradictionGame
      observations={observations}
      onDone={pts => { onAcuityEarned(pts); setScore(pts); setActiveGame(null); }}
      onBack={() => setActiveGame(null)}
    />
  );

  return (
    <div style={{ padding: "20px 16px 120px" }}>
      <SLabel color={D.rd} style={{ marginBottom: 6 }}>COGNITIVE GAMES</SLabel>
      <h2 style={{ fontFamily: "'Unbounded',monospace", fontSize: 16, fontWeight: 900, marginBottom: 6, lineHeight: 1.3 }}>
        Train the inquiry muscle.
      </h2>
      <p style={{ fontSize: 11, color: D.muted, lineHeight: 1.7, marginBottom: 24 }}>
        Games use real observations from the community pool. Points feed your ACUITY dimension.
      </p>

      {score !== null && (
        <div style={{ background: "#16a34a", borderRadius: 12, padding: "12px 16px", marginBottom: 16, color: "#fff", display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 20 }}>✓</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>+{score} Acuity points earned</div>
            <div style={{ fontSize: 11, opacity: .8 }}>Nice work</div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[
          {
            id: "pattern",
            tier: "TIER 1",
            name: "Pattern Match",
            desc: "Find the common thread across 3 community observations.",
            color: D.bl,
            icon: "◈",
          },
          {
            id: "contradiction",
            tier: "TIER 1",
            name: "Contradiction Finder",
            desc: "Two observations side by side — name the tension between them.",
            color: D.rd,
            icon: "⇔",
          },
          {
            id: "recall",
            tier: "TIER 2",
            name: "Spaced Recall",
            desc: "A past observation reappears — name its core tension.",
            color: "#8B5E3C",
            icon: "↺",
            comingSoon: true,
          },
          {
            id: "lensshift",
            tier: "TIER 2",
            name: "Lens Shift",
            desc: "Reframe a statement through a different philosophical tradition.",
            color: "#6B4F9E",
            icon: "◎",
            comingSoon: true,
          },
        ].map(g => (
          <button key={g.id} onClick={() => !g.comingSoon && setActiveGame(g.id)} style={{
            display: "flex", gap: 14, padding: "16px", borderRadius: 14,
            border: `2px solid ${g.comingSoon ? D.border : g.color}`,
            background: g.comingSoon ? "transparent" : D.white,
            textAlign: "left", opacity: g.comingSoon ? .5 : 1,
            cursor: g.comingSoon ? "default" : "pointer",
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, flexShrink: 0,
              background: g.comingSoon ? D.bg : g.color,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, color: g.comingSoon ? D.muted : D.white,
            }}>{g.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: D.bk }}>{g.name}</div>
                <Pill color={g.color}>{g.tier}</Pill>
                {g.comingSoon && <Pill color={D.muted}>SOON</Pill>}
              </div>
              <div style={{ fontSize: 11, color: D.muted, lineHeight: 1.65 }}>{g.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Pattern Match Game ─────────────────────────────────────────────────────
function PatternMatchGame({ observations, onDone, onBack }) {
  const pool = observations.filter(o => o.text && o.text.length > 40);
  const getThree = () => {
    const shuffled = [...pool].sort(() => Math.random() - .5);
    return shuffled.slice(0, Math.min(3, shuffled.length));
  };

  const [obs] = useState(() => getThree());
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (obs.length < 2) return (
    <div style={{ padding: "20px 16px" }}>
      <p style={{ color: D.muted }}>Not enough observations yet. Complete a session first to build the pool.</p>
      <Btn onClick={onBack} style={{ marginTop: 16 }}>BACK TO GAMES</Btn>
    </div>
  );

  return (
    <div style={{ padding: "20px 16px 120px", animation: "fadeUp .4s both" }}>
      <button onClick={onBack} style={{ fontSize: 12, color: D.muted, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
        ← Back to Games
      </button>
      <SLabel color={D.bl} style={{ marginBottom: 6 }}>PATTERN MATCH</SLabel>
      <p style={{ fontSize: 12, color: D.muted, lineHeight: 1.7, marginBottom: 20 }}>
        Read these observations from the community pool. What thread runs through all of them?
      </p>

      {obs.map((o, i) => (
        <Card key={o.id || i} style={{ marginBottom: 12 }}>
          <div style={{ padding: "6px 14px", background: lensColor(o.lens) + "18", borderBottom: `1px solid ${D.border}` }}>
            <SLabel color={lensColor(o.lens)} style={{ fontSize: 7 }}>{o.lens?.toUpperCase()}</SLabel>
          </div>
          <div style={{ padding: "14px 16px" }}>
            <p style={{ fontSize: 13, lineHeight: 1.75, fontStyle: "italic" }}>"{o.text}"</p>
          </div>
        </Card>
      ))}

      {!submitted ? (
        <>
          <SLabel style={{ marginBottom: 8, marginTop: 4 }}>NAME THE COMMON THREAD</SLabel>
          <div style={{
            background: D.white, borderRadius: 14, border: `1.5px solid ${D.border}`,
            padding: "14px", marginBottom: 16,
          }}>
            <textarea value={answer} onChange={e => setAnswer(e.target.value)}
              placeholder="What do all three observations share? Look for a tension, theme, or underlying question…"
              rows={4} style={{ fontSize: 13, lineHeight: 1.75, width: "100%" }} />
          </div>
          <Btn primary disabled={answer.trim().length < 15} onClick={() => setSubmitted(true)}>
            SUBMIT PATTERN
          </Btn>
        </>
      ) : (
        <Card style={{ border: `2px solid #16a34a`, marginTop: 4 }}>
          <div style={{ padding: "16px" }}>
            <SLabel color="#16a34a" style={{ marginBottom: 10 }}>YOUR PATTERN</SLabel>
            <p style={{ fontSize: 13, lineHeight: 1.75, marginBottom: 16, fontStyle: "italic" }}>"{answer}"</p>
            <p style={{ fontSize: 11, color: D.muted, lineHeight: 1.7, marginBottom: 16 }}>
              There's no single correct answer — the act of finding patterns across diverse observations builds the inquiry muscle.
            </p>
            <Btn primary onClick={() => onDone(15)}>CLAIM +15 ACUITY PTS</Btn>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Contradiction Finder Game ──────────────────────────────────────────────
function ContradictionGame({ observations, onDone, onBack }) {
  const pool = observations.filter(o => o.text && o.text.length > 40);
  const getTwo = () => {
    const shuffled = [...pool].sort(() => Math.random() - .5);
    return shuffled.slice(0, Math.min(2, shuffled.length));
  };

  const [obs] = useState(() => getTwo());
  const [tension, setTension] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (obs.length < 2) return (
    <div style={{ padding: "20px 16px" }}>
      <p style={{ color: D.muted }}>Need at least 2 observations. Complete a session first.</p>
      <Btn onClick={onBack} style={{ marginTop: 16 }}>BACK TO GAMES</Btn>
    </div>
  );

  return (
    <div style={{ padding: "20px 16px 120px", animation: "fadeUp .4s both" }}>
      <button onClick={onBack} style={{ fontSize: 12, color: D.muted, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
        ← Back to Games
      </button>
      <SLabel color={D.rd} style={{ marginBottom: 6 }}>CONTRADICTION FINDER</SLabel>
      <p style={{ fontSize: 12, color: D.muted, lineHeight: 1.7, marginBottom: 20 }}>
        These two observations come from different traditions. Where do they pull against each other?
      </p>

      {obs.map((o, i) => (
        <Card key={o.id || i} style={{ marginBottom: 12 }}>
          <div style={{ padding: "6px 14px", background: lensColor(o.lens) + "18", borderBottom: `1px solid ${D.border}`, display: "flex", justifyContent: "space-between" }}>
            <SLabel color={lensColor(o.lens)} style={{ fontSize: 7 }}>{o.lens?.toUpperCase()}</SLabel>
            <SLabel color={D.muted} style={{ fontSize: 7 }}>OBSERVATION {i + 1}</SLabel>
          </div>
          <div style={{ padding: "14px 16px" }}>
            <p style={{ fontSize: 13, lineHeight: 1.75, fontStyle: "italic" }}>"{o.text}"</p>
          </div>
        </Card>
      ))}

      {!submitted ? (
        <>
          <SLabel style={{ marginBottom: 8, marginTop: 4 }}>NAME THE TENSION</SLabel>
          <div style={{
            background: D.white, borderRadius: 14, border: `1.5px solid ${D.border}`,
            padding: "14px", marginBottom: 16,
          }}>
            <textarea value={tension} onChange={e => setTension(e.target.value)}
              placeholder="Where do these two observations pull against each other? What assumption does each one make that the other would challenge?"
              rows={4} style={{ fontSize: 13, lineHeight: 1.75, width: "100%" }} />
          </div>
          <Btn primary disabled={tension.trim().length < 20} onClick={() => setSubmitted(true)}>
            NAME THE CONTRADICTION
          </Btn>
        </>
      ) : (
        <Card style={{ border: `2px solid #16a34a`, marginTop: 4 }}>
          <div style={{ padding: "16px" }}>
            <SLabel color="#16a34a" style={{ marginBottom: 10 }}>TENSION NAMED</SLabel>
            <p style={{ fontSize: 13, lineHeight: 1.75, marginBottom: 16, fontStyle: "italic" }}>"{tension}"</p>
            <p style={{ fontSize: 11, color: D.muted, lineHeight: 1.7, marginBottom: 16 }}>
              Holding two contradictory truths without collapsing them is one of the highest cognitive capacities.
            </p>
            <Btn primary onClick={() => onDone(20)}>CLAIM +20 ACUITY PTS</Btn>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Throne Talk History ───────────────────────────────────────────────────
function ThroneHistoryScreen({ sessions, observations }) {
  const [selected, setSelected] = useState(null);

  const sorted = [...sessions].sort((a, b) => b.timestamp - a.timestamp);

  // Group by YYYY-MM
  const groups = {};
  for (const s of sorted) {
    const mo = s.date?.slice(0, 7) || "unknown";
    if (!groups[mo]) groups[mo] = [];
    groups[mo].push(s);
  }
  const months = Object.keys(groups).sort().reverse();
  const fmtMonth = m => {
    const [y, mo] = m.split("-");
    return new Date(+y, +mo - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase();
  };

  const ratingLabels = DEPTH_RATINGS.reduce((acc, r) => { acc[r.value] = r.label; return acc; }, {});

  if (selected) {
    const obs = observations.find(o => o.id === selected.reviewedObsId);
    const d = new Date((selected.date || "") + "T12:00:00");
    return (
      <div style={{ padding: "0 0 20px" }}>
        <div style={{ background: D.bk, padding: "14px 16px 20px" }}>
          <button onClick={() => setSelected(null)}
            style={{ fontFamily: "'Unbounded',monospace", fontSize: 9, color: D.yl, fontWeight: 700, letterSpacing: ".1em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            ← HISTORY
          </button>
          <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 8, color: "#555", letterSpacing: ".12em", marginBottom: 4 }}>SESSION</div>
          <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 16, fontWeight: 900, color: D.white, lineHeight: 1.3 }}>
            {d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toUpperCase()}
          </div>
        </div>
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {selected.contribution && (
            <div style={{ background: D.white, borderRadius: 16, border: `1px solid ${D.border}`, padding: "16px" }}>
              <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 7, fontWeight: 700, color: D.muted, letterSpacing: ".12em", marginBottom: 8 }}>MY CONTRIBUTION</div>
              <p style={{ fontSize: 14, lineHeight: 1.8, color: D.bk, fontStyle: "italic" }}>"{selected.contribution}"</p>
            </div>
          )}
          {selected.reviewReflection && (
            <div style={{ background: D.white, borderRadius: 16, border: `1px solid ${D.border}`, padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 7, fontWeight: 700, color: D.muted, letterSpacing: ".12em" }}>REFLECTION</div>
                {selected.reviewRating && (
                  <span style={{ fontFamily: "'Unbounded',monospace", fontSize: 8, color: D.yl, fontWeight: 700 }}>
                    {ratingLabels[selected.reviewRating] || selected.reviewRating}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.75, color: D.bk }}>{selected.reviewReflection}</p>
            </div>
          )}
          {obs && (
            <div style={{ background: D.bg, borderRadius: 16, border: `1px solid ${D.border}`, padding: "16px" }}>
              <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 7, fontWeight: 700, color: D.muted, letterSpacing: ".12em", marginBottom: 8 }}>REVIEWED OBSERVATION</div>
              <p style={{ fontSize: 12, lineHeight: 1.7, color: D.muted, fontStyle: "italic" }}>"{obs.text}"</p>
              {obs.lens && <div style={{ marginTop: 6, fontSize: 9, color: D.muted }}>{obs.lens}</div>}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 0 20px" }}>
      <div style={{ background: D.bk, padding: "18px 16px 22px" }}>
        <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 8, color: "#555", letterSpacing: ".12em", marginBottom: 4 }}>THRONE TALK</div>
        <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 22, fontWeight: 900, color: D.white, lineHeight: 1.1 }}>
          {sessions.length}<br /><span style={{ fontSize: 11, fontWeight: 400, color: "#555" }}>SESSIONS</span>
        </div>
      </div>

      <div style={{ padding: "8px 16px" }}>
        {months.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 16px", color: D.muted, fontSize: 13 }}>
            No sessions yet. Start a session from the Session tab.
          </div>
        )}
        {months.map(mo => (
          <div key={mo}>
            <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 7, fontWeight: 700, color: D.muted, letterSpacing: ".12em", marginTop: 18, marginBottom: 10 }}>{fmtMonth(mo)}</div>
            {groups[mo].map(session => {
              const d = new Date((session.date || "") + "T12:00:00");
              const dayNum = d.getDate();
              const dayName = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
              const preview = session.contribution?.slice(0, 80) || "";
              return (
                <button key={session.id} onClick={() => setSelected(session)}
                  style={{ width: "100%", background: D.white, borderRadius: 16, marginBottom: 8, border: `1px solid ${D.border}`, boxShadow: `0 2px 10px ${D.shadow}`, display: "flex", alignItems: "stretch", overflow: "hidden", cursor: "pointer", textAlign: "left" }}>
                  {/* Date badge */}
                  <div style={{ background: D.bk, width: 60, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "12px 4px" }}>
                    <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 22, fontWeight: 900, color: D.yl, lineHeight: 1 }}>{isNaN(dayNum) ? "?" : dayNum}</div>
                    <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 7, fontWeight: 700, color: "#555", marginTop: 3 }}>{dayName}</div>
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, padding: "12px 14px", minWidth: 0 }}>
                    {preview && <p style={{ fontSize: 12, fontWeight: 600, color: D.bk, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>"{preview}{session.contribution?.length > 80 ? "…" : ""}"</p>}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {session.reviewRating && <span style={{ fontSize: 9, color: D.yl, fontFamily: "'Unbounded',monospace", fontWeight: 700 }}>{ratingLabels[session.reviewRating] || session.reviewRating}</span>}
                      {session.reviewReflection && <span style={{ fontSize: 10, color: D.muted }}>Has reflection</span>}
                      {session.duration && <span style={{ fontSize: 9, color: D.muted }}>{session.duration}min</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", paddingRight: 14 }}>
                    <span style={{ fontSize: 16, color: D.border }}>›</span>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN: ThroneTalk
// ══════════════════════════════════════════════════════════════════════════
export function ThroneTalk() {
  const [user, setUser] = useState(() => loadUser());
  const [observations, setObservations] = useState(() => loadObservations());
  const [sessions, setSessions] = useState(() => loadSessions());
  const [tab, setTab] = useState("session");
  const [phase, setPhase] = useState("home"); // home | review | contribute | synthesis
  const [sessionData, setSessionData] = useState(null);
  const [reviewedObs, setReviewedObs] = useState(null);

  const weekQuestion = getCurrentQuestion();

  // Persist user
  useEffect(() => { TT.set("user", user); }, [user]);
  useEffect(() => { TT.set("observations", observations); }, [observations]);
  useEffect(() => { TT.set("sessions", sessions); }, [sessions]);

  function updateUser(patch) {
    setUser(u => ({ ...u, ...patch }));
  }

  function updatePoints(patch) {
    setUser(u => ({
      ...u,
      points: { ...u.points, ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, (u.points[k] || 0) + v])) },
    }));
  }

  function pickReviewObservation() {
    const diffLens = observations.filter(o => o.lens !== user.lens && o.text);
    const pool = diffLens.length > 0 ? diffLens : observations.filter(o => o.text);
    if (!pool.length) return SEED_OBSERVATIONS[0];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function handleBeginSession() {
    const obs = pickReviewObservation();
    setReviewedObs(obs);
    setPhase("review");
    setTab("session");
  }

  function handleReviewComplete(rating, reflection) {
    setSessionData({ rating, reflection, reviewObservation: reviewedObs });
    // Award engagement points for reviewing
    updatePoints({ engagement: 5 });
    setPhase("contribute");
  }

  function handleContributeComplete(text) {
    const today = new Date().toISOString().slice(0, 10);
    const newSession = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      date: today,
      weekId: getCurrentWeekId(),
      reviewedObsId: reviewedObs?.id,
      reviewRating: sessionData?.rating,
      reviewReflection: sessionData?.reflection,
      contribution: text,
      duration: 7,
    };

    // Add observation to pool
    if (text.trim().length > 30) {
      const newObs = {
        id: crypto.randomUUID(),
        text: text.trim(),
        lens: user.lens || "Secular/Explorer",
        promptCategory: getDayCategories()[0],
        weekId: getCurrentWeekId(),
        depthRatings: [],
        timestamp: Date.now(),
      };
      setObservations(prev => [...prev, newObs]);
    }

    setSessions(prev => [...prev, newSession]);
    setSessionData(s => ({ ...s, contribution: text, weekQuestion: weekQuestion.text, reviewObservation: reviewedObs?.text }));
    setPhase("synthesis");
    updatePoints({ engagement: 10, clarity: 5 });
  }

  function handleSynthesisDone(synthesis, token, markComplete) {
    if (token && token !== user.token) updateUser({ token });
    if (markComplete) {
      const today = new Date().toISOString().slice(0, 10);
      const streak = updateStreak(user, today);
      updateUser({
        sessionDoneToday: true,
        lastSessionDate: today,
        totalSessions: (user.totalSessions || 0) + 1,
        streak,
      });
    }
    setPhase("home");
    setTab("session");
  }

  function updateStreak(u, today) {
    if (!u.lastSessionDate) return 1;
    const last = new Date(u.lastSessionDate);
    const todayDate = new Date(today);
    const diff = Math.round((todayDate - last) / 86400000);
    if (diff === 1) return (u.streak || 0) + 1;
    if (diff === 0) return u.streak || 1;
    return 1;
  }

  function handleLensSelect(lens) {
    updateUser({ lens });
    setTab("session");
    setPhase("home");
  }

  function handleAcuityEarned(pts) {
    updatePoints({ acuity: pts });
  }

  // If no lens selected, show lens selector
  if (!user.lens && phase === "home") {
    return (
      <AppShell tab={tab} setTab={setTab} showTabBar={false}>
        <LensSelectScreen onSelect={handleLensSelect} />
      </AppShell>
    );
  }

  return (
    <AppShell tab={tab} setTab={t => { setTab(t); if (t === "session") setPhase("home"); }}>
      {tab === "session" && phase === "home" && (
        <HomeScreen
          user={user}
          weekQuestion={weekQuestion}
          onBeginSession={handleBeginSession}
          onChangeLens={() => updateUser({ lens: null })}
        />
      )}
      {tab === "session" && phase === "review" && reviewedObs && (
        <ReviewScreen
          observation={reviewedObs}
          userLens={user.lens}
          onComplete={handleReviewComplete}
        />
      )}
      {tab === "session" && phase === "contribute" && (
        <ContributeScreen
          weekQuestion={weekQuestion}
          userLevel={getLevelForPoints(getTotalPoints(user.points))}
          onComplete={handleContributeComplete}
        />
      )}
      {tab === "session" && phase === "synthesis" && sessionData && (
        <SynthesisScreen
          sessionData={sessionData}
          user={user}
          onDone={handleSynthesisDone}
        />
      )}
      {tab === "games" && (
        <GamesScreen observations={observations} onAcuityEarned={handleAcuityEarned} />
      )}
      {tab === "dashboard" && (
        <DashboardScreen user={user} sessions={sessions} />
      )}
      {tab === "history" && (
        <ThroneHistoryScreen sessions={sessions} observations={observations} />
      )}
    </AppShell>
  );
}

// ── App shell with sticky top tab bar ─────────────────────────────────────
function AppShell({ children, tab, setTab, showTabBar = true }) {
  const tabs = [
    { id: "session",   icon: "◎",  label: "SESSION"  },
    { id: "games",     icon: "◈",  label: "GAMES"    },
    { id: "dashboard", icon: "◧",  label: "PROFILE"  },
    { id: "history",   icon: "📜", label: "HISTORY"  },
  ];

  return (
    <div style={{ minHeight: "100%" }}>
      {showTabBar && (
        <div style={{
          position: "sticky", top: 0, zIndex: 10,
          background: "rgba(240,237,229,0.97)", backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: `1px solid ${D.border}`,
          display: "flex", height: 56,
        }}>
          {tabs.map(t => {
            const active = t.id === tab;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 2,
                borderBottom: active ? `2px solid ${D.bk}` : "2px solid transparent",
                transition: "border-color .2s",
              }}>
                <span style={{ fontSize: 18, lineHeight: 1, opacity: active ? 1 : .35, transition: "opacity .2s" }}>
                  {t.icon}
                </span>
                <span style={{
                  fontFamily: "'Unbounded',monospace", fontSize: 6, letterSpacing: ".08em", fontWeight: 700,
                  color: active ? D.bk : D.muted, transition: "color .2s",
                }}>{t.label}</span>
              </button>
            );
          })}
        </div>
      )}
      <div>
        {children}
      </div>
    </div>
  );
}
