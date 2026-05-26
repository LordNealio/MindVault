/**
 * apiClient.js — Automation transport layer.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  SLICE 2 PHASE 1 — PROXY ARCHITECTURE ACTIVE                           ║
 * ║                                                                          ║
 * ║  Automation Anthropic calls now route through the server-side proxy at  ║
 * ║  /api/automation/invoke. The Anthropic API key lives in Vercel env       ║
 * ║  vars only and never touches the browser.                               ║
 * ║                                                                          ║
 * ║  callAgentProxy() — ACTIVE. Use this for all automation agent calls.    ║
 * ║  callAnthropic()  — DEPRECATED. Kept for reference only. Do not call.  ║
 * ║                                                                          ║
 * ║  Local development note:                                                 ║
 * ║    The proxy requires `vercel dev`, not `vite dev`.                     ║
 * ║    `vercel dev` runs both the Vite frontend and serverless functions.    ║
 * ║    Install: npm install -g vercel                                        ║
 * ║    Run:     vercel dev  (replaces npm run dev for automation features)   ║
 * ║    Or use:  npm run dev:full                                             ║
 * ║                                                                          ║
 * ║  Phase 1 limitation: run ownership is format-checked but not validated   ║
 * ║  against a database. Phase 2 (Postgres) adds full ownership checks.     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

const PROXY_URL = "/api/automation/invoke";

/**
 * callAgentProxy — routes an agent call through the server-side Anthropic proxy.
 *
 * The server reads ANTHROPIC_API_KEY from env vars and calls Anthropic
 * server-to-server. The key never reaches the browser.
 *
 * @param {object}      params
 * @param {string}      params.sessionToken — user's automation access token
 * @param {string}      params.runId        — active run ID (UUID)
 * @param {string}      params.model        — model string (from MODELS constant)
 * @param {number}      params.maxTokens    — max_tokens for this call
 * @param {string}      params.system       — system prompt
 * @param {object[]}    params.messages     — messages array
 * @param {AbortSignal} [params.signal]     — optional AbortSignal from orchestrator
 * @returns {Promise<string>}              — text content from Anthropic response
 * @throws {Error}                         — on proxy error, auth failure, or abort
 */
export async function callAgentProxy({
  sessionToken, runId, model, maxTokens, system, messages, signal,
}) {
  if (!sessionToken) {
    throw new Error("callAgentProxy: no session token — automation not connected");
  }
  if (!runId) {
    throw new Error("callAgentProxy: runId required");
  }

  let res;
  try {
    res = await fetch(PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${sessionToken}`,
      },
      signal,
      body: JSON.stringify({ runId, model, maxTokens, system, messages }),
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    // Likely a network error or the proxy endpoint doesn't exist (local dev without vercel dev)
    if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
      throw new Error(
        "Cannot reach the automation proxy. " +
        "For local development, use `vercel dev` instead of `vite dev`. " +
        "See DEPLOY.md for setup instructions."
      );
    }
    throw new Error(`Proxy network error: ${err.message}`);
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body?.error || detail;
    } catch { /* ignore */ }
    // Surface auth errors clearly so the UI can prompt for token re-entry
    if (res.status === 401) throw new Error(`AUTH_ERROR: ${detail}`);
    throw new Error(`Proxy error: ${detail}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  if (typeof data.text !== "string") {
    throw new Error("Proxy returned unexpected response shape");
  }
  return data.text;
}

// ── DEPRECATED ────────────────────────────────────────────────────────────
/**
 * callAnthropic — DEPRECATED. Browser-direct Anthropic call.
 * Kept for reference and potential local dev fallback only.
 * DO NOT use in production. Replaced by callAgentProxy in Slice 2 Phase 1.
 *
 * This function represents the Slice 1 security compromise:
 *   - Requires anthropic-dangerous-direct-browser-access header
 *   - Exposes the API key to browser memory and DevTools
 *   - Has no server-side audit trail
 *
 * @deprecated Use callAgentProxy instead.
 */
export async function callAnthropic({ apiKey, model, maxTokens, system, messages, signal }) {
  if (!apiKey) throw new Error("callAnthropic: no API key (deprecated function)");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":                              "application/json",
      "x-api-key":                                 apiKey,
      "anthropic-version":                         "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    signal,
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
  });

  if (res.name === "AbortError") throw res;
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { detail = (await res.json())?.error?.message || detail; } catch {}
    throw new Error(`Anthropic API error: ${detail}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content.map(b => b.text || "").join("");
}
