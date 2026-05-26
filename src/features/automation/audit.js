/**
 * audit.js — Structured audit logger for all automation actions.
 *
 * Design rules (from implementation brief + MCP Zero-Trust addendum):
 * - Every agent start/complete is logged.
 * - Every state transition is logged.
 * - Every policy block is logged.
 * - Audit writes are FIRE-AND-FORGET — never block the execution path.
 * - Metadata must be sanitised before logging (no secrets, no raw tokens).
 * - Logs are immutable — no update or delete functions exposed.
 */

import { appendAuditEvent } from "./db.js";
import { uuid, nowISO, AUDIT_EVENT } from "./contracts.js";

/**
 * log — write a single audit event.
 *
 * @param {object} params
 * @param {string} [params.runId]
 * @param {"user"|"agent"|"system"|"webhook"} params.actorType
 * @param {string} [params.actorId]
 * @param {string} params.eventType   - use AUDIT_EVENT constants
 * @param {"info"|"warn"|"error"|"critical"} params.severity
 * @param {string} params.message
 * @param {Record<string,unknown>} [params.metadata]
 */
export function log({
  runId,
  actorType = "system",
  actorId,
  eventType,
  severity = "info",
  message,
  metadata = {},
}) {
  // Sanitise: remove any key that looks like a credential
  const safeMetadata = sanitiseMetadata(metadata);

  const event = {
    id:        uuid(),
    runId:     runId   || null,
    actorType,
    actorId:   actorId || null,
    eventType,
    severity,
    message:   String(message).slice(0, 1000),
    metadata:  safeMetadata,
    createdAt: nowISO(),
  };

  // Fire-and-forget — never let audit failure block execution
  appendAuditEvent(event);

  // Mirror to console in development
  const prefix = `[Automation Audit][${severity.toUpperCase()}][${eventType}]`;
  if (severity === "error" || severity === "critical") {
    console.error(prefix, message, safeMetadata);
  } else {
    console.log(prefix, message);
  }

  return event; // return synchronously for tests / callers that need the id
}

// ── Convenience wrappers ──────────────────────────────────────────────────

export const logStateTransition = (runId, fromState, toState) =>
  log({
    runId,
    actorType: "system",
    eventType: AUDIT_EVENT.STATE_TRANSITION,
    severity:  "info",
    message:   `State: ${fromState} → ${toState}`,
    metadata:  { fromState, toState },
  });

export const logAgentStart = (runId, agentKind) =>
  log({
    runId,
    actorType: "agent",
    actorId:   agentKind,
    eventType: AUDIT_EVENT.AGENT_STARTED,
    severity:  "info",
    message:   `Agent started: ${agentKind}`,
    metadata:  { agentKind },
  });

export const logAgentComplete = (runId, agentKind, summary) =>
  log({
    runId,
    actorType: "agent",
    actorId:   agentKind,
    eventType: AUDIT_EVENT.AGENT_COMPLETED,
    severity:  "info",
    message:   `Agent completed: ${agentKind}`,
    metadata:  { agentKind, summary: String(summary || "").slice(0, 300) },
  });

export const logPolicyBlock = (runId, status, findings) =>
  log({
    runId,
    actorType: "agent",
    actorId:   "security_policy",
    eventType: AUDIT_EVENT.POLICY_BLOCKED,
    severity:  status === "blocked" ? "error" : "warn",
    message:   `Policy decision: ${status}`,
    metadata:  {
      status,
      findingCount: findings.length,
      // Only log severity/category — never log raw finding messages that might contain secrets
      findingSummary: findings.map(f => ({ severity: f.severity, category: f.category })),
    },
  });

export const logScreenBlock = (runId, reason) =>
  log({
    runId,
    actorType: "system",
    eventType: AUDIT_EVENT.SCREEN_BLOCKED,
    severity:  "warn",
    message:   `Prompt screen blocked: ${reason}`,
    metadata:  { reason },
  });

export const logRunFailed = (runId, error) =>
  log({
    runId,
    actorType: "system",
    eventType: AUDIT_EVENT.RUN_FAILED,
    severity:  "error",
    message:   `Run failed: ${String(error).slice(0, 400)}`,
    metadata:  { error: String(error).slice(0, 400) },
  });

// ── Sanitiser ─────────────────────────────────────────────────────────────

const SECRET_KEY_RE = /key|token|secret|password|auth|bearer|credential|api[-_]?key/i;

function sanitiseMetadata(obj, depth = 0) {
  if (depth > 4 || obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.slice(0, 20).map(v => sanitiseMetadata(v, depth + 1));

  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SECRET_KEY_RE.test(k)) {
      out[k] = "[REDACTED]";
    } else if (typeof v === "object" && v !== null) {
      out[k] = sanitiseMetadata(v, depth + 1);
    } else if (typeof v === "string") {
      out[k] = v.slice(0, 500);
    } else {
      out[k] = v;
    }
  }
  return out;
}
