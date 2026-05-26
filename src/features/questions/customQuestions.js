// ── Custom Questions — data layer ─────────────────────────
// All state lives in localStorage so it's offline-first and
// consistent with the rest of the MindVault data model.

const KEY = "mv_custom_questions_v1";

// ── Template section visibility ───────────────────────────
const SECTIONS_KEY = "mv_template_sections_v1";

export const MORNING_SECTIONS = [
  { id:"identity",   label:"Identity & Habits",   icon:"☀️", desc:"I AM / I FEEL + daily habit checks",      note:"Drives the morning completion check on Home" },
  { id:"gratitude",  label:"Gratitude",            icon:"🙏", desc:"I am thankful for…"                      },
  { id:"journal",    label:"Journal",              icon:"✍️", desc:"Free-write — what's alive in you today"  },
  { id:"loveAction", label:"Show Love",            icon:"❤️", desc:"One action to show love"                 },
  { id:"visualize",  label:"Visualize",            icon:"👁",  desc:"6-sense visualization exercise"          },
  { id:"photos",     label:"Morning Photos",       icon:"📷", desc:"Upload photos from your morning"         },
];
export const EVENING_SECTIONS = [
  { id:"goals",      label:"Next Day Goals",       icon:"🎯", desc:"Plan tomorrow's priorities",             note:"Powers Today's Focus on the Home screen"   },
  { id:"feelings",   label:"Feelings & Learning",  icon:"💭", desc:"How you felt + what you learned"         },
  { id:"appreciate", label:"Appreciate & Growth",  icon:"🌱", desc:"Appreciation + growth question"          },
  { id:"capture",    label:"Ideas & Memory",       icon:"✦",  desc:"Random ideas + one thing to remember"    },
  { id:"checklist",  label:"Night Checklist",      icon:"✅", desc:"Evening habits & sleep prep"             },
  { id:"photos",     label:"Evening Photos",       icon:"📷", desc:"Upload photos from your day"             },
];

const DEFAULT_SECTIONS = () => ({
  morning: Object.fromEntries(MORNING_SECTIONS.map(s => [s.id, true])),
  evening: Object.fromEntries(EVENING_SECTIONS.map(s => [s.id, true])),
});

export function loadSectionPrefs() {
  try { return JSON.parse(localStorage.getItem(SECTIONS_KEY)) || DEFAULT_SECTIONS(); }
  catch { return DEFAULT_SECTIONS(); }
}
export function saveSectionPrefs(prefs) {
  localStorage.setItem(SECTIONS_KEY, JSON.stringify(prefs));
}
export function isSectionVisible(timeOfDay, sectionId) {
  const prefs = loadSectionPrefs();
  const val = prefs[timeOfDay]?.[sectionId];
  return val === undefined ? true : val;
}
export function toggleSection(timeOfDay, sectionId) {
  const prefs = loadSectionPrefs();
  if (!prefs[timeOfDay]) prefs[timeOfDay] = {};
  prefs[timeOfDay][sectionId] = !isSectionVisible(timeOfDay, sectionId);
  saveSectionPrefs(prefs);
}

// ── Categories ────────────────────────────────────────────
export const CATEGORIES = {
  gratitude:  { label:"Gratitude",  color:"#16a34a" },
  intention:  { label:"Intention",  color:"#E8B84B" },
  emotion:    { label:"Emotion",    color:"#5B8AF0" },
  discipline: { label:"Discipline", color:"#C1121F" },
  spiritual:  { label:"Spiritual",  color:"#9B72F0" },
  work:       { label:"Work",       color:"#1D3557" },
  custom:     { label:"Custom",     color:"#9B9589" },
};

// ── Core (non-deletable) questions ────────────────────────
// These are reference questions that mirror the existing hardcoded
// morning and evening fields so users understand the structure.
export const CORE_MORNING = [
  { id:"core_m1", promptText:"What is your main intention today?",            category:"intention"  },
  { id:"core_m2", promptText:"What might challenge your discipline today?",   category:"discipline" },
  { id:"core_m3", promptText:"What one action would make today feel aligned?", category:"intention" },
];
export const CORE_EVENING = [
  { id:"core_e1", promptText:"What went well today?",                              category:"gratitude"  },
  { id:"core_e2", promptText:"What challenged your peace or discipline today?",    category:"discipline" },
  { id:"core_e3", promptText:"What is one lesson or next step for tomorrow?",      category:"intention"  },
];

// ── Storage helpers ───────────────────────────────────────
export function loadQuestions() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}
function save(qs) {
  localStorage.setItem(KEY, JSON.stringify(qs));
}

// ── Queries ───────────────────────────────────────────────
export function getActiveQuestions(timeOfDay) {
  return loadQuestions()
    .filter(q => q.isActive && (q.timeOfDay === timeOfDay || q.timeOfDay === "both"))
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
    });
}

// ── CRUD ──────────────────────────────────────────────────
export function createQuestion({ promptText, timeOfDay, category }) {
  const qs = loadQuestions();
  const maxOrder = qs.reduce((m, q) => Math.max(m, q.sortOrder ?? 0), 0);
  const q = {
    id: crypto.randomUUID(),
    promptText: promptText.trim(),
    timeOfDay,
    category: category || "custom",
    isPinned: false,
    isActive: true,
    sortOrder: maxOrder + 1,
    createdAt: new Date().toISOString(),
  };
  save([...qs, q]);
  return q;
}

export function updateQuestion(id, updates) {
  save(loadQuestions().map(q => q.id === id ? { ...q, ...updates } : q));
}

export function deleteQuestion(id) {
  save(loadQuestions().filter(q => q.id !== id));
}

export function togglePin(id) {
  const q = loadQuestions().find(q => q.id === id);
  if (q) updateQuestion(id, { isPinned: !q.isPinned });
}

export function toggleActive(id) {
  const q = loadQuestions().find(q => q.id === id);
  if (q) updateQuestion(id, { isActive: !q.isActive });
}

export function moveQuestion(id, direction) {
  const qs = loadQuestions().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const idx = qs.findIndex(q => q.id === id);
  if (idx < 0) return;
  const swap = direction === "up" ? idx - 1 : idx + 1;
  if (swap < 0 || swap >= qs.length) return;
  const a = qs[idx].sortOrder ?? idx;
  const b = qs[swap].sortOrder ?? swap;
  save(qs.map(q =>
    q.id === id        ? { ...q, sortOrder: b } :
    q.id === qs[swap].id ? { ...q, sortOrder: a } : q
  ));
}

// ── Question Packs ────────────────────────────────────────
export const QUESTION_PACKS = [
  {
    id: "adhd_start",
    name: "ADHD / Start Mode",
    icon: "⚡",
    description: "Small, concrete, body-based prompts for when you can't begin.",
    questions: [
      { promptText:"What is the smallest action I can take in the next 60 seconds?", timeOfDay:"morning", category:"intention"  },
      { promptText:"What is making this feel hard to start?",                         timeOfDay:"morning", category:"emotion"    },
      { promptText:"Where should my phone be while I work?",                          timeOfDay:"morning", category:"discipline" },
    ],
  },
  {
    id: "spiritual",
    name: "Spiritual Discipline",
    icon: "🙏",
    description: "Walk with intention and reflect on your spiritual alignment.",
    questions: [
      { promptText:"What spirit do I want to walk in today?",              timeOfDay:"morning", category:"spiritual" },
      { promptText:"Where did I show restraint or self-control today?",    timeOfDay:"evening", category:"spiritual" },
      { promptText:"What scripture or principle guided me today?",         timeOfDay:"evening", category:"spiritual" },
    ],
  },
  {
    id: "creative",
    name: "Creative Builder",
    icon: "🎨",
    description: "For creators, makers, and builders in motion.",
    questions: [
      { promptText:"What am I building or making today?",                    timeOfDay:"morning", category:"intention" },
      { promptText:"What idea keeps returning to me?",                       timeOfDay:"morning", category:"custom"    },
      { promptText:"What did I create today, even if it's unfinished?",      timeOfDay:"evening", category:"custom"    },
    ],
  },
  {
    id: "work_focus",
    name: "Work Focus",
    icon: "💼",
    description: "Stay sharp on what matters most at work.",
    questions: [
      { promptText:"What is the single most important work task today?",    timeOfDay:"morning", category:"work"      },
      { promptText:"What could delay or block me today?",                   timeOfDay:"morning", category:"discipline" },
      { promptText:"What did I finish or meaningfully move forward today?", timeOfDay:"evening", category:"work"      },
    ],
  },
];

export function isPackInstalled(packId) {
  const pack = QUESTION_PACKS.find(p => p.id === packId);
  if (!pack) return false;
  const existing = new Set(loadQuestions().map(q => q.promptText));
  const hits = pack.questions.filter(pq => existing.has(pq.promptText)).length;
  return hits >= Math.ceil(pack.questions.length / 2);
}

export function installPack(packId) {
  const pack = QUESTION_PACKS.find(p => p.id === packId);
  if (!pack) return 0;
  let count = 0;
  const existing = new Set(loadQuestions().map(q => q.promptText));
  pack.questions.forEach(pq => {
    if (!existing.has(pq.promptText)) { createQuestion(pq); count++; }
  });
  return count;
}
