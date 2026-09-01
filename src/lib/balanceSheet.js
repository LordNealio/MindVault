// Personal Balance Sheet — a life inventory and action toolkit.
//
// Storage: its own IndexedDB database (mindvault_balance_v1). Never share a
// database name with another module. localStorage is a fallback only when
// IndexedDB is unavailable.
//
// Everything here is deterministic. AI is strictly optional and consent-gated.
// Ratings use the versioned Answer model in balanceAnswers.js; decision-support
// thresholds live in balanceDecisionSupport.js.

import {
  QUESTIONS, ANCHOR_SETS, answered, unanswered, valueOf, isAnswered,
  fromLegacyNumber, ANSWER_STATES,
} from "./balanceAnswers.js";

const DB_NAME = "mindvault_balance_v1";
const STORE = "sheets";
const LS_KEY = "mv_balance_sheet_v1";
const SHEET_ID = "primary";
export const SCHEMA_VERSION = 2;

/**
 * External AI processing of free-text answers is OFF until an owner has
 * approved purpose, provider terms, and retention (audit S8). Flipping this to
 * true is a governance decision, not a code cleanup.
 */
export const AI_GOVERNANCE_APPROVED = false;

export const CONSENT_STATEMENT =
  "I understand this is a private self-reflection tool — not a test, a diagnosis, or a monitored service.";
export const CONSENT_VERSION = 1;

export const MONITORING_STATEMENT =
  "No one reviews these answers. Nothing here is monitored and no one is alerted by anything you write. If you need a person to respond, use Get help at the top of any screen.";

export const PROTOTYPE_NOTE =
  "A research-informed prototype. It has not been validated as an assessment.";

// ── Accent palette (accents only) ─────────────────────────────
export const C = {
  navy: "#1D3557", green: "#2D6A4F", red: "#C1121F", blue: "#3E7CB1", amber: "#E8B84B",
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

/** How a drain can be responded to (audit F9) — not every problem is solvable. */
export const DRAIN_RESPONSES = [
  { id: "act", label: "Act on it", hint: "I can change this directly." },
  { id: "ask", label: "Ask for support", hint: "Someone else has to be involved." },
  { id: "reduce", label: "Reduce my exposure", hint: "Less contact, less time, less load." },
  { id: "negotiate", label: "Renegotiate the terms", hint: "Change the deal rather than the effort." },
  { id: "cope", label: "Cope while it lasts", hint: "It is not changing yet; I need to carry it well." },
  { id: "monitor", label: "Monitor for now", hint: "Watch it; act if it worsens." },
  { id: "exit", label: "Plan an exit", hint: "The realistic answer is to leave it behind." },
];

/** The seven capacity items, past 7 days, ability not worth (audit F10). */
export const CAPACITY_AREAS = [
  { id: "rest", label: "Get enough rest to function" },
  { id: "physical", label: "Take care of basic physical needs" },
  { id: "focus", label: "Focus and make decisions" },
  { id: "home", label: "Handle essential tasks at home" },
  { id: "roles", label: "Meet essential responsibilities in your major roles" },
  { id: "support", label: "Reach or accept useful support or connection" },
  { id: "recover", label: "Recover after stress" },
];

/** Weekly Close ratings (audit F23) — stable, repeatable items only. */
export const WEEKLY_AREAS = [
  { id: "energy", label: "Usable energy" },
  { id: "focus", label: "Focus" },
  { id: "recovery", label: "Recovery after stress" },
  { id: "support", label: "Access to support" },
  { id: "responsibilities", label: "Ability to meet essential responsibilities" },
  { id: "drainInterference", label: "Freedom from drain interference", invert: true },
];

export const ACTION_STATUSES = ["Not started", "Started", "In progress", "Done", "Changed", "Dropped"];
export const ACTION_VERBS = ["Open", "Call", "Send", "Schedule", "Gather", "Pay", "Ask", "Complete"];
export const STATUSES = ["Not started", "In progress", "Waiting on someone", "Done"];
export const PRIORITIES = ["High", "Medium", "Low"];
export const FOCUS_DECISIONS = ["ACTIVE", "MAINTAIN", "PARK", "ARCHIVE"];

export const HORIZONS = [
  { id: "30", label: "Next 30 Days", purpose: "Stabilize urgent problems and restore basic routines." },
  { id: "90", label: "Next 90 Days", purpose: "Build consistency, reduce open loops, and complete one meaningful pilot or priority." },
  { id: "365", label: "Next 365 Days", purpose: "Create sustainable health, family, work, and purpose systems." },
];

export const MAX_GOALS_PER_HORIZON = 3;

export const SECTIONS = [
  { id: "assets", label: "Resources", accent: C.green },
  { id: "liabilities", label: "Drains", accent: C.red },
  { id: "capacity", label: "Capacity", accent: C.blue },
  { id: "equity", label: "What's Yours", accent: C.navy },
  { id: "command", label: "Command Center", accent: C.amber },
  { id: "risks", label: "Risks", accent: C.red },
  { id: "priority", label: "Priority", accent: C.navy },
  { id: "plan", label: "Action Plan", accent: C.blue },
  { id: "weekly", label: "Weekly Close", accent: C.green },
  { id: "focus", label: "Focus Triage", accent: C.amber },
];

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`);

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
    consent: null,
    usefulToday: "",
    assets: [],
    protectFirst: "",
    liabilities: [],
    mostDangerousDelay: "",
    capacity: {},
    capacityLegacy: null,
    equity: {
      values: "", whoValuesMe: "", provenStrengths: "", cannotBeTaken: "",
      assetAgainstLiability: "", dealingWith: "", stillPossess: "", nextMove: "",
      statementOverride: "",
    },
    commandCenter: [],
    risks: [],
    escalationPlan: "",
    priority: { area: "", whyNow: "", costOfNoChange: "" },
    goals: [],
    weeklyCloses: [],
    focus: [],
    feedback: null,
    aiConsent: null,
    aiSummary: null,
  };
}

export const newAsset = () => ({
  id: uid(), category: "relationships", description: "",
  strength: unanswered("resource.strength"), access: unanswered("resource.access"),
  easierToUse: "", note: "",
});

export const newLiability = () => ({
  id: uid(), category: "health", description: "",
  interference: unanswered("drain.interference"),
  urgency: unanswered("drain.urgency"),
  influence: unanswered("drain.influence"),
  response: "", firstAction: "", deadline: "", helper: "", status: "Not started",
});

export const newGoal = (horizon) => ({
  id: uid(), horizon, priority: "", why: "",
  importance: unanswered("plan.importance"),
  measureOfDone: "", obstacle: "", firstAction: "", whenWhere: "", ifThen: "",
  support: "", confidence: unanswered("plan.confidence"),
  targetDate: "", status: "Not started", progress: 0,
});

export const newWeekly = () => ({
  id: uid(), weekOf: new Date().toISOString().slice(0, 10),
  ratings: Object.fromEntries(WEEKLY_AREAS.map(a => [a.id, unanswered("weekly.item")])),
  actionStatus: "", strengthened: "", liabilityIncreased: "",
  unresolved: "", askedForHelp: "", oneMove: "",
});

// ── Storage adapter ───────────────────────────────────────────
// One cached connection per page. Opening a fresh connection on every call
// leaks handles and, more practically, leaves deleteDatabase() blocked forever
// because there is always an open connection holding the database.
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB unavailable")); return; }
    let req;
    try { req = indexedDB.open(DB_NAME, 1); }
    catch (err) { reject(err); return; }
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
    req.onsuccess = () => {
      const db = req.result;
      // If something else requests a version change or deletion, step aside.
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
  });
  // A failed open must not be cached, or every later call inherits the failure.
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

/** Releases the cached connection. Exposed for tests and teardown. */
export function closeDB() {
  const p = dbPromise;
  dbPromise = null;
  if (p) p.then(db => { try { db.close(); } catch { /* already closed */ } }).catch(() => {});
}

const lsRead = () => {
  try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
};

/** Throws on failure — callers must be able to tell the user nothing was saved. */
const lsWrite = (sheet) => {
  if (typeof localStorage === "undefined") throw new Error("localStorage unavailable");
  localStorage.setItem(LS_KEY, JSON.stringify(sheet));
};

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

/**
 * AUDIT P0-1: this used to swallow every storage error and resolve as if the
 * write succeeded, so the UI told the user "Saved" when nothing was written.
 * It now rejects when BOTH stores fail, and reports which store took the data
 * so the caller can warn on a degraded path.
 */
export async function saveSheet(sheet) {
  const next = { ...sheet, updatedAt: new Date().toISOString(), version: SCHEMA_VERSION };
  let idbError = null;
  try {
    const db = await openDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(next);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error || new Error("write failed"));
      tx.onabort = () => rej(tx.error || new Error("write aborted"));
    });
    return { sheet: next, storedIn: "indexeddb" };
  } catch (err) {
    idbError = err;
  }
  try {
    lsWrite(next);
    return { sheet: next, storedIn: "localstorage", degraded: true, reason: idbError?.message };
  } catch (lsErr) {
    const e = new Error(
      `Could not save. IndexedDB: ${idbError?.message || "unavailable"}. Local storage: ${lsErr?.message || "unavailable"}.`
    );
    e.name = "BalanceSheetSaveError";
    e.idbError = idbError;
    e.lsError = lsErr;
    throw e;
  }
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

/**
 * v1 → v2 migration.
 *
 * Deliberately ADDITIVE. v1 stored bare 1–5 numbers; v2 stores versioned
 * Answers on 0–4 scales where 0 is a real answer. Subtracting one from every
 * old rating would silently change what the user said, so old values keep
 * their original number and are tagged with a legacy anchor set. Trends refuse
 * to mix anchor sets, so nothing is misread.
 *
 * v1 capacity used a different, eight-item set. Rather than guess a mapping
 * between differently-worded items, v1 capacity is preserved verbatim under
 * `capacityLegacy` and the v2 section starts fresh.
 */
export function migrate(raw) {
  const base = emptySheet();
  if (!raw) return base;
  const fromVersion = Number(raw.version) || 1;
  const s = {
    ...base, ...raw,
    equity: { ...base.equity, ...(raw.equity || {}) },
    priority: { ...base.priority, ...(raw.priority || {}) },
  };
  if (fromVersion >= 2) return s;

  s.assets = (raw.assets || []).map(a => ({
    ...newAsset(), ...a,
    strength: typeof a.strength === "number" ? fromLegacyNumber(a.strength) : (a.strength ?? unanswered("resource.strength")),
    access: typeof a.access === "number" ? fromLegacyNumber(a.access) : (a.access ?? unanswered("resource.access")),
  }));

  s.liabilities = (raw.liabilities || []).map(l => ({
    ...newLiability(), ...l,
    urgency: typeof l.urgency === "number"
      ? fromLegacyNumber(l.urgency, "legacy-urgency-1to3-v1")
      : (l.urgency ?? unanswered("drain.urgency")),
    interference: l.interference ?? unanswered("drain.interference"),
    influence: l.influence ?? unanswered("drain.influence"),
  }));

  const legacyCapacity = raw.capacity && Object.keys(raw.capacity).length ? raw.capacity : null;
  s.capacityLegacy = legacyCapacity;
  s.capacity = {};

  s.goals = (raw.goals || []).map(g => ({ ...newGoal(g.horizon || "30"), ...g,
    importance: g.importance ?? unanswered("plan.importance"),
    confidence: g.confidence ?? unanswered("plan.confidence"),
  }));

  s.weeklyCloses = (raw.weeklyCloses || []).map(w => {
    const ratings = {};
    for (const [k, v] of Object.entries(w.ratings || {})) {
      ratings[k] = typeof v === "number" ? fromLegacyNumber(v) : v;
    }
    return { ...newWeekly(), ...w, ratings, legacyItemSet: true };
  });

  s.version = SCHEMA_VERSION;
  s.migratedFrom = fromVersion;
  return s;
}

// ── Derivations (deterministic, no AI) ────────────────────────
const mean = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);

export function urgentLiabilities(sheet) {
  return (sheet.liabilities || []).filter(l => valueOf(l.urgency) === 3 && l.status !== "Done");
}

/** Only answered items. A declined or unanswered rating is never treated as 0. */
export function capacityScores(sheet) {
  return CAPACITY_AREAS
    .map(a => ({ ...a, answer: sheet.capacity?.[a.id]?.rating }))
    .filter(a => isAnswered(a.answer))
    .map(a => ({ ...a, rating: a.answer.value }));
}

const DAY = 86400000;
const pRank = { High: 0, Medium: 1, Low: 2 };

function urgencyBucket(item, now) {
  const due = item.deadline ? Date.parse(item.deadline) : null;
  const days = due != null && !Number.isNaN(due) ? (due - now) / DAY : null;
  if (days != null && days <= 7) return 0;
  if (item.priority === "High") return 1;
  if (days != null && days <= 30) return 2;
  if (item.priority === "Medium") return 3;
  return 4;
}

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
 * Within-person trend for ONE weekly item. Only points sharing an anchor set
 * and question version are returned together, so a revised scale starts a new
 * series instead of silently continuing an old one (audit F24/D7). There is
 * deliberately no composite index across items.
 */
export function weeklySeries(sheet, itemId) {
  const points = [...(sheet.weeklyCloses || [])]
    .sort((a, b) => (a.weekOf || "").localeCompare(b.weekOf || ""))
    .map(w => ({ weekOf: w.weekOf, answer: w.ratings?.[itemId] }))
    .filter(p => isAnswered(p.answer));
  if (!points.length) return { series: [], anchors: null, split: false };
  const anchors = points[points.length - 1].answer.anchors;
  const qv = points[points.length - 1].answer.qv;
  const current = points.filter(p => p.answer.anchors === anchors && p.answer.qv === qv);
  return {
    series: current.map(p => ({ weekOf: p.weekOf, value: p.answer.value })),
    anchors,
    split: current.length !== points.length,
    max: ANCHOR_SETS[anchors]?.max ?? 4,
  };
}

export function deriveSummary(sheet) {
  const assets = sheet.assets || [];
  const accessible = assets.filter(a => (valueOf(a.access) ?? -1) >= 3);
  const hardToAccess = assets.filter(a => {
    const v = valueOf(a.access);
    return v != null && v <= 1;
  });
  const urgent = urgentLiabilities(sheet);
  const caps = capacityScores(sheet);
  const lowest = [...caps].sort((a, b) => a.rating - b.rating).slice(0, 3).filter(c => c.rating <= 1);
  const capacityMean = caps.length ? mean(caps.map(c => c.rating)) : null;
  const openCommand = sortedCommandCenter(sheet).filter(i => i.status !== "Done");

  const highInterference = (sheet.liabilities || []).filter(
    l => (valueOf(l.interference) ?? -1) >= 3 && l.status !== "Done"
  );

  const labels = [];
  if (assets.length >= 3 && caps.length >= 3 && capacityMean != null && capacityMean <= 1.5) {
    labels.push("Resource-rich but currently capacity-constrained");
  }
  if (hardToAccess.length >= 2) {
    labels.push("Real support that is currently hard to reach");
  }
  if (urgent.length >= 3) {
    labels.push("High pressure requiring immediate prioritization");
  }
  if (assets.length >= 1 && caps.length >= 3 && capacityMean != null && capacityMean <= 1.5) {
    labels.push("Your current capacity does not erase your underlying value");
  }

  const now = Date.now();
  const upcoming = [
    ...(sheet.commandCenter || []).filter(i => i.deadline && i.status !== "Done")
      .map(i => ({ what: i.issue, date: i.deadline, from: "Command Center" })),
    ...(sheet.goals || []).filter(g => g.targetDate && g.status !== "Done")
      .map(g => ({ what: g.priority, date: g.targetDate, from: `${g.horizon}-day plan` })),
  ].filter(d => Date.parse(d.date) >= now - DAY)
   .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
   .slice(0, 6);

  return {
    accessible, hardToAccess,
    urgent, urgentCount: urgent.length,
    highInterference,
    lowestCapacity: lowest,
    capacityMean: capacityMean == null ? null : Number(capacityMean.toFixed(1)),
    capacityMax: ANCHOR_SETS["capacity-0to4-v1"].max,
    immediateActions: openCommand.slice(0, 5),
    equityStatement: equityStatement(sheet),
    priority: sheet.priority || {},
    top30: (sheet.goals || []).filter(g => g.horizon === "30").slice(0, MAX_GOALS_PER_HORIZON),
    upcoming,
    focus: sheet.focus || [],
    weeklyCloses: [...(sheet.weeklyCloses || [])].sort((a, b) => (b.weekOf || "").localeCompare(a.weekOf || "")),
    labels,
  };
}

export function sectionProgress(sheet) {
  const any = (v) => !!String(v || "").trim();
  return {
    assets: (sheet.assets || []).length > 0,
    liabilities: (sheet.liabilities || []).length > 0,
    capacity: capacityScores(sheet).length > 0,
    equity: Object.values(sheet.equity || {}).some(any),
    command: (sheet.commandCenter || []).length > 0,
    risks: (sheet.risks || []).length > 0 || any(sheet.escalationPlan),
    priority: any(sheet.priority?.area) || any(sheet.priority?.whyNow),
    plan: (sheet.goals || []).length > 0,
    weekly: (sheet.weeklyCloses || []).length > 0,
    focus: (sheet.focus || []).length > 0,
  };
}

// ── AI (optional, consent-gated, governance-gated) ────────────
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

const labelFor = (questionId, answer) => {
  if (!isAnswered(answer)) return null;
  const set = ANCHOR_SETS[QUESTIONS[questionId]?.anchors];
  const l = set?.labels?.[answer.value];
  return l ? `${answer.value} (${l})` : String(answer.value);
};

export function buildAIPayload(sheet, { scrub = true } = {}) {
  const s = (v) => (scrub ? scrubText(v) : String(v || ""));
  const lines = [];
  if (sheet.assets?.length) {
    lines.push("RESOURCES:");
    sheet.assets.forEach(a => {
      const acc = labelFor("resource.access", a.access);
      lines.push(`- ${s(a.description)}${acc ? ` — availability in the past 7 days: ${acc}` : ""}${a.note ? ` — ${s(a.note)}` : ""}`);
    });
  }
  if (sheet.protectFirst) lines.push(`Resource to protect first: ${s(sheet.protectFirst)}`);
  if (sheet.liabilities?.length) {
    lines.push("", "DRAINS:");
    sheet.liabilities.forEach(l => {
      const parts = [
        labelFor("drain.interference", l.interference) && `interference ${labelFor("drain.interference", l.interference)}`,
        labelFor("drain.urgency", l.urgency) && `urgency ${labelFor("drain.urgency", l.urgency)}`,
        labelFor("drain.influence", l.influence) && `influence ${labelFor("drain.influence", l.influence)}`,
      ].filter(Boolean).join(", ");
      lines.push(`- ${s(l.description)}${parts ? ` (${parts})` : ""}${l.firstAction ? ` — first action: ${s(l.firstAction)}` : ""}`);
    });
  }
  const caps = capacityScores(sheet);
  if (caps.length) {
    lines.push("", "CAPACITY (past 7 days):");
    caps.forEach(c => {
      const d = sheet.capacity[c.id] || {};
      lines.push(`- ${c.label}: ${labelFor("capacity.item", d.rating)}${d.affecting ? ` — affected by: ${s(d.affecting)}` : ""}`);
    });
  }
  const e = sheet.equity || {};
  const eq = [
    e.values && `Core values: ${s(e.values)}`,
    e.provenStrengths && `Proven strengths: ${s(e.provenStrengths)}`,
    e.cannotBeTaken && `Cannot be taken by a setback: ${s(e.cannotBeTaken)}`,
  ].filter(Boolean);
  if (eq.length) lines.push("", "WHAT'S STILL YOURS:", ...eq.map(x => `- ${x}`));
  if (sheet.priority?.area) {
    lines.push("", "CHOSEN PRIORITY:", `- ${s(sheet.priority.area)}`,
      sheet.priority.whyNow && `  why now: ${s(sheet.priority.whyNow)}`,
      sheet.priority.costOfNoChange && `  cost of no change: ${s(sheet.priority.costOfNoChange)}`);
  }
  if (sheet.goals?.length) {
    lines.push("", "PLAN:");
    sheet.goals.forEach(g => lines.push(
      `- [${g.horizon}d] ${s(g.priority)}${g.measureOfDone ? ` — done when: ${s(g.measureOfDone)}` : ""}` +
      `${labelFor("plan.importance", g.importance) ? ` — importance ${labelFor("plan.importance", g.importance)}` : ""}` +
      `${labelFor("plan.confidence", g.confidence) ? ` — confidence ${labelFor("plan.confidence", g.confidence)}` : ""}`
    ));
  }
  return lines.filter(Boolean).join("\n").trim();
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
- Where he reported low influence over something, do not tell him to try harder; support, reduced exposure, renegotiation, coping and exit are legitimate answers.
- Present observations as readings of what he wrote, not established fact.
- You are not a clinician, attorney, financial professional, or crisis service. If his answers suggest danger to himself or others, say plainly that this is beyond what the tool can help with and that he should contact a qualified person or emergency service today.
- Respectful, direct, adult. No hype, no pep talk, no shaming, no "be tougher".`;

export { ANSWER_STATES };
