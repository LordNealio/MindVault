import { useState, useEffect } from "react";

// ── Design tokens ─────────────────────────────────────────
const D = {
  bg: "#F0EDE5", surf: "#FAFAF7", bk: "#0A0A0A",
  border: "#E8E4DA", muted: "#9B9589", txt: "#0A0A0A",
  yl: "#E8B84B", r: 14,
};

// ── AI call (Anthropic) ───────────────────────────────────
const MODEL = "claude-sonnet-4-6";
async function aiCall(apiKey, system, userMsg, maxTokens = 380) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL, max_tokens: maxTokens, system,
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if (!r.ok) throw new Error(await r.text());
  const d = await r.json();
  return d.content?.[0]?.text || "";
}

// ── Mode definitions ──────────────────────────────────────
const MODES = [
  {
    id: "cant_start",    label: "I can't start",        icon: "🧱",
    color: "#E8B84B",    desc: "You know what you need to do but you can't begin.",
  },
  {
    id: "fog",           label: "My brain feels foggy", icon: "🌫️",
    color: "#5B8AF0",    desc: "Low energy. Scattered. Out of it.",
  },
  {
    id: "avoiding",      label: "I'm avoiding something", icon: "🔮",
    color: "#9B72F0",    desc: "You know what it is. You keep not doing it.",
  },
  {
    id: "dump",          label: "I need to sort my thoughts", icon: "🗂️",
    color: "#3DD68C",    desc: "Too much in your head. Unclear where to start.",
  },
  {
    id: "urgency",       label: "I need urgency",       icon: "⚡",
    color: "#FF5555",    desc: "Drifting. You need to feel the pressure.",
  },
  {
    id: "slide",         label: "I just finished step one", icon: "🎯",
    color: "#22C55E",    desc: "You did something. Keep the momentum going.",
  },
];

// ── Question flows ────────────────────────────────────────
const QUESTIONS = {
  cant_start: [
    { type:"text",    q:"What's the one thing you're supposed to be doing right now?", placeholder:"e.g. finish the report, send the email…" },
    { type:"options", q:"How long has this been sitting?", opts:["Less than an hour","A few hours","More than a day","Way too long"] },
  ],
  fog: [
    { type:"yn", q:"Are you physically comfortable right now?" },
    { type:"yn", q:"Did you eat or drink something in the last 2 hours?" },
    { type:"yn", q:"Is your phone in your hand or on your lap?" },
  ],
  avoiding: [
    { type:"text",    q:"What are you avoiding? Name it plainly.", placeholder:"e.g. sending that email, starting the project…" },
    { type:"options", q:"Why does it feel heavy?", opts:["I don't know where to start","I might fail or do it wrong","I just don't want to","It involves someone else"] },
  ],
  dump: [
    { type:"textarea", q:"Everything on your mind right now — dump it all here. Don't filter.", placeholder:"Work tasks, worries, random to-dos, things you're forgetting…" },
  ],
  urgency: [
    { type:"text", q:"What task do you need to start?", placeholder:"Be specific." },
    { type:"text", q:"When does it actually need to be done?", placeholder:"e.g. tomorrow 9am, end of week…" },
  ],
  slide: [
    { type:"text", q:"What did you just finish?", placeholder:"Even if it was tiny." },
    { type:"text", q:"What's the next thing after that?", placeholder:"Or type 'not sure'" },
  ],
};

// ── System prompts ────────────────────────────────────────
function buildPrompt(modeId, answers, memCtx="") {
  const mem = memCtx
    ? `\n\nUSER'S RECENT JOURNAL HISTORY (last 21 days):\n${memCtx}\n\nIf directly relevant, subtly reference their actual patterns (recurring tasks, emotional themes, past avoidances). Do not announce that you have this data. If not relevant, ignore it.`
    : "";

  const rules = `You are a calm, practical task-initiation guide. Not a therapist. Not a motivational speaker.
Rules:
- Never shame or pressure.
- Never give a list of steps.
- Give ONE next physical action.
- 3 to 5 sentences maximum. Plain text only. No markdown.
- Start with the body, not the brain.${mem}`;

  if (modeId === "cant_start") return `${rules}

The user cannot start: "${answers[0]}". It has been sitting: "${answers[1]}".
Give them one physical action they can do in 60 seconds to begin — something concrete, body-based. Not "try your best" — an actual motion. Example structure: "Stand up. Walk to [place]. Open [thing]. Do one [sentence/click/line]."`;

  if (modeId === "fog") return `${rules}

User is foggy. Comfortable: ${answers[0]}. Ate recently: ${answers[1]}. Phone in hand: ${answers[2]}.
Tell them exactly: where to put their phone, where to sit or stand, and what physical object to touch first.
End with one action to take in the next 30 seconds. Be specific about placement.`;

  if (modeId === "avoiding") return `${rules}

User is avoiding: "${answers[0]}". Reason: "${answers[1]}".
In one sentence, name the avoidance pattern (not the task, the pattern).
Then give them a 50% easier version of the very first step — not encouragement, just a smaller action.`;

  if (modeId === "dump") return `${rules}

User's brain dump: "${answers[0]}".
Read the list. Identify the ONE task that matters most today based on urgency and impact.
Name it clearly. Then define what "done" means in one plain sentence. Then give the first physical action.`;

  if (modeId === "urgency") return `${rules}

Task: "${answers[0]}". Due: "${answers[1]}".
Show the realistic (not catastrophizing, not fake) cost of waiting 2 more hours — concrete and personal.
Then give a start time: "Start at [specific time]." No guilt. No threats. Just the real cost.`;

  if (modeId === "slide") return `${rules}

User just completed: "${answers[0]}". Next step might be: "${answers[1]}".
Give them the NEXT action — but make it easier than what they just did.
Build a slide, not a ladder. The goal is momentum, not effort. Almost too easy.`;

  return rules;
}

// ── Offline fallbacks ─────────────────────────────────────
const FALLBACKS = {
  cant_start: "Stand up from wherever you are. Walk to the place where you do this work. Sit down and open exactly one thing related to the task — a document, a tab, a notebook. Don't start yet. Just open it. That's your only job right now.",
  fog: "Put your phone face-down somewhere you can't see the screen. Get something to drink — water, anything. Sit where you have a flat surface in front of you. Place both hands flat on that surface for five seconds. Now read one item from your task list out loud. That is step one.",
  avoiding: "You're not avoiding the task — you're avoiding the feeling of starting it. Those are different things. The task takes minutes. The dread has been running for hours. Open the file, the message, or the page. Sit with it for 60 seconds without doing anything. Just look at it.",
  dump: "Of everything you listed, pick the one thing you'd feel most relieved about if it were done today. Write just that one thing on a blank note. Everything else can wait until after. Define what done looks like — what will be different when it's complete. Now take the first physical step.",
  urgency: "You have been drifting and you already know what it is costing you. Set a timer for 25 minutes right now. Before it ends, do one concrete piece of this task — rough draft, outline, five sentences. The version that exists, even imperfect, is already worth more than the version still in your head.",
  slide: "You moved. That matters more than it feels like right now. The next step should be smaller than what you just did — not bigger. Find the lightest possible continuation. One sentence, one reply, one more line. Stay in motion.",
};

// ── Pulsing loader ────────────────────────────────────────
function PulseLoader({ color }) {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    const id = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 400);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ fontFamily:"'Unbounded',monospace", fontSize:11, fontWeight:700,
      color, letterSpacing:".14em" }}>
      THINKING{dots}
    </div>
  );
}

// ── Response card ─────────────────────────────────────────
function ResponseCard({ mode, text, onDone, onBack }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", padding:"28px 20px" }}>
      {/* Badge */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:28 }}>
        <div style={{ width:44, height:44, borderRadius:12,
          background: mode.color + "22", border:`2px solid ${mode.color}`,
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>
          {mode.icon}
        </div>
        <div>
          <div style={{ fontFamily:"'Unbounded',monospace", fontSize:7, fontWeight:700,
            color:mode.color, letterSpacing:".14em" }}>{mode.label.toUpperCase()}</div>
          <div style={{ fontFamily:"'Unbounded',monospace", fontSize:8,
            color:D.muted, letterSpacing:".08em", marginTop:2 }}>YOUR NEXT MOVE</div>
        </div>
      </div>

      {/* Response */}
      <div style={{ flex:1 }}>
        <div style={{
          fontSize:15, lineHeight:1.85, color:D.bk, fontWeight:500,
          borderLeft:`4px solid ${mode.color}`, paddingLeft:18,
          letterSpacing:".01em",
        }}>
          {text}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:28 }}>
        <button onClick={onDone} style={{
          padding:"14px", borderRadius:12, border:"none",
          background:mode.color, color:D.bk,
          fontFamily:"'Unbounded',monospace", fontSize:9,
          fontWeight:700, letterSpacing:".08em", cursor:"pointer",
        }}>
          ✓ DONE — WHAT'S NEXT?
        </button>
        <button onClick={onBack} style={{
          padding:"12px", borderRadius:12,
          border:`1.5px solid ${D.border}`, background:"transparent",
          fontSize:11, color:D.muted, cursor:"pointer",
        }}>
          Back to menu
        </button>
      </div>
    </div>
  );
}

// ── Main StartMode component ──────────────────────────────
export function StartMode({ apiKey, memoryContext="", onClose }) {
  const [phase, setPhase]               = useState("select");
  const [mode, setMode]                 = useState(null);
  const [answers, setAnswers]           = useState([]);
  const [qIdx, setQIdx]                 = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [response, setResponse]         = useState("");
  const [error, setError]               = useState(null);

  const questions  = mode ? (QUESTIONS[mode.id] || []) : [];
  const currentQ   = questions[qIdx];
  const progressPct = questions.length ? (qIdx / questions.length) * 100 : 0;

  async function generateResponse(modeId, allAnswers) {
    setPhase("loading");
    setError(null);
    try {
      let text;
      if (apiKey) {
        const system = buildPrompt(modeId, allAnswers, memoryContext);
        text = await aiCall(apiKey, system, "Give me my next move.", 420);
      } else {
        await new Promise(r => setTimeout(r, 800));
        text = FALLBACKS[modeId] || FALLBACKS.cant_start;
      }
      setResponse(text.trim());
      setPhase("response");
    } catch {
      setError("Couldn't reach AI — using offline mode.");
      setResponse(FALLBACKS[modeId] || FALLBACKS.cant_start);
      setPhase("response");
    }
  }

  function selectMode(m) {
    setMode(m);
    setAnswers([]);
    setQIdx(0);
    setCurrentAnswer("");
    setPhase("questions");
  }

  function submitAnswer(answer) {
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);
    setCurrentAnswer("");
    if (qIdx + 1 < questions.length) {
      setQIdx(i => i + 1);
    } else {
      generateResponse(mode.id, newAnswers);
    }
  }

  function handleDone() {
    const slideMode = MODES.find(m => m.id === "slide");
    setMode(slideMode);
    setAnswers([]);
    setQIdx(0);
    setCurrentAnswer("");
    setPhase("questions");
  }

  // ── SELECT ──────────────────────────────────────────────
  if (phase === "select") {
    return (
      <div style={{ display:"flex", flexDirection:"column", height:"100%",
        padding:"24px 16px 20px" }}>
        <div style={{ marginBottom:20 }}>
          <div style={{ fontFamily:"'Unbounded',monospace", fontSize:22, fontWeight:900,
            color:D.bk, lineHeight:1.1, marginBottom:8 }}>
            WHERE<br/>ARE YOU?
          </div>
          <p style={{ fontSize:12, color:D.muted, lineHeight:1.6 }}>
            Pick the mode that fits right now. No wrong answer.
          </p>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:8, flex:1, overflowY:"auto" }}>
          {MODES.map(m => (
            <button key={m.id} onClick={() => selectMode(m)} style={{
              display:"flex", alignItems:"center", gap:14,
              padding:"13px 14px", borderRadius:14,
              background:D.surf, border:`1.5px solid ${D.border}`,
              textAlign:"left", cursor:"pointer", flexShrink:0,
            }}>
              <span style={{ fontSize:22, flexShrink:0, lineHeight:1 }}>{m.icon}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:13, color:D.bk, lineHeight:1.3 }}>
                  {m.label}
                </div>
                <div style={{ fontSize:10, color:D.muted, marginTop:2, lineHeight:1.4 }}>
                  {m.desc}
                </div>
              </div>
              <div style={{ width:8, height:8, borderRadius:"50%",
                background:m.color, flexShrink:0 }}/>
            </button>
          ))}
        </div>

        <button onClick={onClose} style={{
          marginTop:14, padding:"12px", borderRadius:10,
          border:`1px solid ${D.border}`, background:"transparent",
          fontSize:11, color:D.muted, cursor:"pointer",
        }}>
          Never mind
        </button>
      </div>
    );
  }

  // ── QUESTIONS ────────────────────────────────────────────
  if (phase === "questions" && currentQ) {
    const modeColor = mode.color;
    return (
      <div style={{ display:"flex", flexDirection:"column", height:"100%",
        padding:"20px 16px" }}>
        {/* Progress bar */}
        <div style={{ height:3, background:D.border, borderRadius:2,
          marginBottom:20, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${progressPct}%`,
            background:modeColor, borderRadius:2, transition:"width .3s ease" }}/>
        </div>

        {/* Mode chip */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:22 }}>
          <span style={{ fontSize:18 }}>{mode.icon}</span>
          <div style={{ fontFamily:"'Unbounded',monospace", fontSize:7,
            fontWeight:700, color:modeColor, letterSpacing:".12em" }}>
            {mode.label.toUpperCase()}
          </div>
        </div>

        {/* Question */}
        <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
          <div style={{ fontSize:16, fontWeight:700, color:D.bk,
            lineHeight:1.5, marginBottom:20 }}>
            {currentQ.q}
          </div>

          {/* YES / NO */}
          {currentQ.type === "yn" && (
            <div style={{ display:"flex", gap:12 }}>
              {["Yes","No"].map(opt => (
                <button key={opt} onClick={() => submitAnswer(opt)} style={{
                  flex:1, padding:"16px", borderRadius:12,
                  border:`2px solid ${opt==="Yes" ? modeColor : D.border}`,
                  background: opt==="Yes" ? modeColor+"1A" : D.surf,
                  fontSize:13, fontWeight:700, cursor:"pointer",
                  color: opt==="Yes" ? modeColor : D.muted,
                }}>
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* OPTIONS */}
          {currentQ.type === "options" && (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {currentQ.opts.map(opt => (
                <button key={opt} onClick={() => submitAnswer(opt)} style={{
                  padding:"13px 16px", borderRadius:12, textAlign:"left",
                  border:`1.5px solid ${D.border}`, background:D.surf,
                  fontSize:12, color:D.bk, cursor:"pointer",
                }}>
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* SHORT TEXT */}
          {currentQ.type === "text" && (
            <div>
              <input
                autoFocus
                value={currentAnswer}
                onChange={e => setCurrentAnswer(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && currentAnswer.trim())
                    submitAnswer(currentAnswer.trim());
                }}
                placeholder={currentQ.placeholder}
                style={{
                  width:"100%", boxSizing:"border-box",
                  padding:"13px 14px", borderRadius:10,
                  border:`1.5px solid ${D.border}`, fontSize:13,
                  color:D.bk, background:D.surf, outline:"none",
                  fontFamily:"inherit",
                }}
              />
              <button
                onClick={() => currentAnswer.trim() && submitAnswer(currentAnswer.trim())}
                disabled={!currentAnswer.trim()}
                style={{
                  width:"100%", marginTop:10, padding:"13px",
                  borderRadius:10, border:"none",
                  background: currentAnswer.trim() ? modeColor : D.border,
                  color: currentAnswer.trim() ? D.bk : D.muted,
                  fontFamily:"'Unbounded',monospace", fontSize:9,
                  fontWeight:700, letterSpacing:".08em",
                  cursor: currentAnswer.trim() ? "pointer" : "not-allowed",
                }}>
                CONTINUE →
              </button>
            </div>
          )}

          {/* TEXTAREA (brain dump) */}
          {currentQ.type === "textarea" && (
            <div>
              <textarea
                autoFocus
                value={currentAnswer}
                onChange={e => setCurrentAnswer(e.target.value)}
                placeholder={currentQ.placeholder}
                rows={5}
                style={{
                  width:"100%", boxSizing:"border-box",
                  padding:"13px 14px", borderRadius:10,
                  border:`1.5px solid ${D.border}`, fontSize:12,
                  color:D.bk, background:D.surf, outline:"none",
                  fontFamily:"inherit", resize:"none", lineHeight:1.65,
                }}
              />
              <button
                onClick={() => currentAnswer.trim() && submitAnswer(currentAnswer.trim())}
                disabled={!currentAnswer.trim()}
                style={{
                  width:"100%", marginTop:10, padding:"13px",
                  borderRadius:10, border:"none",
                  background: currentAnswer.trim() ? modeColor : D.border,
                  color: currentAnswer.trim() ? D.bk : D.muted,
                  fontFamily:"'Unbounded',monospace", fontSize:9,
                  fontWeight:700, letterSpacing:".08em",
                  cursor: currentAnswer.trim() ? "pointer" : "not-allowed",
                }}>
                SORT THIS →
              </button>
            </div>
          )}
        </div>

        <button onClick={() => setPhase("select")} style={{
          marginTop:14, padding:"10px", fontSize:11,
          color:D.muted, background:"none", border:"none", cursor:"pointer",
        }}>
          ← Back
        </button>
      </div>
    );
  }

  // ── LOADING ──────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
        justifyContent:"center", height:"100%", gap:16, padding:24 }}>
        <div style={{ fontSize:44 }}>{mode.icon}</div>
        <PulseLoader color={mode.color}/>
        <p style={{ fontSize:11, color:D.muted, textAlign:"center", lineHeight:1.6, maxWidth:240 }}>
          Finding your next move
        </p>
      </div>
    );
  }

  // ── RESPONSE ─────────────────────────────────────────────
  if (phase === "response") {
    return (
      <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
        {error && (
          <div style={{ padding:"8px 16px", background:"#fff3cd",
            fontSize:10, color:"#856404", flexShrink:0 }}>
            {error}
          </div>
        )}
        <ResponseCard
          mode={mode}
          text={response}
          onDone={handleDone}
          onBack={() => setPhase("select")}
        />
      </div>
    );
  }

  return null;
}
