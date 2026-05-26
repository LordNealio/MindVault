/**
 * db.js — Automation-specific IndexedDB layer.
 *
 * Uses a SEPARATE database ("mindvault_automation_v1") from the journal DB
 * to avoid version conflicts and keep automation data isolated.
 *
 * Architecture note: In Slice 2 this will be replaced by server-side Postgres
 * once a backend is added. The API surface intentionally mirrors the Postgres
 * schema from the implementation brief so migration is mechanical.
 */

const DB_NAME    = "mindvault_automation_v1";
const DB_VERSION = 1;

let _db = null;

function openAutomationDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      // automation_requests — keyed by id
      if (!db.objectStoreNames.contains("requests")) {
        db.createObjectStore("requests", { keyPath: "id" });
      }

      // automation_runs — keyed by id, index on requestId
      if (!db.objectStoreNames.contains("runs")) {
        const runs = db.createObjectStore("runs", { keyPath: "id" });
        runs.createIndex("by_requestId", "requestId", { unique: false });
        runs.createIndex("by_state",     "state",     { unique: false });
      }

      // automation_steps — keyed by id, index on runId
      if (!db.objectStoreNames.contains("steps")) {
        const steps = db.createObjectStore("steps", { keyPath: "id" });
        steps.createIndex("by_runId", "runId", { unique: false });
      }

      // audit_events — keyed by id, index on runId
      // Append-only; never deleted in Slice 1.
      if (!db.objectStoreNames.contains("audit_events")) {
        const ae = db.createObjectStore("audit_events", { keyPath: "id" });
        ae.createIndex("by_runId",     "runId",     { unique: false });
        ae.createIndex("by_createdAt", "createdAt", { unique: false });
      }

      // policy_decisions — keyed by id, index on runId
      if (!db.objectStoreNames.contains("policy_decisions")) {
        const pd = db.createObjectStore("policy_decisions", { keyPath: "id" });
        pd.createIndex("by_runId", "runId", { unique: false });
      }
    };

    req.onsuccess = (e) => { _db = e.target.result; res(_db); };
    req.onerror   = (e) => rej(new Error(`AutomationDB open failed: ${e.target.error}`));
  });
}

// ── Generic CRUD helpers ──────────────────────────────────────────────────

async function put(store, value) {
  const db = await openAutomationDB();
  return new Promise((res, rej) => {
    const tx  = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).put(value);
    req.onsuccess = () => res(value);
    req.onerror   = () => rej(req.error);
  });
}

async function get(store, key) {
  const db = await openAutomationDB();
  return new Promise((res, rej) => {
    const req = db.transaction(store, "readonly").objectStore(store).get(key);
    req.onsuccess = () => res(req.result || null);
    req.onerror   = () => rej(req.error);
  });
}

async function getAll(store) {
  const db = await openAutomationDB();
  return new Promise((res, rej) => {
    const req = db.transaction(store, "readonly").objectStore(store).getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror   = () => rej(req.error);
  });
}

async function getByIndex(store, indexName, value) {
  const db = await openAutomationDB();
  return new Promise((res, rej) => {
    const tx    = db.transaction(store, "readonly");
    const idx   = tx.objectStore(store).index(indexName);
    const req   = idx.getAll(value);
    req.onsuccess = () => res(req.result || []);
    req.onerror   = () => rej(req.error);
  });
}

// ── Public API ────────────────────────────────────────────────────────────

// Requests
export const saveRequest    = (r)   => put("requests", r);
export const getRequest     = (id)  => get("requests", id);
export const getAllRequests  = ()    => getAll("requests");

// Runs
export const saveRun        = (r)   => put("runs", r);
export const getRun         = (id)  => get("runs", id);
export const getAllRuns      = ()    => getAll("runs");
export const getRunsByState = (state) => getByIndex("runs", "by_state", state);

// Steps
export const saveStep       = (s)   => put("steps", s);
export const getStepsForRun = (rid) => getByIndex("steps", "by_runId", rid);

/**
 * updateStep — patch an existing step by id.
 * Used by orchestrator for lifecycle transitions: pending → running → completed/failed.
 */
export async function updateStep(id, patch) {
  const existing = await get("steps", id);
  if (!existing) throw new Error(`Step not found: ${id}`);
  return put("steps", { ...existing, ...patch });
}

// Audit events — fire-and-forget helper (never throws)
export function appendAuditEvent(event) {
  return put("audit_events", event).catch((err) => {
    console.warn("[AutomationDB] audit write failed (non-fatal):", err);
  });
}
export const getAuditEventsForRun = (rid) =>
  getByIndex("audit_events", "by_runId", rid);

// Policy decisions
export const savePolicyDecision       = (p)   => put("policy_decisions", p);
export const getPolicyDecisionsForRun = (rid) =>
  getByIndex("policy_decisions", "by_runId", rid);
