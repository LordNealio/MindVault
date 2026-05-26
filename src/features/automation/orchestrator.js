/**
 * orchestrator.js — Automation run state machine.
 *
 * Slice 1 state path:
 *   queued → planning → policy_check_initial
 *     → awaiting_approval  (tier3 / approval_required — has approve/reject UI)
 *     → ready_for_review   (tier1/tier2 allowed, OR user approved)
 *     → failed             (any unhandled error)
 *     → cancelled          (user stops run — abort signal fires)
 *
 * Hardening changes vs initial implementation:
 * - AbortController: cancellation actually aborts in-flight fetch calls
 * - Step lifecycle: execution steps (screen, planner, policy) transition
 *   pending → running → completed/failed in real time
 * - plannerOutput: stored on the run object for Plan tab display
 * - approveRun / rejectRun: minimal approval gate for awaiting_approval state
 * - Signals passed through to all agent calls
 */

import {
  RUN_STATE, AGENT_KIND, AUDIT_EVENT, TERMINAL_STATES,
  createRun, createRequest, uuid, nowISO,
} from "./contracts.js";
import { saveRequest, saveRun, getRun, getAllRuns, saveStep, updateStep } from "./db.js";
import {
  log, logStateTransition, logAgentStart, logAgentComplete,
  logPolicyBlock, logScreenBlock, logRunFailed,
} from "./audit.js";
import { screenPrompt, evaluatePolicy, isExecutionAllowed, requiresApproval } from "./agents/policy.js";
import { runPlanner } from "./agents/planner.js";

// ── AbortController registry ──────────────────────────────────────────────
// Maps runId → AbortController for in-flight runs.
// Allows cancelRun to abort the active fetch mid-execution.
const _activeControllers = new Map();

// ── Public API ────────────────────────────────────────────────────────────

/**
 * startRun — create a request + run and drive the Slice 1 state machine.
 *
 * Slice 2 Phase 1: apiKey replaced by sessionToken.
 * When sessionToken is null, all agents run in demo mode (stub responses).
 * When sessionToken is set, agents call through the server-side proxy.
 *
 * @param {{ title, prompt, taskType, sessionToken, onRunUpdate }}
 * @returns {Promise<AutomationRun>}
 */
export async function startRun({ title, prompt, taskType, sessionToken, onRunUpdate }) {
  // ── 1. Create and persist request ──────────────────────────────────────
  const request = createRequest({ title, prompt, taskType });
  await saveRequest(request);
  log({ eventType: AUDIT_EVENT.REQUEST_CREATED, severity: "info",
        message: `Request created: "${request.title}"`,
        metadata: { requestId: request.id, taskType } });

  // ── 2. Create run + AbortController ────────────────────────────────────
  let run = createRun(request);
  await saveRun(run);
  onRunUpdate(() => run);

  const controller = new AbortController();
  _activeControllers.set(run.id, controller);
  const { signal } = controller;

  log({ runId: run.id, eventType: AUDIT_EVENT.RUN_QUEUED,
        severity: "info", message: `Run queued: ${run.id}` });

  // ── 3. Drive state machine ──────────────────────────────────────────────
  try {
    run = await transition(run, RUN_STATE.PLANNING, onRunUpdate, { timestamps: { ...run.timestamps, startedAt: nowISO() } });

    // ── Step 1/3: Haiku screen ─────────────────────────────────────────
    const screenStep = await createExecStep(run.id, 1, "sandbox", "Security screen (Haiku)");
    logAgentStart(run.id, "haiku_screen");
    await markStepRunning(screenStep.id);

    let screenResult;
    try {
      screenResult = await screenPrompt(sessionToken, run.id, request.prompt, signal);
    } catch (err) {
      if (err.name === "AbortError") throw err;
      throw new Error(`Prompt screen failed: ${err.message}`);
    }

    if (!screenResult.safe) {
      await markStepFailed(screenStep.id, screenResult.reason);
      logScreenBlock(run.id, screenResult.reason);
      throw new Error(`Request blocked by security screen: ${screenResult.reason}`);
    }
    await markStepCompleted(screenStep.id, `Screen passed — ${screenResult.reason}`);
    logAgentComplete(run.id, "haiku_screen", `safe=true`);

    // ── Step 2/3: Planner ──────────────────────────────────────────────
    const planStep = await createExecStep(run.id, 2, "planner", "Planning (Sonnet)");
    run = await setActiveAgent(run, AGENT_KIND.PLANNER, onRunUpdate);
    logAgentStart(run.id, AGENT_KIND.PLANNER);
    await markStepRunning(planStep.id);

    let plannerOutput;
    try {
      plannerOutput = await runPlanner(sessionToken, request, run, signal);
    } catch (err) {
      if (err.name === "AbortError") throw err;
      await markStepFailed(planStep.id, err.message);
      throw new Error(`Planner failed: ${err.message}`);
    }
    await markStepCompleted(planStep.id, plannerOutput.summary);
    logAgentComplete(run.id, AGENT_KIND.PLANNER, plannerOutput.summary);

    // Store full plannerOutput on the run for Plan tab display
    run = await patchRun(run, {
      summary:       plannerOutput.summary,
      activeAgent:   undefined,
      plannerOutput: {
        summary:             plannerOutput.summary,
        taskType:            plannerOutput.taskType,
        objectives:          plannerOutput.objectives    || [],
        assumptions:         plannerOutput.assumptions   || [],
        affectedAreas:       plannerOutput.affectedAreas || [],
        riskSignals:         plannerOutput.riskSignals   || [],
        validationsRequired: plannerOutput.validationsRequired || [],
        approvalNeeded:      plannerOutput.approvalNeeded,
        approvalReasons:     plannerOutput.approvalReasons || [],
        executionStepCount:  (plannerOutput.executionSteps || []).length,
      },
    }, onRunUpdate);

    // ── Step 3/3: Policy ───────────────────────────────────────────────
    run = await transition(run, RUN_STATE.POLICY_CHECK_INITIAL, onRunUpdate);
    const polStep = await createExecStep(run.id, 3, "security_policy", "Policy check (Sonnet)");
    run = await setActiveAgent(run, AGENT_KIND.SECURITY_POLICY, onRunUpdate);
    logAgentStart(run.id, AGENT_KIND.SECURITY_POLICY);
    await markStepRunning(polStep.id);

    let policyDecision;
    try {
      policyDecision = await evaluatePolicy(sessionToken, request, run, signal);
    } catch (err) {
      if (err.name === "AbortError") throw err;
      await markStepFailed(polStep.id, err.message);
      throw new Error(`Policy evaluation failed: ${err.message}`);
    }
    await markStepCompleted(polStep.id, `${policyDecision.status} — ${policyDecision.riskTier}`);
    logAgentComplete(run.id, AGENT_KIND.SECURITY_POLICY, policyDecision.status);

    run = await patchRun(run, {
      riskTier:    policyDecision.riskTier,
      activeAgent: undefined,
    }, onRunUpdate);

    // ── Deterministic policy gate (code, not model) ────────────────────
    if (requiresApproval(policyDecision)) {
      logPolicyBlock(run.id, "approval_required", policyDecision.findings || []);
      run = await transition(run, RUN_STATE.AWAITING_APPROVAL, onRunUpdate, {
        latestError: buildApprovalMessage(policyDecision),
      });
      _activeControllers.delete(run.id);
      return run; // terminal for now — approve/reject UI handles next step
    }

    if (!isExecutionAllowed(policyDecision)) {
      logPolicyBlock(run.id, policyDecision.status, policyDecision.findings || []);
      throw new Error(
        `Policy blocked: ${policyDecision.status}. ` +
        (policyDecision.blockedActions || []).join(", ")
      );
    }

    // ── Slice 1 terminal: ready_for_review ─────────────────────────────
    run = await transition(run, RUN_STATE.READY_FOR_REVIEW, onRunUpdate);
    log({ runId: run.id, eventType: AUDIT_EVENT.RUN_COMPLETED, severity: "info",
          message: "Run reached ready_for_review (Slice 1 complete)" });

    _activeControllers.delete(run.id);
    return run;

  } catch (err) {
    _activeControllers.delete(run.id);

    // Abort → cancelled, not failed
    if (err.name === "AbortError") {
      run = await transition(run, RUN_STATE.CANCELLED, onRunUpdate, { activeAgent: undefined });
      return run;
    }

    logRunFailed(run.id, err.message);
    run = await transition(run, RUN_STATE.FAILED, onRunUpdate, {
      latestError: String(err.message).slice(0, 400),
      activeAgent: undefined,
    });
    return run;
  }
}

/**
 * cancelRun — user-initiated cancel.
 * Aborts in-flight fetch calls via AbortController, then sets IDB state.
 */
export async function cancelRun(runId, onRunUpdate) {
  // Abort the active fetch chain — this causes the in-flight await to throw AbortError
  const controller = _activeControllers.get(runId);
  if (controller) {
    controller.abort();
    _activeControllers.delete(runId);
  }

  const run = await getRun(runId);
  if (!run) return;
  if (TERMINAL_STATES.has(run.state)) return run;

  log({ runId, actorType: "user", eventType: "run_cancelled",
        severity: "info", message: "Run cancelled by user" });
  return transition(run, RUN_STATE.CANCELLED, onRunUpdate, { activeAgent: undefined });
}

/**
 * approveRun — user approves a run in awaiting_approval state.
 * In Slice 1: moves to ready_for_review (no execution yet).
 */
export async function approveRun(runId, onRunUpdate) {
  const run = await getRun(runId);
  if (!run || run.state !== RUN_STATE.AWAITING_APPROVAL) return;

  log({ runId, actorType: "user", eventType: AUDIT_EVENT.APPROVAL_REQUESTED,
        severity: "info", message: "Run approved by user — moving to ready_for_review" });

  return transition(run, RUN_STATE.READY_FOR_REVIEW, onRunUpdate, {
    latestError: undefined, // clear the approval message
  });
}

/**
 * rejectRun — user rejects a run in awaiting_approval state.
 */
export async function rejectRun(runId, onRunUpdate) {
  const run = await getRun(runId);
  if (!run || run.state !== RUN_STATE.AWAITING_APPROVAL) return;

  log({ runId, actorType: "user", eventType: "approval_rejected",
        severity: "warn", message: "Run rejected by user" });

  return transition(run, RUN_STATE.CANCELLED, onRunUpdate, {
    latestError: "Rejected by user at approval gate.",
    activeAgent: undefined,
  });
}

/**
 * loadAllRuns — all persisted runs, newest first.
 */
export async function loadAllRuns() {
  const runs = await getAllRuns();
  return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ── Private helpers ───────────────────────────────────────────────────────

async function transition(run, nextState, onRunUpdate, patch = {}) {
  const prev = run.state;
  const updated = {
    ...run,
    ...patch,
    state:      nextState,
    updatedAt:  nowISO(),
    timestamps: {
      ...run.timestamps,
      ...timestampForState(nextState),
      ...(patch.timestamps || {}),
    },
  };
  // Remove nested timestamps override so we don't double-nest
  delete updated.timestamps.timestamps;

  await saveRun(updated);
  onRunUpdate(() => updated);
  logStateTransition(updated.id, prev, nextState);
  return updated;
}

async function patchRun(run, patch, onRunUpdate) {
  const updated = { ...run, ...patch, updatedAt: nowISO() };
  await saveRun(updated);
  onRunUpdate(() => updated);
  return updated;
}

async function setActiveAgent(run, agentKind, onRunUpdate) {
  return patchRun(run, { activeAgent: agentKind }, onRunUpdate);
}

function timestampForState(state) {
  const now = nowISO();
  switch (state) {
    case RUN_STATE.PLANNING:         return { startedAt: now };
    case RUN_STATE.READY_FOR_REVIEW:
    case RUN_STATE.COMPLETED:        return { completedAt: now };
    case RUN_STATE.FAILED:           return { failedAt: now };
    case RUN_STATE.CANCELLED:        return { cancelledAt: now };
    default:                         return {};
  }
}

function buildApprovalMessage(policyDecision) {
  const tier    = policyDecision.riskTier;
  const reasons = (policyDecision.requiredApprovals || []).join("; ");
  return `Risk tier ${tier} requires approval. ${reasons || "High-risk action detected."}`;
}

// ── Step lifecycle helpers ────────────────────────────────────────────────

/**
 * createExecStep — create an execution-phase step (sequences 1-9).
 * These represent agents Slice 1 actually runs, not planned future work.
 */
async function createExecStep(runId, sequence, kind, summary) {
  const step = {
    id: uuid(), runId, kind, sequence,
    state: "pending", summary,
    metadata: { execStep: true },
    createdAt: nowISO(),
  };
  await saveStep(step);
  return step;
}

async function markStepRunning(stepId) {
  await updateStep(stepId, { state: "running", startedAt: nowISO() }).catch(() => {});
}

async function markStepCompleted(stepId, summary) {
  await updateStep(stepId, { state: "completed", completedAt: nowISO(),
    ...(summary ? { summary: String(summary).slice(0, 300) } : {}) }).catch(() => {});
}

async function markStepFailed(stepId, reason) {
  await updateStep(stepId, { state: "failed", completedAt: nowISO(),
    summary: String(reason || "Failed").slice(0, 300) }).catch(() => {});
}

// ── Slice 2+ stubs ────────────────────────────────────────────────────────
//
// ⚠  SECURITY NOTE — SEE ALSO: apiClient.js header
//
// Slice 2 requires the following before these stubs become real functions:
//
//   1. SERVER-SIDE API PROXY
//      All Anthropic model calls must move to a server-side broker.
//      The client must never hold or transmit the Anthropic API key.
//      The server owns the key, enforces rate limits, and logs every call.
//
//   2. SERVER-SIDE SECRET STORAGE
//      GitHub tokens, deploy hook URLs, and any third-party credentials
//      must live in server environment variables only.
//      They must never appear in model context, browser memory, or client state.
//
//   3. SANDBOX ISOLATION
//      Code execution requires a server-side container with filesystem and
//      network isolation per the Zero-Trust addendum §7.
//      Browser JS cannot satisfy this requirement.
//
// Until (1), (2), and (3) are in place, these stubs must remain stubs.

export function executeSandbox(_runId) {
  throw new Error(
    "BLOCKER (Slice 2): Sandbox requires isolated server-side container. " +
    "Browser SPA cannot provide filesystem/network isolation."
  );
}

export function deployToStaging(_runId) {
  throw new Error(
    "BLOCKER (Slice 2): Staging deploy requires server-side GitHub token storage " +
    "and Vercel/Netlify API access. Requires server-side secret storage first."
  );
}

export function generateMarketingDrafts(_runId) {
  throw new Error(
    "BLOCKER (Slice 2): Marketing drafts not implemented in Slice 1. " +
    "Requires server-side model proxy before automation can draft external content."
  );
}
