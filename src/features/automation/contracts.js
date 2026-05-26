/**
 * contracts.js — Single source of truth for all automation types.
 *
 * Shared by agents, orchestrator, UI, and IDB layer.
 * Keep this file pure — no side effects, no imports.
 */

// ── Model routing ──────────────────────────────────────────────────────────
// Per implementation brief: Haiku for screening, Sonnet for planning/policy,
// Opus for escalations only.
export const MODELS = {
  SCREEN:   "claude-haiku-4-5-20251001", // prompt-injection screen, classification
  PLAN:     "claude-sonnet-4-6",         // planner, policy, main reasoning
  ESCALATE: "claude-opus-4-6",           // deep refactor escalations only
};

// ── Run state machine ─────────────────────────────────────────────────────
export const RUN_STATE = {
  DRAFT:                      "draft",
  QUEUED:                     "queued",
  PLANNING:                   "planning",
  POLICY_CHECK_INITIAL:       "policy_check_initial",
  AWAITING_APPROVAL:          "awaiting_approval",
  READY_FOR_REVIEW:           "ready_for_review",
  // Slice 2+ states (defined for schema completeness, not used yet):
  EXECUTING:                  "executing",
  REVIEW:                     "review",
  VALIDATING:                 "validating",
  REPAIR_LOOP:                "repair_loop",
  POLICY_CHECK_FINAL:         "policy_check_final",
  DEPLOYING_STAGING:          "deploying_staging",
  AWAITING_PRODUCTION_APPROVAL:"awaiting_production_approval",
  DEPLOYING_PRODUCTION:       "deploying_production",
  GENERATING_MARKETING:       "generating_marketing",
  AWAITING_PUBLISH_APPROVAL:  "awaiting_publish_approval",
  COMPLETED:                  "completed",
  FAILED:                     "failed",
  ROLLED_BACK:                "rolled_back",
  CANCELLED:                  "cancelled",
};

// Terminal states — orchestrator stops after reaching any of these
export const TERMINAL_STATES = new Set([
  RUN_STATE.READY_FOR_REVIEW,
  RUN_STATE.AWAITING_APPROVAL,
  RUN_STATE.COMPLETED,
  RUN_STATE.FAILED,
  RUN_STATE.ROLLED_BACK,
  RUN_STATE.CANCELLED,
]);

export const RISK_TIER = {
  UNKNOWN: "unknown",
  TIER1:   "tier1",   // low risk — fully autonomous
  TIER2:   "tier2",   // elevated — conditional/policy-gated
  TIER3:   "tier3",   // high risk — human approval required
};

export const RISK_TIER_LABEL = {
  unknown: "—",
  tier1:   "Low risk",
  tier2:   "Elevated risk",
  tier3:   "High risk",
};

export const RISK_TIER_COLOR = {
  unknown: "#9B9589",
  tier1:   "#166534",
  tier2:   "#92400e",
  tier3:   "#C1121F",
};

export const RISK_TIER_BG = {
  unknown: "#f5f5f4",
  tier1:   "#dcfce7",
  tier2:   "#fef3c7",
  tier3:   "#fee2e2",
};

export const TASK_TYPE = {
  FEATURE:   "feature",
  BUGFIX:    "bugfix",
  REFACTOR:  "refactor",
  REVIEW:    "review",
  DEPLOY:    "deploy",
  MARKETING: "marketing",
  MIXED:     "mixed",
};

export const AGENT_KIND = {
  PLANNER:         "planner",
  CONTEXT_BUILDER: "context_builder",
  CODE_GENERATOR:  "code_generator",
  REVIEWER:        "reviewer",
  DEBUGGER:        "debugger",
  SECURITY_POLICY: "security_policy",
  DEPLOY:          "deploy",
  MARKETING:       "marketing",
};

export const AGENT_LABEL = {
  planner:         "Planner",
  context_builder: "Context Builder",
  code_generator:  "Code Generator",
  reviewer:        "Reviewer",
  debugger:        "Debugger",
  security_policy: "Policy",
  deploy:          "Deploy",
  marketing:       "Marketing",
};

// ── Human-readable state labels ───────────────────────────────────────────
export const STATE_LABEL = {
  draft:                       "Draft",
  queued:                      "Queued",
  planning:                    "Planning…",
  policy_check_initial:        "Policy check…",
  awaiting_approval:           "Awaiting approval",
  ready_for_review:            "Ready for review",
  executing:                   "Executing",
  review:                      "In review",
  validating:                  "Validating",
  repair_loop:                 "Repairing",
  policy_check_final:          "Final policy check",
  deploying_staging:           "Deploying to staging",
  awaiting_production_approval:"Awaiting production approval",
  deploying_production:        "Deploying to production",
  generating_marketing:        "Generating marketing drafts",
  awaiting_publish_approval:   "Awaiting publish approval",
  completed:                   "Completed",
  failed:                      "Failed",
  rolled_back:                 "Rolled back",
  cancelled:                   "Cancelled",
};

export const STATE_COLOR = {
  draft:                  "#9B9589",
  queued:                 "#1D3557",
  planning:               "#E8B84B",
  policy_check_initial:   "#E8B84B",
  awaiting_approval:      "#92400e",
  ready_for_review:       "#166534",
  executing:              "#E8B84B",
  review:                 "#1D3557",
  validating:             "#1D3557",
  repair_loop:            "#92400e",
  policy_check_final:     "#E8B84B",
  deploying_staging:      "#1D3557",
  awaiting_production_approval: "#92400e",
  deploying_production:   "#1D3557",
  generating_marketing:   "#1D3557",
  awaiting_publish_approval: "#92400e",
  completed:              "#166534",
  failed:                 "#C1121F",
  rolled_back:            "#C1121F",
  cancelled:              "#9B9589",
};

// ── Default factory functions ─────────────────────────────────────────────
export const uuid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const nowISO = () => new Date().toISOString();

export const defaultPolicy = () => ({
  allowProdDeploy:       false,
  allowExternalPublish:  false,
  allowSchemaChanges:    false,
  allowDependencyAdds:   false,
});

export const defaultCounters = () => ({
  retryCount:   0,
  maxRetries:   3,
  filesChanged: 0,
});

export const defaultRepo = () => ({
  provider:      "github",
  owner:         "",
  name:          "",
  defaultBranch: "main",
});

export const defaultTimestamps = () => ({});

/**
 * createRequest — builds a new AutomationRequest object.
 * Prompt text is treated as UNTRUSTED DATA until screened.
 */
export const createRequest = ({ title, prompt, taskType = TASK_TYPE.MIXED,
  requestedOutcome = "", sourceContext = {}, requestedActions = {} }) => ({
  id:              uuid(),
  projectId:       "mindvault",           // single-project for MVP
  createdByUserId: "owner",
  title:           String(title).slice(0, 200),
  prompt:          String(prompt).slice(0, 4000), // hard cap before any API call
  taskType,
  requestedOutcome: String(requestedOutcome).slice(0, 500),
  sourceContext: {
    route:           sourceContext.route   || window.location.pathname,
    currentPageKind: sourceContext.pageKind || "automation",
    provider:        "github",
    ...sourceContext,
  },
  requestedActions: {
    allowPreviewDeploy:     false,
    allowStagingDeploy:     false,
    requestProductionDeploy:false,
    requestMarketingDrafts: false,
    requestExternalPublish: false,
    ...requestedActions,
  },
  createdAt: nowISO(),
  updatedAt: nowISO(),
});

/**
 * createRun — builds a new AutomationRun from a request.
 */
export const createRun = (request) => ({
  id:                  uuid(),
  requestId:           request.id,
  projectId:           request.projectId,
  initiatedByUserId:   request.createdByUserId,
  state:               RUN_STATE.QUEUED,
  riskTier:            RISK_TIER.UNKNOWN,
  taskType:            request.taskType,
  activeAgent:         undefined,
  summary:             undefined,
  repo:                defaultRepo(),
  policy:              defaultPolicy(),
  counters:            defaultCounters(),
  timestamps:          { queuedAt: nowISO() },
  latestError:         undefined,
  createdAt:           nowISO(),
  updatedAt:           nowISO(),
});

/**
 * createStep — builds an AutomationStep.
 */
export const createStep = ({ runId, kind, sequence }) => ({
  id:          uuid(),
  runId,
  kind,
  sequence,
  state:       "pending",
  startedAt:   undefined,
  completedAt: undefined,
  summary:     undefined,
  metadata:    {},
  createdAt:   nowISO(),
});

// ── Audit event types ─────────────────────────────────────────────────────
export const AUDIT_EVENT = {
  REQUEST_CREATED:      "request_created",
  RUN_QUEUED:           "run_queued",
  RUN_STARTED:          "run_started",
  AGENT_STARTED:        "agent_started",
  AGENT_COMPLETED:      "agent_completed",
  POLICY_BLOCKED:       "policy_blocked",
  APPROVAL_REQUESTED:   "approval_requested",
  RUN_FAILED:           "run_failed",
  RUN_COMPLETED:        "run_completed",
  SCREEN_BLOCKED:       "screen_blocked",
  STATE_TRANSITION:     "state_transition",
};

// ── Policy output validation ──────────────────────────────────────────────
const VALID_RISK_TIERS    = new Set(["tier1","tier2","tier3"]);
const VALID_POLICY_STATUS = new Set(["allowed","allowed_with_conditions","blocked","approval_required"]);
const VALID_SEVERITY      = new Set(["low","medium","high","critical"]);
const VALID_CATEGORY      = new Set([
  "auth","billing","secrets","deploy","data","permissions",
  "external_publish","dependency","destructive_change","prompt_injection",
]);

/**
 * validatePolicyOutput — deterministic code-level check of SecurityPolicyOutput.
 * Validates structure AND enum values. Fail closed on any violation.
 * Never trust model output directly.
 */
export function validatePolicyOutput(raw) {
  if (!raw || typeof raw !== "object")       return false;
  if (!VALID_RISK_TIERS.has(raw.riskTier))   return false;
  if (!VALID_POLICY_STATUS.has(raw.status))  return false;
  if (!Array.isArray(raw.findings))          return false;
  if (!Array.isArray(raw.requiredApprovals)) return false;
  if (!Array.isArray(raw.blockedActions))    return false;
  if (!Array.isArray(raw.safeAlternatives))  return false;

  // Validate each finding's severity and category against known enums
  for (const f of raw.findings) {
    if (!f || typeof f !== "object")        return false;
    if (!VALID_SEVERITY.has(f.severity))    return false;
    if (!VALID_CATEGORY.has(f.category))    return false;
    if (typeof f.message !== "string")      return false;
  }

  // requiredApprovals, blockedActions, safeAlternatives must be string arrays
  for (const arr of [raw.requiredApprovals, raw.blockedActions, raw.safeAlternatives]) {
    if (!arr.every(v => typeof v === "string")) return false;
  }

  return true;
}

// ── Planner output validation ─────────────────────────────────────────────
const VALID_TASK_TYPES  = new Set(["feature","bugfix","refactor","review","deploy","marketing","mixed"]);
const VALID_AGENT_KINDS = new Set([
  "planner","context_builder","code_generator",
  "reviewer","debugger","security_policy","deploy","marketing",
]);
const VALID_VALIDATION_TYPES = new Set(["lint","typecheck","tests","build"]);

/**
 * validatePlannerOutput — deterministic check of PlannerOutput.
 * Validates structure, types, and enum values. Fail closed on any violation.
 */
export function validatePlannerOutput(raw) {
  if (!raw || typeof raw !== "object")         return false;
  if (typeof raw.summary !== "string")         return false;
  if (raw.summary.length === 0)                return false;
  if (!VALID_TASK_TYPES.has(raw.taskType))     return false;
  if (!Array.isArray(raw.objectives))          return false;
  if (!Array.isArray(raw.executionSteps))      return false;
  if (typeof raw.approvalNeeded !== "boolean") return false;
  if (!Array.isArray(raw.approvalReasons))     return false;

  // Each execution step must have step number, name, owner, description
  for (const s of raw.executionSteps) {
    if (!s || typeof s !== "object")          return false;
    if (typeof s.step !== "number")           return false;
    if (typeof s.name !== "string")           return false;
    if (typeof s.description !== "string")    return false;
    // owner must be a known agent kind string (warn but don't fail — model may use custom names)
    // We validate it's at least a non-empty string
    if (typeof s.owner !== "string" || !s.owner) return false;
  }

  // validationsRequired must only contain known types if present
  if (raw.validationsRequired !== undefined) {
    if (!Array.isArray(raw.validationsRequired)) return false;
    for (const v of raw.validationsRequired) {
      if (!VALID_VALIDATION_TYPES.has(v)) return false;
    }
  }

  return true;
}
