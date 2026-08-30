// Personal Balance Sheet — a life inventory and action toolkit.
//
// Storage: its own IndexedDB database (mindvault_balance_v1). Never share a
// database name with another module — same-name/same-version databases
// silently lose their object stores. localStorage is a fallback only if
// IndexedDB is unavailable (private mode, blocked storage).
//
// Everything in this module is deterministic. AI is strictly optional and
// lives behind explicit consent (see buildAIPayload / requestAISummary).

const DB_NAME = "mindvault_balance_v1";
const STORE = "sheets";
const LS_KEY = "mv_balance_sheet_v1";
const SHEET_ID = "primary";
export const SCHEMA_VERSION = 1;

// ── Accent palette (accents only — the app's own tokens carry the design) ──
export const C = {
  navy: "#1D3557",   // structure
  green: "#2D6A4F",  // assets / stability
  red: "#C1121F",    // liabilities / risk
  blue: "#3E7CB1",   // capacity / planning
  amber: "#E8B84B",  // priorities / command centre
};

// ── Vocabulary ────────────────────────────────────────────────
export const ASSET_CATEGORIES = [
  { id: "relationships", label: "Relationships and support", example: "A brother who always picks up. A friend from work who checks in." },
  { id: "skills", label: "Skills and education", example: "A trade licence. A degree. Something you can do that others pay for." },
  { id: "experience", label: "Work and life experience", example: "Years running a crew. Raising kids. Surviving a previous hard season." },
  { id: "health", label: "Health and practical resources", example: "A working vehicle. Housing. Insurance. Physical strength you still have." },
  { id: "values", label: "Values and character", example: "You keep your word. You show up. You do not quit on people." },
  { id: "purpose", label: "Creativity, purpose, or faith", example: "A craft. A congregation. A reason you get up that is bigger than the day." },
  { id: "resilience", label: "Resilience and accomplishments", example: "Something you finished that was hard. A time you came back." },
];

export const LIABILITY_CATEGORIES = [
  { id: "health", label: "Health and capacity", example: "An untreated injury. A prescription you have not refilled." },
  { id: "stress", label: "Stress and emotional load", example: "Carrying a situation alone. Sleep that has not been right in months." },
  { id: "obligations", label: "Unresolved obligations", example: "Unopened mail. A form that needed filing weeks ago." },
  { id: "habits", label: "Habits and avoidance", example: "Drinking more than intended. Putting off a call you know you need to make." },
  { id: "home", label: "Relationships and home", example: "A conversation you keep postponing. Tension nobody is naming." },
  { id: "work", label: "Work and income", example: "Hours cut. A gap you have not planned for." },
  { id: "fear", label: "Fear, shame, or uncertainty", example: "Something you have not told anyone. Not knowing where you stand." },
];

export const CAPACITY_AREAS = [
  { id: "sleep", label: "Sleep and physical energy" },
  { id: "focus", label: "Concentration and task initiation" },
  { id: "regulation", label: "Emotional regulation and calm" },
  { id: "selfcare", label: "Self-care and daily routines" },
  { id: "presence", label: "Family and relationship presence" },
  { id: "admin", label: "Administrative follow-through" },
  { id: "work", label: "Work or study capacity" },
  { id: "help", label: "Ability to ask for and accept help" },
];

export const WEEKLY_AREAS = [
  { id: "sleep", label: "Sleep and energy" },
  { id: "basics", label: "Hygiene, meals, and movement" },
  { id: "calm", label: "Calm and emotional regulation" },
  { id: "focus", label: "Focus and follow-through" },
  { id: "family", label: "Family and relationship presence" },
  { id: "admin", label: "Administrative responsibilities" },
  { id: "support", label: "Treatment or support engagement" },
  { id: "habits", label: "Habits or substance-use plan" },
  { id: "work", label: "Primary work or project focus" },
];

// A "next physical action" must be visible and specific.
export const ACTION_VERBS = ["Open", "Call", "Send", "Schedule", "Gather", "Pay", "Ask", "Complete"];

export const STATUSES = ["Not started", "In progress", "Waiting on someone", "Done"];
export const PRIORITIES = ["High", "Medium", "Low"];
export const FOCUS_DECISIONS = ["ACTIVE", "MAINTAIN", "PARK", "ARCHIVE"];

export const HORIZONS = [
  { id: "30", label: "Next 30 Days", purpose: "Stabilize urgent problems and restore basic routines." },
  { id: "90", label: "Next 90 Days", purpose: "Build consistency, reduce open loops, and complete one meaningful pilot or priority." },
  { id: "365", label: "Next 365 Days", purpose: "Create sustainable health, family, work, and purpose systems." },
];

/** Hard cap — the interface must not encourage unlimited goals. */
export const MAX_GOALS_PER_HORIZON = 3;

export const SECTIONS = [
  { id: "assets", label: "Assets", accent: C.green },
  { id: "liabilities", label: "Liabilities", accent: C.red },
  { id: "capacity", label: "Capacity", accent: C.blue },
  { id: "equity", label: "Personal Equity", accent: C.navy },
  { id: "command", label: "Command Center", accent: C.amber },
  { id: "risks", label: "Risks", accent: C.red },
  { id: "plan", label: "30 · 90 · 365", accent: C.blue },
  { id: "weekly", label: "Weekly Close", accent: C.green },
  { id: "focus", label: "Focus Triage", accent: C.amber },
];

// ── Typed shapes (JSDoc — this codebase is JS, not TypeScript) ─────────────
/**
 * @typedef {Object} AssetEntry
 * @property {string} id @property {string} category @property {string} description
 * @property {number} strength 1-5 @property {number} access 1-5 @property {string} note
 *
 * @typedef {Object} LiabilityEntry
 * @property {string} id @property {string} category @property {string} description
 * @property {number} urgency 1-3 @property {string} firstAction @property {string} deadline
 * @property {string} helper @property {string} status
 *
 * @typedef {Object} CapacityRating
 * @property {number} rating 1-5 @property {string} affecting
 * @property {string} replenishes @property {string} reduce
 *
 * @typedef {Object} EquityResponse
 * @property {string} values @property {string} whoValuesMe @property {string} provenStrengths
 * @property {string} cannotBeTaken @property {string} assetAgainstLiability
 * @property {string} dealingWith @property {string} stillPossess @property {string} nextMove
 * @property {string} statementOverride
 *
 * @typedef {Object} CommandCenterItem
 * @property {string} id @property {string} issue @property {string} category @property {string} deadline
 * @property {string} nextAction @property {string} verb @property {string} helper
 * @property {string} status @property {string} priority
 *
 * @typedef {Object} RiskEntry
 * @property {string} id @property {string} risk @property {string} warningSign
 * @property {string} prevention @property {string} helper @property {string} escalationPoint
 *
 * @typedef {Object} GoalEntry
 * @property {string} id @property {string} horizon @property {string} priority @property {string} why
 * @property {string} measureOfDone @property {string} firstAction @property {string} targetDate
 * @property {string} support @property {string} status @property {number} progress
 *
 * @typedef {Object} WeeklyClose
 * @property {string} id @property {string} weekOf @property {Object<string,number>} ratings
 * @property {string} strengthened @property {string} liabilityIncreased @property {string} unresolved
 * @property {string} askedForHelp @property {string} oneMove
 *
 * @typedef {Object} FocusItem
 * @property {string} id @property {string} name @property {string} decision
 * @property {string} why @property {string} reviewDate
 *
 * @typedef {Object} AISummaryConsent
 * @property {boolean} granted @property {string} grantedAt @property {string} payloadReviewed
 *
 * @typedef {Object} PersonalBalanceSheet
 * @property {string} id @property {string|null} ownerLabel @property {string} createdAt
 * @property {string} updatedAt @property {number} version
 * @property {'not_started'|'in_progress'|'complete'} completionState
 * @property {string} currentSection
 * @property {AssetEntry[]} assets @property {string} protectFirst
 * @property {LiabilityEntry[]} liabilities @property {string} mostDangerousDelay
 * @property {Object<string,CapacityRating>} capacity @property {EquityResponse} equity
 * @property {CommandCenterItem[]} commandCenter @property {RiskEntry[]} risks
 * @property {string} escalationPlan @property {GoalEntry[]} goals
 * @property {WeeklyClose[]} weeklyCloses @property {FocusItem[]} focus
 * @property {AISummaryConsent|null} aiConsent @property {string|null} aiSummary
 */

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`);

/** @returns {PersonalBalanceSheet} */
export function emptySheet() {
  const now = new Date().toISOString();
  return {
    id: SHEET_ID,
    ownerLabel: null,
    createdAt: now,
    updatedAt: now,
    version: SCHEMA_VERSION,
    completionState: "not_started",
    currentSection: "assets",
    assets: [],
    protectFirst: "",
    liabilities: [],
    mostDangerousDelay: "",
    capacity: {},
    equity: {
      values: "", whoValuesMe: "", provenStrengths: "", cannotBeTaken: "",
      assetAgainstLiability: "", dealingWith: "", stillPossess: "", nextMove: "",
      statementOverride: "",
    },
    commandCenter: [],
    risks: [],
    escalationPlan: "",
    goals: [],
    weeklyCloses: [],
    focus: [],
    aiConsent: null,
    aiSummary: null,
  };
}

// ── Storage adapter ───────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("no indexeddb")); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
  });
}

const lsRead = () => {
  try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
};
const lsWrite = (sheet) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(sheet)); } catch { /* quota */ }
};

/** Where the user's data actually lives — surfaced in the privacy notice. */
export async function storageLocation() {
  try { await openDB(); return "IndexedDB on this device"; }
  catch { return "this browser's local storage on this device"; }
}

export async function loadSheet() {
  try {
    const db = await openDB();
    const found = await new Promise((res, rej) => {
      const r = db.transaction(STORE).objectStore(STORE).get(SHEET_ID);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
    if (found) return migrate(found);
  } catch { /* fall through to localStorage */ }
  const ls = lsRead();
  return ls ? migrate(ls) : null;
}

export async function saveSheet(sheet) {
  const next = { ...sheet, updatedAt: new Date().toISOString(), version: SCHEMA_VERSION };
  try {
    const db = await openDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(next);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch {
    lsWrite(next); // fallback path
  }
  return next;
}

export async function deleteSheet() {
  try {
    const db = await openDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(SHEET_ID);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch { /* ignore */ }
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
}

/** Forward-compatible: fill in anything a newer shape expects. */
function migrate(sheet) {
  return { ...emptySheet(), ...sheet, equity: { ...emptySheet().equity, ...(sheet.equity || {}) } };
}

// ── Deterministic derivations (no AI involved) ────────────────
const avg = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);

export function urgentLiabilities(sheet) {
  return (sheet.liabilities || []).filter(l => Number(l.urgency) === 3 && l.status !== "Done");
}

export function capacityScores(sheet) {
  return CAPACITY_AREAS
    .map(a => ({ ...a, rating: Number(sheet.capacity?.[a.id]?.rating) || 0 }))
    .filter(a => a.rating > 0);
}

const DAY = 86400000;
const pRank = { High: 0, Medium: 1, Low: 2 };

/**
 * Urgency bucket. Deadline proximity and priority BOTH matter: a low-priority
 * task due in three months must not outrank a high-priority one with no date,
 * which is what sorting on the raw deadline alone produces.
 */
function urgencyBucket(item, now) {
  const due = item.deadline ? Date.parse(item.deadline) : null;
  const days = due != null && !Number.isNaN(due) ? (due - now) / DAY : null;
  if (days != null && days <= 7) return 0;            // overdue or this week
  if (item.priority === "High") return 1;
  if (days != null && days <= 30) return 2;           // this month
  if (item.priority === "Medium") return 3;
  return 4;
}

/** Sort: urgent deadlines and high-priority items first; done items last. */
export function sortedCommandCenter(sheet, now = Date.now()) {
  const sRank = { "In progress": 0, "Not started": 1, "Waiting on someone": 2, Done: 3 };
  return [...(sheet.commandCenter || [])].sort((a, b) => {
    if ((a.status === "Done") !== (b.status === "Done")) return a.status === "Done" ? 1 : -1;
    const ab = urgencyBucket(a, now), bb = urgencyBucket(b, now);
    if (ab !== bb) return ab - bb;
    const ad = a.deadline ? Date.parse(a.deadline) : Infinity;
    const bd = b.deadline ? Date.parse(b.deadline) : Infinity;
    if (ad !== bd) return ad - bd;
    const ap = pRank[a.priority] ?? 3, bp = pRank[b.priority] ?? 3;
    if (ap !== bp) return ap - bp;
    return (sRank[a.status] ?? 4) - (sRank[b.status] ?? 4);
  });
}

export function equityStatement(sheet) {
  const e = sheet.equity || {};
  if (e.statementOverride?.trim()) return e.statementOverride.trim();
  const blank = "__________";
  return `Even while I am dealing with ${e.dealingWith?.trim() || blank}, I still possess ${e.stillPossess?.trim() || blank}, and my next responsible move is ${e.nextMove?.trim() || blank}.`;
}

/**
 * The results dashboard. Descriptive labels are only attached when the user's
 * own answers support them — never as flattery or as a diagnosis.
 */
export function deriveSummary(sheet) {
  const assets = sheet.assets || [];
  const strongAccessible = assets.filter(a => a.strength >= 4 && a.access >= 4);
  const strongHardToAccess = assets.filter(a => a.strength >= 4 && a.access <= 2);
  const urgent = urgentLiabilities(sheet);
  const caps = capacityScores(sheet);
  const lowest = [...caps].sort((a, b) => a.rating - b.rating).slice(0, 3).filter(c => c.rating <= 2);
  const capacityAvg = avg(caps.map(c => c.rating));
  const openCommand = sortedCommandCenter(sheet).filter(i => i.status !== "Done");

  const labels = [];
  if (assets.length >= 3 && caps.length >= 3 && capacityAvg <= 2.5) {
    labels.push("Asset-rich but currently capacity-constrained");
  }
  if (strongHardToAccess.length >= 2) {
    labels.push("Strong long-term ability with limited present access");
  }
  if (urgent.length >= 3) {
    labels.push("High liability pressure requiring immediate prioritization");
  }
  if (assets.length >= 1 && caps.length >= 3 && capacityAvg <= 2.5) {
    labels.push("Your current capacity does not erase your underlying value");
  }

  const now = Date.now();
  const upcoming = [
    ...(sheet.commandCenter || []).filter(i => i.deadline && i.status !== "Done")
      .map(i => ({ what: i.issue, date: i.deadline, from: "Command Center" })),
    ...(sheet.goals || []).filter(g => g.targetDate && g.status !== "Done")
      .map(g => ({ what: g.priority, date: g.targetDate, from: `${g.horizon}-day plan` })),
  ].filter(d => Date.parse(d.date) >= now - 86400000)
   .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
   .slice(0, 6);

  return {
    strongAccessible,
    strongHardToAccess,
    urgentCount: urgent.length,
    urgent,
    lowestCapacity: lowest,
    capacityAvg: caps.length ? Number(capacityAvg.toFixed(1)) : null,
    immediateActions: openCommand.slice(0, 5),
    equityStatement: equityStatement(sheet),
    top30: (sheet.goals || []).filter(g => g.horizon === "30").slice(0, MAX_GOALS_PER_HORIZON),
    upcoming,
    focus: sheet.focus || [],
    weeklyCloses: [...(sheet.weeklyCloses || [])].sort((a, b) => (b.weekOf || "").localeCompare(a.weekOf || "")),
    labels,
  };
}

/** Completion is generous on purpose: no sensitive field is ever required. */
export function sectionProgress(sheet) {
  return {
    assets: (sheet.assets || []).length > 0,
    liabilities: (sheet.liabilities || []).length > 0,
    capacity: capacityScores(sheet).length > 0,
    equity: Object.values(sheet.equity || {}).some(v => String(v || "").trim()),
    command: (sheet.commandCenter || []).length > 0,
    risks: (sheet.risks || []).length > 0 || !!String(sheet.escalationPlan || "").trim(),
    plan: (sheet.goals || []).length > 0,
    weekly: (sheet.weeklyCloses || []).length > 0,
    focus: (sheet.focus || []).length > 0,
  };
}

// ── AI (optional, consent-gated) ──────────────────────────────
/**
 * Best-effort scrubbing of obvious identifiers before the user reviews the
 * payload. This is an aid, not a guarantee — the user always sees and can
 * edit the exact text before anything is sent.
 */
export function scrubText(text) {
  if (!text) return "";
  return String(text)
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[EMAIL]")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "[PHONE]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[ID NUMBER]")
    .replace(/\b(?:\d[ -]?){13,16}\b/g, "[ACCOUNT NUMBER]")
    .replace(/\b\d{6,}\b/g, "[NUMBER]")
    .replace(/\bDr\.?\s+[A-Z][a-z]+/g, "[CLINICIAN]");
}

/** Builds the exact text the user will review before any AI call. */
export function buildAIPayload(sheet, { scrub = true } = {}) {
  const s = (v) => (scrub ? scrubText(v) : String(v || ""));
  const lines = [];
  if (sheet.assets?.length) {
    lines.push("ASSETS:");
    sheet.assets.forEach(a => lines.push(`- ${s(a.description)} (strength ${a.strength}/5, access now ${a.access}/5)${a.note ? ` — ${s(a.note)}` : ""}`));
  }
  if (sheet.protectFirst) lines.push(`Asset to protect first: ${s(sheet.protectFirst)}`);
  if (sheet.liabilities?.length) {
    lines.push("", "LIABILITIES:");
    sheet.liabilities.forEach(l => lines.push(`- ${s(l.description)} (urgency ${l.urgency}/3, status ${l.status || "unset"})${l.firstAction ? ` — first action: ${s(l.firstAction)}` : ""}`));
  }
  if (sheet.mostDangerousDelay) lines.push(`Most dangerous to delay: ${s(sheet.mostDangerousDelay)}`);
  const caps = capacityScores(sheet);
  if (caps.length) {
    lines.push("", "CAPACITY (1-5 self-rating):");
    caps.forEach(c => {
      const d = sheet.capacity[c.id] || {};
      lines.push(`- ${c.label}: ${c.rating}/5${d.affecting ? ` — affected by: ${s(d.affecting)}` : ""}${d.replenishes ? ` — replenished by: ${s(d.replenishes)}` : ""}`);
    });
  }
  const e = sheet.equity || {};
  const eq = [
    e.values && `Core values: ${s(e.values)}`,
    e.whoValuesMe && `Valued beyond performance by: ${s(e.whoValuesMe)}`,
    e.provenStrengths && `Proven strengths: ${s(e.provenStrengths)}`,
    e.cannotBeTaken && `Cannot be taken by a setback: ${s(e.cannotBeTaken)}`,
  ].filter(Boolean);
  if (eq.length) lines.push("", "PERSONAL EQUITY:", ...eq.map(x => `- ${x}`));
  if (sheet.commandCenter?.length) {
    lines.push("", "OPEN ITEMS:");
    sortedCommandCenter(sheet).filter(i => i.status !== "Done").forEach(i =>
      lines.push(`- ${s(i.issue)} (${i.priority || "unprioritised"}${i.deadline ? `, due ${i.deadline}` : ""}) next: ${s(i.nextAction)}`));
  }
  if (sheet.goals?.length) {
    lines.push("", "PLAN:");
    sheet.goals.forEach(g => lines.push(`- [${g.horizon}d] ${s(g.priority)}${g.measureOfDone ? ` — done when: ${s(g.measureOfDone)}` : ""}`));
  }
  return lines.join("\n").trim();
}

export const AI_SYSTEM_PROMPT = `You are helping a man organize a personal life inventory he filled in himself, inside a private wellness app. He has explicitly asked for help organizing his own answers.

Write plain text (no markdown symbols), under 350 words, in this order:
1. THEMES — 2-3 patterns that repeat across what he wrote, quoting his own words.
2. LIKELY PRIORITIES — up to 3, ordered, each with one sentence of reasoning drawn only from his answers.
3. CONCRETE NEXT ACTIONS — rewrite his vague intentions as specific visible actions starting with a verb (Open, Call, Send, Schedule, Gather, Pay, Ask, Complete).

Hard rules:
- Never diagnose, name a disorder, or assess mental-health severity.
- Never advise starting, stopping, or changing medication or treatment.
- Never make legal, benefits-eligibility, or financial determinations.
- Never invent deadlines, resources, phone numbers, organisations, or facts he did not provide.
- Present observations as readings of what he wrote, not established fact.
- You are not a clinician, attorney, financial professional, or crisis service. If his answers suggest danger to himself or others, say plainly that this is beyond what the tool can help with and that he should contact a qualified person or emergency service today.
- Respectful, direct, adult. No hype, no pep talk, no shaming, no "be tougher".`;
