// Answer model, anchor sets, and the question registry.
//
// WHY THIS EXISTS (audit D1/D3/D4/D5/D7):
// v1 stored ratings as bare numbers on 1–5 scales, where 0/undefined meant
// "unanswered". That made three things impossible:
//   1. a genuine "0 = Not able / Not available / Not at all" answer,
//   2. telling "skipped", "prefer not to answer" and "never reached" apart,
//   3. knowing later what the anchors MEANT when a scale is revised.
// Every rating is now an Answer carrying its own anchor-set id and question
// version, so historical answers stay interpretable and trends can refuse to
// mix instruments.

export const ANSWER_STATES = {
  ANSWERED: "answered",
  UNANSWERED: "unanswered",       // never reached / left blank
  SKIPPED: "skipped",             // deliberately passed over
  NOT_APPLICABLE: "not_applicable",
  PREFER_NOT: "prefer_not_to_answer",
};

/**
 * @typedef {Object} Answer
 * @property {number|null} value
 * @property {string} state    one of ANSWER_STATES
 * @property {string} anchors  anchor-set id, e.g. "capacity-0to4-v1"
 * @property {number} qv       question version
 */

/** Anchor sets are versioned and never edited in place — add a new id instead. */
export const ANCHOR_SETS = {
  "access-0to4-v1": {
    min: 0, max: 4, timeframe: "past 7 days",
    labels: ["Not available", "Rarely available", "Sometimes available", "Usually available", "Reliably available"],
  },
  "interference-0to4-v1": {
    min: 0, max: 4, timeframe: "past 7 days",
    labels: ["Not at all", "A little", "Moderately", "Very", "Extremely"],
  },
  "urgency-0to3-v1": {
    min: 0, max: 3, timeframe: null,
    labels: ["No action now", "This month", "This week", "Today"],
  },
  "influence-0to3-v1": {
    min: 0, max: 3, timeframe: null,
    labels: ["None right now", "A little", "Some", "A great deal"],
  },
  "capacity-0to4-v1": {
    min: 0, max: 4, timeframe: "past 7 days",
    labels: [
      "Not able",
      "Able with great difficulty",
      "Able with some difficulty",
      "Mostly able",
      "Fully able without unusual extra effort",
    ],
  },
  "importance-0to10-v1": {
    min: 0, max: 10, timeframe: null,
    labels: ["Not important", "", "", "", "", "", "", "", "", "", "Extremely important"],
  },
  "confidence-0to10-v1": {
    min: 0, max: 10, timeframe: null,
    labels: ["Not at all confident", "", "", "", "", "", "", "", "", "", "Completely confident"],
  },
  // Product-specific, not from the specification: how solid a resource is in general.
  "strength-1to5-v1": {
    min: 1, max: 5, timeframe: null,
    labels: ["Fragile", "", "", "", "Very solid"],
  },
  // v1 legacy. Present so old answers stay interpretable. Never assigned to new answers.
  "legacy-1to5-v1": {
    min: 1, max: 5, timeframe: null, legacy: true,
    labels: ["1", "2", "3", "4", "5"],
  },
  "legacy-urgency-1to3-v1": {
    min: 1, max: 3, timeframe: null, legacy: true,
    labels: ["1", "2", "3"],
  },
};

/** Stable question ids. Ids never change; bump `version` when meaning changes. */
export const QUESTIONS = {
  "resource.strength": { version: 1, anchors: "strength-1to5-v1", prompt: "How solid is this in general?" },
  "resource.access": { version: 1, anchors: "access-0to4-v1", prompt: "In the past 7 days, how available was this to you?" },
  "drain.interference": { version: 1, anchors: "interference-0to4-v1", prompt: "In the past 7 days, how much did this interfere with your life?" },
  "drain.urgency": { version: 1, anchors: "urgency-0to3-v1", prompt: "How soon does this need action?" },
  "drain.influence": { version: 1, anchors: "influence-0to3-v1", prompt: "How much influence do you have over this right now?" },
  "capacity.item": { version: 1, anchors: "capacity-0to4-v1", prompt: "In the past 7 days, were you able to…" },
  "plan.importance": { version: 1, anchors: "importance-0to10-v1", prompt: "How important is this to you?" },
  "plan.confidence": { version: 1, anchors: "confidence-0to10-v1", prompt: "How confident are you that you will do it?" },
  "weekly.item": { version: 1, anchors: "capacity-0to4-v1", prompt: "In the past 7 days…" },
};

export function anchorsOf(questionId) {
  const q = QUESTIONS[questionId];
  return q ? ANCHOR_SETS[q.anchors] : null;
}

/** Build an answered Answer. `value` may legitimately be 0. */
export function answered(value, questionId) {
  const q = QUESTIONS[questionId];
  return {
    value: Number(value),
    state: ANSWER_STATES.ANSWERED,
    anchors: q?.anchors ?? null,
    qv: q?.version ?? 1,
  };
}

export function unanswered(questionId) {
  const q = QUESTIONS[questionId];
  return { value: null, state: ANSWER_STATES.UNANSWERED, anchors: q?.anchors ?? null, qv: q?.version ?? 1 };
}

export function preferNot(questionId) {
  const q = QUESTIONS[questionId];
  return { value: null, state: ANSWER_STATES.PREFER_NOT, anchors: q?.anchors ?? null, qv: q?.version ?? 1 };
}

export const isAnswered = (a) => !!a && a.state === ANSWER_STATES.ANSWERED && typeof a.value === "number";
export const isDeclined = (a) => !!a && a.state === ANSWER_STATES.PREFER_NOT;

/** Numeric value or null. Never coerces a declined/unanswered answer to 0. */
export const valueOf = (a) => (isAnswered(a) ? a.value : null);

/**
 * Two answers are comparable for trends only when they share an anchor set AND
 * a question version. This is what stops a revised scale from silently
 * continuing an old trend line.
 */
export function comparable(a, b) {
  return isAnswered(a) && isAnswered(b) && a.anchors === b.anchors && a.qv === b.qv;
}

/** Wraps a raw v1 number without re-basing it — see the migration note. */
export function fromLegacyNumber(n, legacyAnchorId = "legacy-1to5-v1") {
  const num = Number(n);
  if (!num) return { value: null, state: ANSWER_STATES.UNANSWERED, anchors: legacyAnchorId, qv: 1 };
  return { value: num, state: ANSWER_STATES.ANSWERED, anchors: legacyAnchorId, qv: 1 };
}
