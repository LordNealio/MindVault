// Habit Service: Core business logic for habits
// CRUD operations, scoring, RRULE generation, occurrences

import { v4 as uuidv4 } from "uuid";
import { RRule } from "rrule";
import { initHabitDB } from "./habitDB.js";

export function generateId() {
  return uuidv4();
}

// ── RRULE UTILITIES ────────────────────────────────────────
export function generateOccurrences(rruleStr, startDate, endDate) {
  try {
    const rule = RRule.fromString(rruleStr);
    const occurrences = rule.between(startDate, endDate, true);
    return occurrences.map(d => ({
      dueAt: d.toISOString(),
    }));
  } catch (err) {
    console.error("Invalid RRULE:", rruleStr, err);
    throw new Error(`Invalid recurrence rule: ${err.message}`);
  }
}

export function validateRRULE(rruleStr) {
  try {
    RRule.fromString(rruleStr);
    return true;
  } catch {
    return false;
  }
}

// ── SCORING ────────────────────────────────────────────────
export function calculateScores(ratings) {
  const { difficulty, timeRequired, enjoyment, impact, alignment } = ratings;

  // Ease = inverse product of difficulty, time, and enjoyment
  const ease = (enjoyment / ((difficulty + 1) * (timeRequired + 1))) * 10;

  // Leverage = product of impact and alignment
  const leverage = (impact * alignment) / 10;

  // Compound score: 60% leverage, 40% ease
  const compoundScore = (leverage * 0.6 + ease * 0.4);

  return {
    ease: Math.round(ease),
    leverage: Math.round(leverage),
    compoundScore: Math.round(Math.min(100, compoundScore * 10)),
  };
}

// ── CRUD: HABITS ───────────────────────────────────────────
export async function createHabit(habitData, rrule) {
  const db = await initHabitDB();

  if (!validateRRULE(rrule)) {
    throw new Error("Invalid recurrence rule");
  }

  const habitId = generateId();
  const now = new Date().toISOString();

  // 1. Create habit record
  const habit = {
    id: habitId,
    title: habitData.title,
    category: habitData.category,
    description: habitData.description || "",
    status: "active",
    createdAt: now,
    archivedAt: null,
  };

  // 2. Create version 1
  const version = {
    id: generateId(),
    habitId,
    versionNo: 1,
    title: habitData.title,
    rrule,
    measurementType: habitData.measurementType || "boolean",
    targetValue: habitData.targetValue || null,
    durations: habitData.durations || { full: 30, reduced: 15, minimum: 5 },
    cue: habitData.cue || { time: null, location: "", context: "" },
    ratings: habitData.ratings || { difficulty: 5, timeRequired: 5, enjoyment: 5, impact: 5, alignment: 5 },
    createdAt: now,
    changeReason: "Initial creation",
  };

  // 3. Generate occurrences for next 90 days.
  // Start from local midnight, not the current instant: RRULE's implicit
  // DTSTART is millisecond-truncated parse time, so between(now, …) can
  // land just after it and silently drop the creation day.
  const now_date = new Date();
  const startOfToday = new Date(now_date.getFullYear(), now_date.getMonth(), now_date.getDate(), 0, 0, 0);
  const endDate = new Date(now_date.getTime() + 90 * 24 * 60 * 60 * 1000);
  const occurrenceDates = generateOccurrences(rrule, startOfToday, endDate);

  const occurrences = occurrenceDates.map(occ => ({
    id: generateId(),
    habitId,
    habitVersionId: version.id,
    dueAt: occ.dueAt,
    status: "pending",
    completedAt: null,
    variant: null,
    actualValue: null,
    actualDurationMin: null,
    notes: null,
    mood: null,
    createdAt: now,
    updatedAt: now,
  }));

  // 4. Write all to DB
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["habits", "habit_versions", "habit_occurrences"], "readwrite");

    tx.objectStore("habits").add(habit);
    tx.objectStore("habit_versions").add(version);
    occurrences.forEach(occ => tx.objectStore("habit_occurrences").add(occ));

    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve({ habitId, versionId: version.id, occurrenceCount: occurrences.length });
  });
}

export async function getHabit(habitId) {
  const db = await initHabitDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["habits"], "readonly");
    const req = tx.objectStore("habits").get(habitId);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

export async function listHabits(includeArchived = false) {
  const db = await initHabitDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["habits"], "readonly");
    const index = tx.objectStore("habits").index("status");
    const req = includeArchived
      ? tx.objectStore("habits").getAll()
      : index.getAll("active");
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

export async function updateHabit(habitId, updates) {
  const db = await initHabitDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["habits"], "readwrite");
    const store = tx.objectStore("habits");
    const getReq = store.get(habitId);

    getReq.onsuccess = () => {
      const habit = getReq.result;
      if (!habit) {
        reject(new Error("Habit not found"));
        return;
      }

      const updated = { ...habit, ...updates, updatedAt: new Date().toISOString() };
      store.put(updated);
    };

    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
  });
}

export async function archiveHabit(habitId) {
  return updateHabit(habitId, {
    status: "archived",
    archivedAt: new Date().toISOString(),
  });
}

// ── CRUD: VERSIONS ─────────────────────────────────────────
export async function editHabitAndCreateVersion(habitId, habitData, rrule, changeReason) {
  const db = await initHabitDB();

  if (!validateRRULE(rrule)) {
    throw new Error("Invalid recurrence rule");
  }

  // Fetch current habit and latest version
  const habit = await getHabit(habitId);
  const versions = await getHabitVersions(habitId);
  const latestVersion = versions[versions.length - 1];

  const now = new Date().toISOString();

  // Create new version
  const newVersion = {
    id: generateId(),
    habitId,
    versionNo: (latestVersion?.versionNo || 0) + 1,
    title: habitData.title,
    rrule,
    measurementType: habitData.measurementType || latestVersion.measurementType,
    targetValue: habitData.targetValue ?? latestVersion.targetValue,
    durations: habitData.durations || latestVersion.durations,
    cue: habitData.cue || latestVersion.cue,
    ratings: habitData.ratings || latestVersion.ratings,
    createdAt: now,
    changeReason,
  };

  // Update habit title if changed
  const habitUpdates = { title: habitData.title };

  // Write to DB
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["habits", "habit_versions"], "readwrite");

    const habitReq = tx.objectStore("habits").get(habitId);
    habitReq.onsuccess = () => {
      const current = habitReq.result;
      tx.objectStore("habits").put({ ...current, ...habitUpdates });
    };

    tx.objectStore("habit_versions").add(newVersion);

    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve(newVersion);
  });
}

export async function getHabitVersions(habitId) {
  const db = await initHabitDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["habit_versions"], "readonly");
    const index = tx.objectStore("habit_versions").index("habitId");
    const req = index.getAll(habitId);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      resolve(req.result.sort((a, b) => a.versionNo - b.versionNo));
    };
  });
}

export async function getLatestVersion(habitId) {
  const versions = await getHabitVersions(habitId);
  return versions[versions.length - 1];
}

// ── CRUD: OCCURRENCES ──────────────────────────────────────
export async function getOccurrencesForDate(targetDate) {
  const db = await initHabitDB();
  // Window must span the LOCAL calendar day. Deriving it from
  // toISOString() (UTC) makes today's habits invisible for most of the
  // day anywhere west of Greenwich.
  const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
  const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["habit_occurrences"], "readonly");
    const index = tx.objectStore("habit_occurrences").index("dueAt");
    const range = IDBKeyRange.bound(dayStart.toISOString(), dayEnd.toISOString());
    const req = index.getAll(range);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const results = req.result;
      resolve(results.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt)));
    };
  });
}

export async function getOccurrencesByHabit(habitId, startDate, endDate) {
  const db = await initHabitDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["habit_occurrences"], "readonly");
    const index = tx.objectStore("habit_occurrences").index("habitId, dueAt");
    const range = IDBKeyRange.bound([habitId, startDate.toISOString()], [habitId, endDate.toISOString()]);
    const req = index.getAll(range);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

export async function completeOccurrence(occurrenceId, variant, actualValue, actualDurationMin, notes, mood) {
  const db = await initHabitDB();
  const now = new Date().toISOString();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["habit_occurrences"], "readwrite");
    const store = tx.objectStore("habit_occurrences");
    const req = store.get(occurrenceId);

    req.onsuccess = () => {
      const occ = req.result;
      const updated = {
        ...occ,
        status: "completed",
        completedAt: now,
        variant,
        actualValue,
        actualDurationMin,
        notes,
        mood,
        updatedAt: now,
      };
      store.put(updated);
    };

    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
  });
}

export async function skipOccurrence(occurrenceId) {
  const db = await initHabitDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["habit_occurrences"], "readwrite");
    const store = tx.objectStore("habit_occurrences");
    const req = store.get(occurrenceId);

    req.onsuccess = () => {
      const occ = req.result;
      store.put({
        ...occ,
        status: "skipped",
        updatedAt: new Date().toISOString(),
      });
    };

    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
  });
}

// ── CRUD: NOTES ────────────────────────────────────────────
export async function createHabitNote(habitId, occurrenceId, noteType, body, mood, tags = [], aiVisible = false) {
  const db = await initHabitDB();
  const note = {
    id: generateId(),
    habitId,
    occurrenceId: occurrenceId || null,
    noteType,
    body,
    mood,
    tags,
    aiVisible,
    createdAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["habit_notes"], "readwrite");
    const req = tx.objectStore("habit_notes").add(note);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(note);
  });
}

export async function getHabitNotes(habitId) {
  const db = await initHabitDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["habit_notes"], "readonly");
    const index = tx.objectStore("habit_notes").index("habitId, createdAt");
    const req = index.getAll([habitId]);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      resolve(req.result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    };
  });
}

// ── CRUD: SOPs ─────────────────────────────────────────────
export async function createSOP(habitId, title, body, checklist = []) {
  const db = await initHabitDB();
  const now = new Date().toISOString();
  const sop = {
    id: generateId(),
    habitId,
    title,
    body,
    checklist,
    activeVersion: 1,
    createdAt: now,
    updatedAt: now,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["habit_sops"], "readwrite");
    const req = tx.objectStore("habit_sops").add(sop);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(sop);
  });
}

export async function getSOPsByHabit(habitId) {
  const db = await initHabitDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["habit_sops"], "readonly");
    const index = tx.objectStore("habit_sops").index("habitId");
    const req = index.getAll(habitId);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

export async function updateSOP(sopId, updates) {
  const db = await initHabitDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["habit_sops"], "readwrite");
    const store = tx.objectStore("habit_sops");
    const req = store.get(sopId);

    req.onsuccess = () => {
      const sop = req.result;
      store.put({ ...sop, ...updates, updatedAt: new Date().toISOString() });
    };

    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
  });
}
