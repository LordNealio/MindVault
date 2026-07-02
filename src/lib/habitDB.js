// Habit System: Local-first storage using IndexedDB
// Database: mindvault_habits_v1 — must be separate from mindvault_v1,
// which App.jsx and metrics.js open at the same version with different
// schemas (same-name DBs race and whoever loses gets no object stores).
// Stores: habits, habit_versions, habit_occurrences, habit_notes, habit_sops

export async function initHabitDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("mindvault_habits_v1", 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      // Table: habits
      if (!db.objectStoreNames.contains("habits")) {
        const store = db.createObjectStore("habits", { keyPath: "id" });
        store.createIndex("status", "status");
        store.createIndex("createdAt", "createdAt");
      }

      // Table: habit_versions
      if (!db.objectStoreNames.contains("habit_versions")) {
        const store = db.createObjectStore("habit_versions", { keyPath: "id" });
        store.createIndex("habitId", "habitId");
        store.createIndex("createdAt", "createdAt");
      }

      // Table: habit_occurrences
      if (!db.objectStoreNames.contains("habit_occurrences")) {
        const store = db.createObjectStore("habit_occurrences", { keyPath: "id" });
        store.createIndex("habitId, dueAt", ["habitId", "dueAt"]);
        store.createIndex("dueAt", "dueAt");
        store.createIndex("status", "status");
        store.createIndex("createdAt", "createdAt");
      }

      // Table: habit_notes
      if (!db.objectStoreNames.contains("habit_notes")) {
        const store = db.createObjectStore("habit_notes", { keyPath: "id" });
        store.createIndex("habitId, createdAt", ["habitId", "createdAt"]);
        store.createIndex("noteType", "noteType");
        store.createIndex("aiVisible", "aiVisible");
      }

      // Table: habit_sops
      if (!db.objectStoreNames.contains("habit_sops")) {
        const store = db.createObjectStore("habit_sops", { keyPath: "id" });
        store.createIndex("habitId", "habitId");
      }
    };
  });
}
