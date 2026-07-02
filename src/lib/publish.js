// Publish module: private idea → public content assets.
// Own IndexedDB database (mindvault_publish_v1) — never share a DB name
// with another module; same-name/same-version DBs silently lose stores.
// AI calls ride the hardened /api/automation/invoke proxy via callProxy.

import { callProxy } from "./ai.js";

const DB_NAME = "mindvault_publish_v1";

export const FORMATS = [
  { id: "instagram", label: "Instagram Caption", icon: "📸" },
  { id: "linkedin", label: "LinkedIn Post", icon: "💼" },
  { id: "thread", label: "X / Threads Thread", icon: "🧵" },
  { id: "newsletter", label: "Newsletter Blurb", icon: "✉️" },
  { id: "blog", label: "Blog Outline", icon: "📝" },
];

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("drafts")) {
        const store = db.createObjectStore("drafts", { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains("brand")) {
        db.createObjectStore("brand", { keyPath: "id" });
      }
    };
  });
}

// ── Brand profile ────────────────────────────────────────────
export async function getBrandProfile() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction("brand").objectStore("brand").get("default");
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result || {
      id: "default", name: "", about: "", audience: "", tone: "", ctas: "",
    });
  });
}

export async function saveBrandProfile(profile) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("brand", "readwrite");
    tx.objectStore("brand").put({ ...profile, id: "default", updatedAt: new Date().toISOString() });
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
  });
}

// ── Drafts ───────────────────────────────────────────────────
export async function saveDraft(draft) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("drafts", "readwrite");
    tx.objectStore("drafts").put({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...draft,
    });
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
  });
}

export async function listDrafts() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction("drafts").objectStore("drafts").getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(
      req.result.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    );
  });
}

export async function deleteDraft(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("drafts", "readwrite");
    tx.objectStore("drafts").delete(id);
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
  });
}

// ── Generation ───────────────────────────────────────────────
const FORMAT_INSTRUCTIONS = {
  instagram: "Instagram caption: a scroll-stopping first line, 2-4 short paragraphs with line breaks, a clear CTA, then 8-12 relevant hashtags on the final line.",
  linkedin: "LinkedIn post: strong one-line hook, short punchy paragraphs (1-2 sentences each) with blank lines between them, a substantive insight, end with a question or CTA. No hashtag spam — 3 max.",
  thread: "X/Threads thread: 5-8 numbered posts, each under 280 characters. Post 1 is the hook, the last post is the CTA. Format as '1/ ...' '2/ ...' etc.",
  newsletter: "Newsletter blurb: a subject line (prefixed 'Subject: '), then a 120-180 word section with a personal, direct tone and one clear takeaway.",
  blog: "Blog outline: a compelling title, then 4-6 section headers each with 2-3 bullet points of what to cover. Include a suggested intro angle and closing CTA.",
};

function buildSystem(brand) {
  const brandBlock = [
    brand.name && `Brand/person: ${brand.name}`,
    brand.about && `What they do: ${brand.about}`,
    brand.audience && `Audience: ${brand.audience}`,
    brand.tone && `Voice & tone: ${brand.tone}`,
    brand.ctas && `Preferred CTAs / links: ${brand.ctas}`,
  ].filter(Boolean).join("\n");

  return `You are a senior content strategist and copywriter inside MindVault. You turn one raw idea into polished, platform-native content assets.

${brandBlock ? `BRAND PROFILE (match this voice in everything):\n${brandBlock}\n` : "No brand profile set — use a warm, direct, first-person voice.\n"}
Rules:
- Stay truthful to the idea; never invent facts, stats, or credentials.
- Write like a human, not a brand robot. No "In today's fast-paced world".
- Each asset must stand alone and be ready to paste.
- Output each requested format between delimiters exactly like:
<<<formatid>>>
(content)
<<<end>>>
No commentary outside the delimiters.`;
}

export async function generateAssets(ideaText, formatIds, brand, accessToken) {
  const wanted = FORMATS.filter(f => formatIds.includes(f.id));
  const instructions = wanted
    .map(f => `<<<${f.id}>>> — ${FORMAT_INSTRUCTIONS[f.id]}`)
    .join("\n\n");

  const userMsg = `THE IDEA (from my private notes):\n"""\n${ideaText}\n"""\n\nCreate these assets:\n\n${instructions}`;

  const text = await callProxy(
    [{ role: "user", content: userMsg }],
    buildSystem(brand),
    accessToken,
    4096
  );

  // Parse <<<id>>> ... <<<end>>> sections
  const assets = {};
  for (const f of wanted) {
    const re = new RegExp(`<<<${f.id}>>>\\s*([\\s\\S]*?)\\s*<<<end>>>`, "i");
    const m = text.match(re);
    if (m) assets[f.id] = m[1].trim();
  }
  // Fallback: if parsing failed entirely, return raw text under first format
  if (Object.keys(assets).length === 0 && text.trim()) {
    assets[wanted[0]?.id || "instagram"] = text.trim();
  }
  return assets;
}

// Extract usable text from a journal entry for the idea box.
export function entryToText(entry) {
  const parts = [
    entry.morning?.identity && `Identity: I am ${entry.morning.identity}`,
    entry.morning?.journal,
    entry.evening?.feel1,
    entry.evening?.learned && `Learned: ${entry.evening.learned}`,
    entry.evening?.memory && `Memorable: ${entry.evening.memory}`,
  ].filter(Boolean);
  return parts.join("\n\n");
}
