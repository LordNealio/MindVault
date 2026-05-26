/**
 * api/automation/invoke.js — Server-side Anthropic proxy.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  SECURITY CONTRACT — DO NOT WEAKEN WITHOUT REVIEW                       ║
 * ║                                                                          ║
 * ║  This is the ONLY file in the entire codebase that reads                 ║
 * ║  ANTHROPIC_API_KEY. It never returns it, never logs it, never           ║
 * ║  reflects it in responses or error messages.                             ║
 * ║                                                                          ║
 * ║  This is NOT a generic AI passthrough. Every call is:                   ║
 * ║    1. Session-token validated                                            ║
 * ║    2. Run-scoped (runId required and format-checked)                     ║
 * ║    3. Model-allowlisted (no arbitrary model selection)                   ║
 * ║    4. Size-bounded (prevents prompt inflation abuse)                     ║
 * ║    5. Server-to-server (no dangerous-direct-browser-access header)       ║
 * ║                                                                          ║
 * ║  Phase 1 limitation: runId is format-checked but NOT validated           ║
 * ║  against a database for ownership. Phase 2 adds Postgres + ownership     ║
 * ║  check. Current risk: a valid session token holder can invoke the        ║
 * ║  proxy with any UUID. This is acceptable for single-user private use.    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Required environment variables (Vercel dashboard → Settings → Environment):
 *   ANTHROPIC_API_KEY        — Anthropic API key (server only, never client)
 *   AUTOMATION_ACCESS_TOKEN  — Shared access token given to authorized users
 *
 * Local development: requires `vercel dev`, not `vite dev`.
 *   `vercel dev` runs both the Vite frontend and serverless functions together.
 *   Install: npm install -g vercel
 *   Run:     vercel dev (replaces npm run dev for automation features)
 */

// ── Allowlists — duplicated from contracts.js intentionally.
// The server must not import client-side modules. Keep these in sync manually.
const ALLOWED_MODELS = new Set([
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-6",
  "claude-opus-4-6",
]);

const MAX_TOKENS_LIMIT  = 4096;
const MAX_SYSTEM_CHARS  = 10000;
const MAX_MESSAGES      = 20;
const MAX_TOTAL_CHARS   = 60000; // ~15K tokens across all messages
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  // ── Method guard ────────────────────────────────────────────────────────
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── 1. Session token validation ─────────────────────────────────────────
  // The session token proves the caller is an authorized user of this app.
  // It is NOT the Anthropic API key — that lives in server env only.
  const auth = req.headers["authorization"] || "";
  if (!auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }
  const submittedToken = auth.slice(7).trim();
  const expectedToken  = process.env.AUTOMATION_ACCESS_TOKEN;

  if (!expectedToken) {
    // Misconfigured — do not reveal details to client
    console.error("[invoke] AUTOMATION_ACCESS_TOKEN not configured in environment");
    return res.status(500).json({ error: "Service not configured" });
  }
  if (!submittedToken || submittedToken !== expectedToken) {
    return res.status(401).json({ error: "Invalid access token" });
  }

  // ── 2. Parse body ────────────────────────────────────────────────────────
  const { runId, model, maxTokens, system, messages } = req.body || {};

  // ── 3. Validate runId ────────────────────────────────────────────────────
  // Format check only in Phase 1. Phase 2 adds ownership check against Postgres.
  if (!runId || typeof runId !== "string" || !UUID_RE.test(runId)) {
    return res.status(400).json({ error: "runId must be a valid UUID" });
  }

  // ── 4. Validate model ────────────────────────────────────────────────────
  if (!model || !ALLOWED_MODELS.has(model)) {
    return res.status(400).json({
      error: `model must be one of: ${[...ALLOWED_MODELS].join(", ")}`,
    });
  }

  // ── 5. Validate maxTokens ────────────────────────────────────────────────
  if (typeof maxTokens !== "number" || maxTokens < 1 || maxTokens > MAX_TOKENS_LIMIT) {
    return res.status(400).json({ error: `maxTokens must be 1–${MAX_TOKENS_LIMIT}` });
  }

  // ── 6. Validate system ───────────────────────────────────────────────────
  if (typeof system !== "string" || system.length > MAX_SYSTEM_CHARS) {
    return res.status(400).json({ error: "system must be a string under 10000 chars" });
  }

  // ── 7. Validate messages ─────────────────────────────────────────────────
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return res.status(400).json({
      error: `messages must be a non-empty array (max ${MAX_MESSAGES} items)`,
    });
  }

  let totalChars = 0;
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") {
      return res.status(400).json({ error: "Each message must be an object" });
    }
    if (!["user", "assistant"].includes(msg.role)) {
      return res.status(400).json({ error: "Message role must be 'user' or 'assistant'" });
    }
    // content may be a string (text) or array (vision/multipart)
    if (typeof msg.content !== "string" && !Array.isArray(msg.content)) {
      return res.status(400).json({ error: "Message content must be a string or array" });
    }
    const chars = typeof msg.content === "string"
      ? msg.content.length
      : JSON.stringify(msg.content).length;
    totalChars += chars;
  }
  if (totalChars > MAX_TOTAL_CHARS) {
    return res.status(400).json({
      error: `Total message content exceeds ${MAX_TOTAL_CHARS} characters`,
    });
  }

  // ── 8. Get Anthropic API key — server env only ───────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[invoke] ANTHROPIC_API_KEY not configured in environment");
    return res.status(500).json({ error: "Service not configured" });
  }

  // ── 9. Call Anthropic — server-to-server ────────────────────────────────
  // No anthropic-dangerous-direct-browser-access header.
  // This is a server-to-server call on behalf of the authorized user.
  const started = Date.now();
  let anthropicRes;

  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
    });
  } catch (err) {
    console.error(`[invoke] Network error for run ${runId}:`, err.message);
    return res.status(502).json({ error: `Anthropic unreachable: ${err.message}` });
  }

  if (!anthropicRes.ok) {
    let detail = `HTTP ${anthropicRes.status}`;
    try {
      const body = await anthropicRes.json();
      // Extract error message but never forward the full body (may contain key reflections)
      detail = body?.error?.message || detail;
    } catch { /* ignore */ }
    console.error(`[invoke] Anthropic error for run ${runId}: ${detail}`);
    return res.status(502).json({ error: `Anthropic API error: ${detail}` });
  }

  const data = await anthropicRes.json();
  if (data.error) {
    return res.status(502).json({ error: data.error.message });
  }

  const text = data.content.map(b => b.text || "").join("");

  // ── 10. Audit log — metadata only, never content ─────────────────────────
  // Content is private. Only operational metadata is logged.
  console.log("[invoke]", JSON.stringify({
    runId,
    model,
    inputTokens:  data.usage?.input_tokens,
    outputTokens: data.usage?.output_tokens,
    durationMs:   Date.now() - started,
    ts:           new Date().toISOString(),
  }));

  // ── 11. Return text only — never reflect request or expose key ───────────
  return res.status(200).json({ text });
}
