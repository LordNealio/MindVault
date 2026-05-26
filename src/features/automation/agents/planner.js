/**
 * planner.js — Sonnet-based planning agent.
 *
 * Slice 2 Phase 1 changes:
 *   - apiKey → sessionToken in function signature
 *   - callAnthropic → callAgentProxy (server proxy, run.id passed for audit)
 *   - demo mode: triggered by !sessionToken (unchanged semantics)
 *
 * Sequence numbering for steps:
 *   Execution steps (screen=1, planner=2, policy=3) use sequences 1-9.
 *   Planned future steps use sequence * 100 (100, 200, 300...).
 */

import { callAgentProxy }                                           from "../apiClient.js";
import { MODELS, AGENT_KIND, validatePlannerOutput, uuid, nowISO } from "../contracts.js";
import { saveStep }                                                 from "../db.js";

const PLANNER_SYSTEM = `You are the Planning Agent for an automated development system called MindVault.

Your job is to analyze an automation request and produce a structured execution plan.
You do NOT execute code. You only plan.

Return ONLY valid JSON — no markdown, no preamble:
{
  "agent": "planner",
  "summary": string (max 200 chars — one clear sentence describing the work),
  "taskType": "feature" | "bugfix" | "refactor" | "review" | "deploy" | "marketing" | "mixed",
  "objectives": string[] (2-5 clear, measurable objectives),
  "assumptions": string[],
  "affectedAreas": string[],
  "specialistsNeeded": string[],
  "executionSteps": [{ "step": number, "name": string, "owner": string, "description": string }],
  "validationsRequired": ("lint"|"typecheck"|"tests"|"build")[],
  "riskSignals": string[],
  "approvalNeeded": boolean,
  "approvalReasons": string[]
}

Context about MindVault:
- React SPA (single JSX file) deployed to Vercel via Vite
- IndexedDB for local-first journal storage
- Anthropic API for AI features (routed through server proxy)
- Personal journaling app companion to the MindWrite 90-day physical journal

Be specific and honest about what you don't know. Keep objectives measurable.`;

/**
 * runPlanner — call the Planner agent via server proxy.
 *
 * @param {string|null}       sessionToken
 * @param {AutomationRequest} request
 * @param {AutomationRun}     run
 * @param {AbortSignal}       [signal]
 * @returns {PlannerOutput}
 */
export async function runPlanner(sessionToken, request, run, signal) {
  if (!sessionToken) {
    await new Promise(r => setTimeout(r, 1400));
    const plan = buildDemoPlan(request);
    await persistPlannedSteps(run.id, plan.executionSteps);
    return plan;
  }

  const context = [
    `Title: ${request.title}`,
    `Task type: ${request.taskType}`,
    `Requested outcome: ${request.requestedOutcome}`,
    "",
    `Full request:\n${request.prompt}`,
  ].join("\n").trim();

  let parsed;
  try {
    const raw = await callAgentProxy({
      sessionToken,
      runId:     run.id,
      model:     MODELS.PLAN,
      maxTokens: 1200,
      system:    PLANNER_SYSTEM,
      messages:  [{ role: "user", content: context }],
      signal,
    });
    parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new Error(`Planner proxy/parse error: ${err.message}`);
  }

  if (!validatePlannerOutput(parsed)) {
    throw new Error("Planner output failed strict schema validation");
  }

  await persistPlannedSteps(run.id, parsed.executionSteps || []);
  return { ...parsed, agent: AGENT_KIND.PLANNER };
}

// ── Helpers ───────────────────────────────────────────────────────────────

async function persistPlannedSteps(runId, executionSteps) {
  for (const s of executionSteps) {
    await saveStep({
      id:        uuid(),
      runId,
      kind:      s.owner || "planner",
      sequence:  s.step * 100,      // 100, 200, 300 — after execution steps 1-9
      state:     "pending",
      summary:   `${s.name}: ${s.description}`.slice(0, 300),
      metadata:  { plannedStep: s, planned: true },
      createdAt: nowISO(),
    });
  }
}

function buildDemoPlan(request) {
  const isMarketing = request.taskType === "marketing" ||
    request.prompt.toLowerCase().includes("market");
  return {
    agent:     AGENT_KIND.PLANNER,
    summary:   `Plan for: ${request.title}`.slice(0, 200),
    taskType:  request.taskType,
    objectives: [
      "Understand the scope of the requested change",
      "Identify affected files and components",
      "Produce a safe, reviewable implementation plan",
    ],
    assumptions: [
      "Codebase is a React SPA using Vite",
      "Existing design tokens (D) are in scope",
      "No external backend services required for this task",
    ],
    affectedAreas:     isMarketing ? ["SettingsScreen","backup/export flow"] : ["src/App.jsx","src/features/"],
    specialistsNeeded: ["context_builder","code_generator","reviewer"],
    executionSteps: [
      { step:1, name:"Context Build",   owner:"context_builder", description:"Identify all files relevant to this change" },
      { step:2, name:"Code Generation", owner:"code_generator",  description:"Generate the required code changes" },
      { step:3, name:"Review",          owner:"reviewer",        description:"Review diff for correctness, safety, and style" },
    ],
    validationsRequired: ["lint","typecheck"],
    riskSignals: [
      "Single-file SPA — changes to App.jsx have wide blast radius",
      "No test suite currently — review is the main safety gate",
    ],
    approvalNeeded:  false,
    approvalReasons: [],
    demo: true,
  };
}
