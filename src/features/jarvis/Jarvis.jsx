import { useState, useEffect, useRef } from "react";
import JSZip from "jszip";

const D = {
  bg: "#F0EDE5", white: "#FAFAF7", bl: "#1D3557", rd: "#C1121F",
  yl: "#E8B84B", bk: "#0A0A0A", muted: "#9B9589", border: "#E8E4DA",
  shadow: "rgba(0,0,0,0.08)", r: 18,
};

// ── Persistence ────────────────────────────────────────────────────────────
const J = {
  get: k => { try { const v = localStorage.getItem("j_" + k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem("j_" + k, JSON.stringify(v)); } catch {} },
};
const TT = {
  get: k => { try { const v = localStorage.getItem("tt_" + k); return v ? JSON.parse(v) : null; } catch { return null; } },
};

// ── Atoms ──────────────────────────────────────────────────────────────────
const SLabel = ({ children, color = D.rd, style = {} }) => (
  <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 8, fontWeight: 700, letterSpacing: ".14em", color, ...style }}>{children}</div>
);
const Card = ({ children, style = {} }) => (
  <div style={{ background: D.white, borderRadius: D.r, border: `1px solid ${D.border}`, boxShadow: `0 2px 12px ${D.shadow}`, overflow: "hidden", ...style }}>{children}</div>
);
const Spinner = ({ size = 16 }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", border: `2px solid ${D.border}`, borderTopColor: D.bk, animation: "spin .8s linear infinite", flexShrink: 0 }} />
);

export const VAULT_CATEGORIES = [
  { id: "self",        label: "Identity / Self-Awareness", icon: "◎", color: "#1D3557" },
  { id: "ideas",       label: "Ideas / Inspiration",       icon: "✦", color: "#E8B84B" },
  { id: "goals",       label: "Goals / Intentions",        icon: "→", color: "#2D6A4F" },
  { id: "people",      label: "People / Relationships",    icon: "◈", color: "#8B5E3C" },
  { id: "research",    label: "References / Research",     icon: "◧", color: "#5B8FA8" },
  { id: "reflections", label: "Reflections",               icon: "〜", color: "#6B4F9E" },
  { id: "other",       label: "Other",                     icon: "◻", color: "#9B9589" },
];

// ── Modes ──────────────────────────────────────────────────────────────────
const MODES = [
  {
    id: "inward",
    name: "Looking Inward",
    icon: "◎",
    color: "#1D3557",
    tagline: "Patterns, blind spots & self-analysis",
    description: "Draws on your Throne Talk sessions, vault, observations and trends to help you understand yourself more clearly.",
    insights: [
      { label: "What themes keep coming up?",      prompt: "Analyze my recent Throne Talk sessions and vault. What themes or questions keep recurring? Be specific — name the exact patterns." },
      { label: "What am I avoiding?",              prompt: "Based on everything I've written, what questions or themes do I seem to be circling but never directly facing? What's the gap between what I say and what seems to be underneath?" },
      { label: "Where's my blind spot?",           prompt: "Based on my sessions and observations, what perspective or assumption am I consistently missing? What lens would most challenge my current thinking?" },
      { label: "Connect two things for me",        prompt: "Find the most interesting or surprising connection across my vault items and sessions. What two things I've saved or written actually belong together in a way I might not have noticed?" },
      { label: "What question should I be asking?", prompt: "Based on everything I've shared, what's the most important question I haven't asked yet? The one that would most shift my thinking if I sat with it." },
      { label: "Push back on me",                  prompt: "Based on what I've written, pick my strongest or most repeated belief and steelman the opposite position. What would someone who fundamentally disagrees say — and what's right about it?" },
      { label: "Summarize my week",                prompt: "Give me a clear summary of my thinking this week across sessions and vault. What moved? What didn't? What's the headline?" },
      { label: "How am I progressing?",            prompt: "Look at my Throne Talk level, points, sessions, observations. How am I actually progressing? What's strong? What dimension needs more attention?" },
    ],
    buildSystem: (ctx) => `You are Orpheus in Looking Inward mode — a sharp, perceptive personal AI for deep self-analysis.

You have full access to everything the user has shared. Your role: surface patterns, name blind spots, connect dots, and ask the question they haven't asked themselves yet.

Tone: direct, warm, precise. Like a trusted mentor who has read everything they've written and remembers all of it.
Never be generic. Always reference their specific content. If you see a pattern, name it exactly.

${ctx}`,
  },
  {
    id: "build",
    name: "Build",
    icon: "⬡",
    color: "#2D6A4F",
    tagline: "Apps, code & software architecture",
    description: "Senior engineer mode. Architecture decisions, code review, debugging, feature planning — build anything.",
    insights: [
      { label: "Plan a new feature",        prompt: "I want to add a new feature to an app. Walk me through how to think about it — what questions to ask before writing a line of code." },
      { label: "Review my architecture",    prompt: "I'll describe my app's architecture. Give me an honest assessment — what's solid, what's fragile, what would break under real load." },
      { label: "Help me debug this",        prompt: "I have a bug I can't figure out. Ask me questions to help narrow it down." },
      { label: "Pick my tech stack",        prompt: "Help me choose a tech stack for a project. Ask me about requirements, scale, team, and timeline — then give me a direct recommendation." },
      { label: "Write a component",         prompt: "Help me design and write a React component. Ask me what it needs to do first." },
      { label: "Code review",               prompt: "I'll share some code. Give me a direct, honest review — what's good, what's bad, what would you change and why." },
      { label: "Database design",           prompt: "Help me design a data model. Ask me about the domain and access patterns, then suggest a schema." },
      { label: "Ship checklist",            prompt: "I'm about to ship something. Run me through a pre-launch checklist — what have I probably missed?" },
    ],
    buildSystem: () => `You are Orpheus in Build mode — a senior software engineer and architect.

Tone: direct, practical, opinionated. No hand-holding. Ask clarifying questions when needed. Give concrete recommendations, not wishy-washy "it depends" answers (unless it genuinely depends, in which case explain exactly what it depends on and give a default recommendation).

You know: React, Node, Python, databases (SQL + NoSQL), cloud (Vercel, AWS, GCP), mobile (React Native, Flutter), APIs, system design, security, performance.

When reviewing code or architecture, be honest. The user wants real feedback, not validation.`,
  },
  {
    id: "create",
    name: "Create",
    icon: "✦",
    color: "#C1121F",
    tagline: "Writing, ideas & creative projects",
    description: "Brainstorm, write, refine. From first ideas to finished drafts — any creative format.",
    insights: [
      { label: "Brainstorm with me",       prompt: "I want to brainstorm ideas for something. Ask me what it's for, then go wide — give me 10 genuinely different directions, not variations on one idea." },
      { label: "Help me start writing",    prompt: "I'm staring at a blank page. Ask me what I'm trying to write and why it matters, then help me find the opening line." },
      { label: "Give feedback on this",    prompt: "I'll share something I've written. Give me honest, specific feedback — what's working, what's not, and what would make it significantly better." },
      { label: "Rewrite this stronger",    prompt: "I'll give you a piece of writing. Rewrite it to be sharper, clearer, and more memorable — then explain the key changes you made." },
      { label: "Name something for me",    prompt: "Help me name something. Ask me what it is, who it's for, and what feeling it should evoke — then give me 15 options across different styles." },
      { label: "Write a pitch",            prompt: "Help me write a pitch or summary for something. Ask me the key details, then draft a version that's compelling and concise." },
      { label: "Find the story angle",     prompt: "I have something I want to communicate but I don't know what the story is. Ask me questions until we find the real narrative." },
      { label: "Push this further",        prompt: "I'll share an idea or draft. Your job: push it further than I went. What's the bolder version? What am I holding back from?" },
    ],
    buildSystem: () => `You are Orpheus in Create mode — a brilliant creative collaborator.

Tone: generative, direct, bold. You push ideas further than the user takes them. You give specific, concrete creative feedback — not "this is interesting" but "this line is weak because X, try Y instead."

You're equally good at: long-form writing, short punchy copy, naming, pitching, storytelling, brainstorming, rewriting. You have strong opinions about craft and you share them.`,
  },
  {
    id: "research",
    name: "Research",
    icon: "◧",
    color: "#5B8FA8",
    tagline: "Learn, analyze & go deep on anything",
    description: "Thorough explanations, concept breakdowns, comparative analysis — go deep on any topic.",
    insights: [
      { label: "Explain this concept",      prompt: "Explain a concept to me like I'm smart but don't have domain expertise. Ask me what the concept is and what I already know." },
      { label: "Summarize something",       prompt: "I have content I want summarized. Give me the 20% that contains 80% of the value — key points, implications, what I should actually remember." },
      { label: "Compare two things",        prompt: "Help me compare two things — frameworks, approaches, options, ideas. Ask me what they are and what decision I'm trying to make." },
      { label: "Steelman an argument",      prompt: "Take a position I'll give you and steelman it — make the strongest possible case for it, including the strongest objections and how a proponent would answer them." },
      { label: "Find the counterargument",  prompt: "I'll give you a belief or argument. Find me the most credible, well-reasoned counterargument. Not a strawman — the real challenge." },
      { label: "Map a domain for me",       prompt: "I want to understand a field I don't know well. Ask me what it is, then give me a map: key concepts, major debates, most important thinkers, what I should read first." },
      { label: "Research deep dive",        prompt: "I want a thorough analysis of something. Ask me the topic and what angle matters most, then go deep." },
      { label: "First principles breakdown", prompt: "Break something down to first principles for me. Strip away assumptions until we're at the bedrock. Ask me what to analyze." },
    ],
    buildSystem: () => `You are Orpheus in Research mode — a rigorous analytical thinker with broad knowledge.

Tone: thorough, precise, intellectually honest. You explain complex things clearly without dumbing them down. You acknowledge uncertainty. You cite your reasoning, not just your conclusions.

You're good at: conceptual explanations, comparative analysis, argument mapping, finding counterarguments, synthesizing across domains, teaching complex topics to smart non-experts.

When you don't know something, say so clearly. When something is genuinely contested, represent the debate fairly.`,
  },
  {
    id: "plan",
    name: "Plan",
    icon: "→",
    color: "#8B5E3C",
    tagline: "Goals, decisions & strategic thinking",
    description: "Work through decisions, map goals to actions, think through consequences — strategic thinking partner.",
    insights: [
      { label: "Help me decide",           prompt: "I have a decision to make and I'm stuck. Ask me what it is, what's making it hard, and what matters most — then help me think it through." },
      { label: "Break down my goal",       prompt: "I have a goal I want to achieve. Ask me what it is and by when — then break it into the specific actions that would actually move it forward." },
      { label: "Map the obstacles",        prompt: "I want to do something but keep not doing it. Ask me what it is — then help me map the real obstacles. Not the stated ones, the actual ones." },
      { label: "Second-order thinking",    prompt: "I'm considering an action or decision. Help me think through second and third-order consequences — what happens after what happens." },
      { label: "Review my priorities",     prompt: "Help me audit my priorities. Ask me what I say matters most versus where I actually spend time and energy — then surface the gap." },
      { label: "Pre-mortem this",          prompt: "I'm about to do something. Run a pre-mortem: if this fails, what are the most likely reasons? Be specific and honest." },
      { label: "Build a system for this",  prompt: "I want to be more consistent about something. Help me design a simple system — ask me what the goal is and what's gotten in the way before." },
      { label: "What would I regret?",     prompt: "Help me think through a decision using regret minimization. Ask me what I'm deciding — then walk me through it from the perspective of my future self." },
    ],
    buildSystem: (ctx) => `You are Orpheus in Plan mode — a strategic thinking partner.

Tone: direct, structured, honest. You ask clarifying questions before giving advice. You help people think clearly, not just feel better. You surface uncomfortable truths when they're relevant.

You know about: decision-making frameworks, goal-setting, habit design, cognitive biases, strategic planning, risk assessment. You don't preach about these — you apply them conversationally.

When relevant, draw on the user's context:
${ctx}`,
  },
  {
    id: "free",
    name: "Free Talk",
    icon: "💬",
    color: "#475569",
    tagline: "Open conversation — no agenda",
    description: "Talk about anything at all. No specific focus, no mode constraints. Just you and Orpheus in an open conversation.",
    insights: [
      { label: "What's on your mind?",       prompt: "I just want to talk. What should we explore?" },
      { label: "Help me think out loud",      prompt: "I have something I want to think through out loud. Can you help me work through it?" },
      { label: "Ask me something",            prompt: "Ask me something interesting — I'm open to wherever the conversation goes." },
      { label: "I need to vent",              prompt: "I need to just vent for a minute. I'm not looking for solutions right now, just someone to hear it." },
      { label: "Challenge me",               prompt: "Challenge me on something — a belief I hold, a choice I've made, or a direction I'm taking. Push back." },
      { label: "Surprise me",                prompt: "Surprise me with something interesting — a question, a concept, a perspective I probably haven't considered." },
    ],
    buildSystem: (ctx) => `You are Orpheus in free conversation mode — a curious, warm, and direct thinking partner.

There's no specific agenda here. Be genuinely present. Ask questions. Follow the thread of the conversation wherever it goes. Be honest, be direct, be human.

Tone: conversational, curious, grounded. Not formal. Not a therapist. Just an engaged, thoughtful presence.

If relevant, draw on what you know about the user:
${ctx}`,
  },
  {
    id: "remix",
    name: "Remix This App",
    icon: "⚙",
    color: "#6B4F9E",
    tagline: "Customize & download your own version",
    description: "Describe any changes you want — new features, different colors, new screens. Get a ZIP of your custom version to deploy.",
    insights: [],
    buildSystem: () => `You are Orpheus in Remix mode — you help users customize this app (MindVault / Throne Talk) and generate downloadable modified source code.

The app is a React + Vite SPA deployed on Vercel. Key files:
- src/App.jsx — main shell, tab bar, journal screens (HomeScreen, VaultScreen, SettingsScreen)
- src/features/throne-talk/ThroneTalk.jsx — Throne Talk app (5-screen inquiry loop)
- src/features/throne-talk/data.js — weekly questions, Socratic prompts, lenses, levels
- src/features/jarvis/Jarvis.jsx — this Jarvis AI assistant with 6 modes
- src/features/jarvis/VaultUpload.jsx — Context Vault upload/browse screen
- api/automation/invoke.js — server-side Claude API proxy (Vercel serverless function)
- public/manifest.json — PWA manifest
- vercel.json — deployment config

Design system (D tokens): bg:#F0EDE5, white:#FAFAF7, bl:#1D3557, rd:#C1121F, yl:#E8B84B, bk:#0A0A0A, muted:#9B9589
Fonts: 'Unbounded' (headers/labels), 'Plus Jakarta Sans' (body)
All styling is inline CSS-in-JS. No external UI libraries.

When the user describes changes:
1. Acknowledge what you understood
2. Ask clarifying questions if needed
3. When ready, respond with EXACTLY this JSON block (nothing else after it):

\`\`\`remix-changes
{
  "summary": "Plain English summary of all changes",
  "changes": [
    {
      "file": "relative/path/from/project/root",
      "description": "What changed in this file",
      "content": "COMPLETE new file content here — full file, not a diff"
    }
  ]
}
\`\`\`

Only include files that actually change. Generate complete, working file content — not snippets or diffs. The user will download these as a ZIP and deploy.`,
  },
];

// ── Context builders ───────────────────────────────────────────────────────
function buildUserContext() {
  const user = TT.get("user") || {};
  const sessions = TT.get("sessions") || [];
  const observations = TT.get("observations") || [];
  const vaultItems = J.get("vault") || [];

  const total = Object.values(user.points || {}).reduce((a, b) => a + b, 0);
  const levelNames = ["Observer", "Questioner", "Pattern Seer", "Mirror", "Witness"];
  const thresholds = [0, 150, 500, 1200, 3000];
  let lvl = 0;
  for (let i = thresholds.length - 1; i >= 0; i--) { if (total >= thresholds[i]) { lvl = i; break; } }

  const recentSessions = sessions.slice(-5).reverse();
  const userObs = observations.filter(o => !o.id?.startsWith("seed")).slice(-8);

  const vaultSummary = vaultItems.length
    ? vaultItems.map(v => `[${v.category}] "${v.title}": ${v.notes || v.content?.slice(0, 150) || ""}`).join("\n")
    : "No vault items yet.";

  const sessionSummary = recentSessions.length
    ? recentSessions.map(s => `${s.date}: "${(s.contribution || "").slice(0, 250)}"`).join("\n---\n")
    : "No sessions yet.";

  const obsSummary = userObs.length
    ? userObs.map(o => `[${o.lens}] "${o.text?.slice(0, 180)}"`).join("\n")
    : "No personal observations yet.";

  return `== USER PROFILE ==
Lens: ${user.lens || "Not set"} | Level: ${levelNames[lvl]} (${total} pts) | Streak: ${user.streak || 0}d | Sessions: ${user.totalSessions || 0}

== RECENT SESSIONS ==
${sessionSummary}

== OBSERVATIONS ==
${obsSummary}

== VAULT ==
${vaultSummary}`;
}

// ── API call ───────────────────────────────────────────────────────────────
async function callJarvis({ token, messages, system }) {
  const res = await fetch("/api/automation/invoke", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ runId: crypto.randomUUID(), model: "claude-sonnet-4-6", maxTokens: 1500, system, messages }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error("AUTH_ERROR");
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return (await res.json()).text;
}

// ── ZIP download for Remix mode ────────────────────────────────────────────
async function downloadRemixZip(changes, summary) {
  const zip = new JSZip();
  const src = zip.folder("throne-talk-remix");

  for (const change of changes) {
    src.file(change.file, change.content);
  }

  const readme = `# Your Custom Throne Talk / MindVault

${summary}

## Changed files
${changes.map(c => `- ${c.file}: ${c.description}`).join("\n")}

## How to deploy

1. Download and install dependencies:
   npm install

2. Set your environment variables in .env.local:
   ANTHROPIC_API_KEY=your_key_here
   AUTOMATION_ACCESS_TOKEN=your_token_here

3. Deploy to Vercel:
   npm install -g vercel
   vercel login
   vercel --prod --yes

Your app will be live at a unique Vercel URL within ~30 seconds.

## Local development
   vercel dev   (runs both frontend + API functions)

---
Generated by Throne Talk Remix on ${new Date().toLocaleDateString()}
`;
  src.file("DEPLOY.md", readme);

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "throne-talk-remix.zip";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Trends Dashboard ───────────────────────────────────────────────────────
function TrendsDashboard({ onClose }) {
  const sessions = TT.get("sessions") || [];
  const user = TT.get("user") || {};
  const vaultItems = J.get("vault") || [];
  const total = Object.values(user.points || {}).reduce((a, b) => a + b, 0);
  const levelNames = ["Observer", "Questioner", "Pattern Seer", "Mirror", "Witness"];
  const thresholds = [0, 150, 500, 1200, 3000];
  let lvl = 0;
  for (let i = thresholds.length - 1; i >= 0; i--) { if (total >= thresholds[i]) { lvl = i; break; } }
  const nextT = thresholds[lvl + 1] || total + 1;
  const pct = Math.min(100, ((total - thresholds[lvl]) / (nextT - thresholds[lvl])) * 100);

  const today = new Date();
  const last7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() - (6 - i)); return d.toISOString().slice(0, 10); });
  const byDay = {};
  sessions.forEach(s => { if (s.date) byDay[s.date] = (byDay[s.date] || 0) + 1; });
  const maxDay = Math.max(1, ...last7.map(d => byDay[d] || 0));

  const dims = [
    { key: "depth", label: "DEPTH", color: D.bl },
    { key: "clarity", label: "CLARITY", color: D.rd },
    { key: "engagement", label: "ENGAGE", color: "#16a34a" },
    { key: "acuity", label: "ACUITY", color: "#8B5E3C" },
  ];
  const maxDim = Math.max(1, ...dims.map(d => user.points?.[d.key] || 0));

  const catCounts = {};
  vaultItems.forEach(v => { catCounts[v.category] = (catCounts[v.category] || 0) + 1; });

  return (
    <div style={{ padding: "0 16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <SLabel>TRENDS</SLabel>
        <button onClick={onClose} style={{ fontSize: 20, color: D.muted, lineHeight: 1 }}>×</button>
      </div>
      <Card style={{ marginBottom: 10 }}>
        <div style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div><SLabel color={D.muted} style={{ marginBottom: 2 }}>LEVEL</SLabel><div style={{ fontFamily: "'Unbounded',monospace", fontSize: 15, fontWeight: 900 }}>{levelNames[lvl]}</div></div>
            <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 22, fontWeight: 900, color: D.yl }}>{total}</div>
          </div>
          <div style={{ height: 6, background: D.bg, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", background: D.yl, borderRadius: 3, width: `${pct}%` }} />
          </div>
        </div>
      </Card>
      <Card style={{ marginBottom: 10 }}>
        <div style={{ padding: "14px 16px" }}>
          <SLabel color={D.muted} style={{ marginBottom: 10 }}>DIMENSIONS</SLabel>
          {dims.map(d => {
            const val = user.points?.[d.key] || 0;
            return (
              <div key={d.key} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <SLabel color={d.color} style={{ fontSize: 7 }}>{d.label}</SLabel>
                  <span style={{ fontFamily: "'Unbounded',monospace", fontSize: 9, fontWeight: 700 }}>{val}</span>
                </div>
                <div style={{ height: 5, background: D.bg, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: d.color, borderRadius: 3, width: `${(val / maxDim) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card style={{ marginBottom: 10 }}>
        <div style={{ padding: "14px 16px" }}>
          <SLabel color={D.muted} style={{ marginBottom: 12 }}>SESSIONS — LAST 7 DAYS</SLabel>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 48 }}>
            {last7.map(date => {
              const count = byDay[date] || 0;
              const h = count === 0 ? 4 : Math.max(8, (count / maxDay) * 48);
              const day = new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
              return (
                <div key={date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", height: h, background: count > 0 ? D.bl : D.border, borderRadius: 4 }} />
                  <span style={{ fontSize: 7, color: D.muted, fontFamily: "'Unbounded',monospace" }}>{day[0]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
      {vaultItems.length > 0 && (
        <Card>
          <div style={{ padding: "14px 16px" }}>
            <SLabel color={D.muted} style={{ marginBottom: 10 }}>VAULT — {vaultItems.length} ITEMS</SLabel>
            {VAULT_CATEGORIES.filter(c => catCounts[c.id]).map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ color: c.color, fontSize: 12, width: 18 }}>{c.icon}</span>
                <span style={{ fontSize: 11, flex: 1 }}>{c.label}</span>
                <div style={{ width: Math.max(8, (catCounts[c.id] / vaultItems.length) * 72), height: 5, background: c.color, borderRadius: 3 }} />
                <span style={{ fontFamily: "'Unbounded',monospace", fontSize: 9, fontWeight: 700, color: c.color }}>{catCounts[c.id]}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return "";
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 604800) return `${Math.floor(secs / 86400)}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Mode Picker Modal ──────────────────────────────────────────────────────
function ModePickerModal({ onSelect, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
      <div style={{ position: "relative", background: D.bg, borderRadius: "20px 20px 0 0", padding: "20px 16px 40px", maxHeight: "82vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <SLabel>CHOOSE MODE</SLabel>
          <button onClick={onClose} style={{ fontSize: 22, color: D.muted, lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}>×</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {MODES.map(m => (
            <button key={m.id} onClick={() => onSelect(m)} style={{ display: "flex", alignItems: "center", gap: 14, background: D.white, border: `1px solid ${D.border}`, borderRadius: 14, padding: "14px 16px", cursor: "pointer", textAlign: "left" }}>
              <span style={{ fontSize: 22, width: 32, flexShrink: 0 }}>{m.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 11, fontWeight: 700, color: m.color, marginBottom: 3 }}>{m.name}</div>
                <div style={{ fontSize: 12, color: D.muted }}>{m.tagline}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Conversation Card ──────────────────────────────────────────────────────
function ConvCard({ conv, onSelect, onDelete }) {
  const mode = MODES.find(m => m.id === conv.modeId) || MODES[0];
  const lastMsg = conv.messages?.[conv.messages.length - 1];
  const preview = lastMsg?.content?.slice(0, 80) || "New conversation";
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 0, background: D.white, borderRadius: 14, border: `1px solid ${D.border}`, overflow: "hidden", marginBottom: 8 }}>
      <button onClick={() => onSelect(conv)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <span style={{ fontSize: 20, width: 28, flexShrink: 0 }}>{mode.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 10, fontWeight: 700, color: D.bk, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>{conv.title || mode.name}</div>
            {conv.projectTag && (
              <span style={{ fontFamily: "'Unbounded',monospace", fontSize: 7, background: mode.color, color: "#fff", borderRadius: 6, padding: "2px 6px", flexShrink: 0 }}>{conv.projectTag}</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: D.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview}</div>
        </div>
        <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 7, color: D.muted, flexShrink: 0 }}>{timeAgo(conv.updatedAt)}</div>
      </button>
      <button onClick={() => onDelete(conv.id)} style={{ background: "none", border: "none", borderLeft: `1px solid ${D.border}`, padding: "0 14px", cursor: "pointer", color: D.muted, fontSize: 16 }}>×</button>
    </div>
  );
}

// ── Conversation List (Home) ───────────────────────────────────────────────
function ConversationList({ conversations, onSelectConv, onNewConv }) {
  const [showPicker, setShowPicker] = useState(false);
  const [filter, setFilter] = useState("all");

  const projects = [...new Set(conversations.filter(c => c.projectTag).map(c => c.projectTag))];
  const filtered = filter === "all" ? conversations : conversations.filter(c => c.projectTag === filter);
  const sorted = [...filtered].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: D.bg }}>
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <SLabel>ORPHEUS</SLabel>
          <button onClick={() => setShowPicker(true)} style={{ fontFamily: "'Unbounded',monospace", fontSize: 9, fontWeight: 700, background: D.bk, color: D.yl, border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer" }}>+ NEW</button>
        </div>
        {projects.length > 0 && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10, scrollbarWidth: "none" }}>
            {["all", ...projects].map(p => (
              <button key={p} onClick={() => setFilter(p)} style={{ fontFamily: "'Unbounded',monospace", fontSize: 7, fontWeight: 700, background: filter === p ? D.bk : D.white, color: filter === p ? D.yl : D.muted, border: `1px solid ${D.border}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>
                {p === "all" ? "ALL" : p.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 100px" }}>
        {sorted.length === 0 ? (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
            <SLabel color={D.muted} style={{ marginBottom: 8 }}>NO CONVERSATIONS YET</SLabel>
            <div style={{ fontSize: 13, color: D.muted }}>Tap + NEW to start talking</div>
          </div>
        ) : (
          sorted.map(conv => (
            <ConvCard key={conv.id} conv={conv} onSelect={onSelectConv} onDelete={(id) => {
              const updated = conversations.filter(c => c.id !== id);
              J.set("conversations", updated);
              onSelectConv(null);
            }} />
          ))
        )}
      </div>
      {showPicker && <ModePickerModal onSelect={(mode) => { setShowPicker(false); onNewConv(mode); }} onClose={() => setShowPicker(false)} />}
    </div>
  );
}

// ── Conversation View (Chat) ───────────────────────────────────────────────
function ConversationView({ conversation, token, onUpdate, onBack }) {
  const mode = MODES.find(m => m.id === conversation.modeId) || MODES[0];
  const [messages, setMessages] = useState(conversation.messages || []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(conversation.title || mode.name);
  const [editingTag, setEditingTag] = useState(false);
  const [tagVal, setTagVal] = useState(conversation.projectTag || "");
  const [showRemixDownload, setShowRemixDownload] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const save = (msgs, title, tag) => {
    const updated = { ...conversation, messages: msgs, title, projectTag: tag || null, updatedAt: Date.now() };
    onUpdate(updated);
    return updated;
  };

  const send = async (text) => {
    if (!text.trim() || loading) return;
    setError(null);
    const userMsg = { role: "user", content: text.trim(), ts: Date.now() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");

    let title = titleVal;
    if (messages.length === 0 && text.trim().length > 3) {
      title = text.trim().slice(0, 40) + (text.trim().length > 40 ? "…" : "");
      setTitleVal(title);
    }

    setLoading(true);
    try {
      const ctx = buildUserContext();
      const system = mode.buildSystem(ctx);
      const apiMsgs = newMsgs.map(m => ({ role: m.role, content: m.content }));
      const reply = await callJarvis({ token, messages: apiMsgs, system });

      if (mode.id === "remix" && reply.includes("```remix-changes")) {
        try {
          const jsonStr = reply.match(/```remix-changes\n([\s\S]+?)\n```/)?.[1];
          if (jsonStr) {
            const parsed = JSON.parse(jsonStr);
            const assistantMsg = { role: "assistant", content: reply, ts: Date.now(), remixData: parsed };
            const finalMsgs = [...newMsgs, assistantMsg];
            setMessages(finalMsgs);
            setShowRemixDownload(parsed);
            save(finalMsgs, title, tagVal);
            return;
          }
        } catch {}
      }

      const assistantMsg = { role: "assistant", content: reply, ts: Date.now() };
      const finalMsgs = [...newMsgs, assistantMsg];
      setMessages(finalMsgs);
      save(finalMsgs, title, tagVal);
    } catch (e) {
      setError(e.message === "AUTH_ERROR" ? "Invalid access token." : e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: D.bg }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${D.border}`, background: D.white, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: editingTag || tagVal ? 6 : 0 }}>
          <button onClick={onBack} style={{ fontSize: 18, color: D.muted, background: "none", border: "none", cursor: "pointer", padding: "4px 0", flexShrink: 0 }}>←</button>
          <span style={{ fontSize: 16, flexShrink: 0 }}>{mode.icon}</span>
          {editingTitle ? (
            <input autoFocus value={titleVal} onChange={e => setTitleVal(e.target.value)}
              onBlur={() => { setEditingTitle(false); save(messages, titleVal, tagVal); }}
              onKeyDown={e => { if (e.key === "Enter") { setEditingTitle(false); save(messages, titleVal, tagVal); } }}
              style={{ flex: 1, fontFamily: "'Unbounded',monospace", fontSize: 11, fontWeight: 700, background: D.bg, border: `1px solid ${D.border}`, borderRadius: 8, padding: "4px 8px", minWidth: 0 }} />
          ) : (
            <div onClick={() => setEditingTitle(true)} style={{ flex: 1, fontFamily: "'Unbounded',monospace", fontSize: 11, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}>{titleVal}</div>
          )}
          {editingTag ? (
            <input autoFocus placeholder="project tag…" value={tagVal} onChange={e => setTagVal(e.target.value)}
              onBlur={() => { setEditingTag(false); save(messages, titleVal, tagVal); }}
              onKeyDown={e => { if (e.key === "Enter") { setEditingTag(false); save(messages, titleVal, tagVal); } }}
              style={{ width: 90, fontFamily: "'Unbounded',monospace", fontSize: 8, background: D.bg, border: `1px solid ${D.border}`, borderRadius: 8, padding: "4px 8px" }} />
          ) : (
            <button onClick={() => setEditingTag(true)} style={{ fontFamily: "'Unbounded',monospace", fontSize: 7, background: tagVal ? mode.color : D.bg, color: tagVal ? "#fff" : D.muted, border: `1px solid ${D.border}`, borderRadius: 8, padding: "4px 8px", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>
              {tagVal || "# tag"}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
        {messages.length === 0 && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>{mode.icon}</div>
              <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 13, fontWeight: 700, color: mode.color, marginBottom: 6 }}>{mode.name}</div>
              <div style={{ fontSize: 13, color: D.muted }}>{mode.tagline}</div>
            </div>
            {mode.insights.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {mode.insights.map((ins, i) => (
                  <button key={i} onClick={() => send(ins.prompt)} style={{ textAlign: "left", background: D.white, border: `1px solid ${D.border}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer", fontSize: 13, color: D.bk }}>
                    {ins.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
            <div style={{ maxWidth: "82%", background: m.role === "user" ? D.bk : D.white, color: m.role === "user" ? D.yl : D.bk, borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "10px 14px", fontSize: 14, lineHeight: 1.55, border: m.role === "assistant" ? `1px solid ${D.border}` : "none", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {m.content}
              {m.remixData && (
                <button onClick={() => downloadRemixZip(m.remixData.changes, m.remixData.summary)} style={{ display: "block", marginTop: 10, fontFamily: "'Unbounded',monospace", fontSize: 8, fontWeight: 700, background: D.yl, color: D.bk, border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>
                  ↓ DOWNLOAD ZIP
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
            <div style={{ background: D.white, border: `1px solid ${D.border}`, borderRadius: "16px 16px 16px 4px", padding: "12px 16px" }}>
              <Spinner size={14} />
            </div>
          </div>
        )}
        {error && <div style={{ textAlign: "center", color: D.rd, fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "10px 16px 24px", borderTop: `1px solid ${D.border}`, background: D.white, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Message Orpheus…" rows={1}
            style={{ flex: 1, resize: "none", background: D.bg, border: `1px solid ${D.border}`, borderRadius: 12, padding: "10px 12px", fontSize: 14, fontFamily: "'Plus Jakarta Sans',sans-serif", outline: "none", maxHeight: 120, overflowY: "auto" }}
            onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(120, e.target.scrollHeight) + "px"; }} />
          <button onClick={() => send(input)} disabled={!input.trim() || loading}
            style={{ background: input.trim() && !loading ? D.bk : D.border, color: input.trim() && !loading ? D.yl : D.muted, border: "none", borderRadius: 12, width: 44, height: 44, fontSize: 18, cursor: input.trim() && !loading ? "pointer" : "default", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {loading ? <Spinner size={14} /> : "↑"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Export ────────────────────────────────────────────────────────────
export function Jarvis({ token = "" }) {
  const [conversations, setConversations] = useState(() => J.get("conversations") || []);
  const [activeConv, setActiveConv] = useState(null);

  const persistConvs = (convs) => {
    J.set("conversations", convs);
    setConversations(convs);
  };

  const handleNewConv = (mode) => {
    const conv = {
      id: crypto.randomUUID(),
      title: mode.name,
      modeId: mode.id,
      projectTag: null,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updated = [conv, ...conversations];
    persistConvs(updated);
    setActiveConv(conv);
  };

  const handleSelectConv = (conv) => {
    setActiveConv(conv);
  };

  const handleUpdateConv = (updated) => {
    const convs = conversations.map(c => c.id === updated.id ? updated : c);
    persistConvs(convs);
    setActiveConv(updated);
  };

  const handleBack = () => {
    setActiveConv(null);
    const fresh = J.get("conversations") || [];
    setConversations(fresh);
  };

  if (activeConv) {
    return (
      <ConversationView
        conversation={activeConv}
        token={token}
        onUpdate={handleUpdateConv}
        onBack={handleBack}
      />
    );
  }

  return (
    <ConversationList
      conversations={conversations}
      token={token}
      onSelectConv={handleSelectConv}
      onNewConv={handleNewConv}
    />
  );
}

