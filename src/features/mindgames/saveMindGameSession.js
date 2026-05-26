// ── MindGames — session persistence (localStorage Phase 1) ─
// Session shape is designed to be Supabase/Postgres-ready for Phase 2.

const STORAGE_KEY = "mg_sessions_v1";
const MAX_SESSIONS = 500;

const genId = () =>
  typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Save a completed game session.
 * @param {object} session - partial session (gameType, score, etc.)
 * @returns {object|null} the saved session with id + createdAt, or null on error
 */
export function saveMindGameSession(session) {
  try {
    const existing = _load();
    const record = {
      ...session,
      id: genId(),
      createdAt: new Date().toISOString(),
    };
    const next = [record, ...existing].slice(0, MAX_SESSIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return record;
  } catch {
    return null;
  }
}

/**
 * Load all sessions, optionally filtered by gameType.
 * @param {string|null} gameType
 * @returns {object[]}
 */
export function loadMindGameSessions(gameType = null) {
  try {
    const sessions = _load();
    return gameType ? sessions.filter(s => s.gameType === gameType) : sessions;
  } catch {
    return [];
  }
}

/**
 * Get the N most recent sessions across all game types.
 */
export function getRecentSessions(limit = 10) {
  return _load().slice(0, limit);
}

/**
 * Get the personal best for a given gameType by score.
 */
export function getPersonalBest(gameType) {
  const sessions = loadMindGameSessions(gameType);
  if (!sessions.length) return null;
  return sessions.reduce((best, s) => (s.score > best.score ? s : best), sessions[0]);
}

function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
