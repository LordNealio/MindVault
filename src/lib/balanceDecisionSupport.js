// Decision support — supportive prompts, never diagnoses or risk scores.
//
// Audit L8: every threshold lives here, once, so it can be unit-tested and
// cannot drift between UI components. Nothing in this file labels a person,
// infers crisis, or assigns clinical meaning. Each rule returns a prompt the
// user can act on or ignore.

import { valueOf, isAnswered } from "./balanceAnswers.js";

export const THRESHOLDS = {
  URGENCY_ACT_NOW: 3,          // "Today"
  INTERFERENCE_HIGH: 3,        // "Very" or "Extremely"
  INFLUENCE_LOW: 1,            // "None right now" or "A little"
  INFLUENCE_HIGH: 2,           // "Some" or "A great deal"
  CAPACITY_LOW: 1,             // "Not able" or "Able with great difficulty"
  CAPACITY_LOW_COUNT: 3,       // three or more low items
  ACCESS_LOW: 1,               // "Not available" or "Rarely available"
  IMPORTANCE_MIN: 7,
  CONFIDENCE_MIN: 7,
};

const prompt = (id, title, body, opts = {}) => ({ id, title, body, tone: "support", ...opts });

/** L1 — urgency at "Today". Surfaced prominently; explicitly NOT called a crisis. */
export function urgencyPrompts(sheet) {
  const due = (sheet.liabilities || []).filter(
    l => valueOf(l.urgency) === THRESHOLDS.URGENCY_ACT_NOW && l.status !== "Done"
  );
  if (!due.length) return [];
  return [prompt(
    "urgency-today",
    `${due.length} item${due.length === 1 ? "" : "s"} you marked for today`,
    "Pick one and decide its next step — not the whole problem, just the next visible move. If today is not realistic, changing the date is a decision too.",
    { items: due.map(d => d.description).filter(Boolean) }
  )];
}

/** L2 / L3 — interference against influence. */
export function influencePrompts(sheet) {
  const out = [];
  const high = (sheet.liabilities || []).filter(
    l => (valueOf(l.interference) ?? -1) >= THRESHOLDS.INTERFERENCE_HIGH && l.status !== "Done"
  );

  const lowInfluence = high.filter(l => (valueOf(l.influence) ?? 99) <= THRESHOLDS.INFLUENCE_LOW);
  if (lowInfluence.length) {
    out.push(prompt(
      "high-interference-low-influence",
      "Costing you a lot, and largely outside your control",
      "Trying harder is not the lever here. The realistic moves are usually: ask for support, reduce your exposure to it, renegotiate the terms, build a way to cope while it lasts, or plan an exit. Choosing one of those is not giving up.",
      { items: lowInfluence.map(l => l.description).filter(Boolean) }
    ));
  }

  const highInfluence = high.filter(l => (valueOf(l.influence) ?? -1) >= THRESHOLDS.INFLUENCE_HIGH);
  if (highInfluence.length) {
    out.push(prompt(
      "high-interference-high-influence",
      "Costing you a lot, and you do have influence",
      "This is where a small action pays back fastest. What is the smallest visible thing you could do about it this week?",
      { items: highInfluence.map(l => l.description).filter(Boolean) }
    ));
  }
  return out;
}

/** L4 — three or more capacity items at the bottom of the scale. */
export function capacityPrompts(sheet) {
  const low = Object.entries(sheet.capacity || {})
    .filter(([, d]) => isAnswered(d?.rating) && d.rating.value <= THRESHOLDS.CAPACITY_LOW)
    .map(([id]) => id);
  if (low.length < THRESHOLDS.CAPACITY_LOW_COUNT) return [];
  return [prompt(
    "restore-capacity-first",
    "Restore capacity before adding load",
    `You marked ${low.length} areas as hard or not possible right now. A demanding new goal on top of that usually fails and then feels like a personal failure, which it is not. Consider making your next 30-day priority about restoring capacity — sleep, food, rest, or one source of support — before taking on anything else.`,
    { count: low.length }
  )];
}

/** L5 — a named resource you cannot actually reach. */
export function accessPrompts(sheet) {
  const hard = (sheet.assets || []).filter(a => {
    const v = valueOf(a.access);
    return v != null && v <= THRESHOLDS.ACCESS_LOW;
  });
  if (!hard.length) return [];
  return [prompt(
    "improve-resource-access",
    "Support you have, but cannot reach",
    "Naming a resource does not make it usable. For one of these, what single step would make it easier to reach — a message, a time in the calendar, a lift, an honest sentence?",
    { items: hard.map(a => a.description).filter(Boolean) }
  )];
}

/** L6 — importance below the bar. */
export function importancePrompt(goal) {
  const v = valueOf(goal?.importance);
  if (v == null || v >= THRESHOLDS.IMPORTANCE_MIN) return null;
  return prompt(
    "low-importance",
    "This may not be the one",
    "Goals below about a 7 on importance rarely survive a hard week. That is information, not a failing. You could revise it into something that matters more, defer it, or pick a different priority."
  );
}

/** L7 — confidence below the bar. Explicitly non-shaming. */
export function confidencePrompt(goal) {
  const v = valueOf(goal?.confidence);
  if (v == null || v >= THRESHOLDS.CONFIDENCE_MIN) return null;
  return prompt(
    "low-confidence",
    "Useful information, not a problem",
    "Plans usually work better when they are smaller. Three things reliably help: shrink the step until you are confident you would do it on a bad day, add a person who knows about it, or change when and where it happens."
  );
}

/** Everything that applies to the whole sheet, in display order. */
export function decisionSupport(sheet) {
  return [
    ...urgencyPrompts(sheet),
    ...influencePrompts(sheet),
    ...capacityPrompts(sheet),
    ...accessPrompts(sheet),
  ];
}
