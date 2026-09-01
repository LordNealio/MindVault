import { describe, it, expect } from "vitest";
import {
  THRESHOLDS, urgencyPrompts, influencePrompts, capacityPrompts,
  accessPrompts, importancePrompt, confidencePrompt, decisionSupport,
} from "../balanceDecisionSupport.js";
import { emptySheet, newLiability, newAsset, newGoal } from "../balanceSheet.js";
import { answered, unanswered, preferNot } from "../balanceAnswers.js";

const drain = (over) => ({ ...newLiability(), ...over });
const sheetWith = (over) => ({ ...emptySheet(), ...over });

// L1
describe("urgency prompts", () => {
  it("stays silent when nothing is marked for today", () => {
    expect(urgencyPrompts(sheetWith({ liabilities: [drain({ urgency: answered(1, "drain.urgency") })] }))).toHaveLength(0);
  });

  it("surfaces items marked for today", () => {
    const [p] = urgencyPrompts(sheetWith({
      liabilities: [drain({ description: "mail", urgency: answered(3, "drain.urgency") })],
    }));
    expect(p.items).toContain("mail");
  });

  it("never labels urgency as a crisis", () => {
    const [p] = urgencyPrompts(sheetWith({ liabilities: [drain({ urgency: answered(3, "drain.urgency") })] }));
    expect(`${p.title} ${p.body}`.toLowerCase()).not.toMatch(/crisis|emergency|risk score|danger/);
  });

  it("ignores completed items", () => {
    expect(urgencyPrompts(sheetWith({
      liabilities: [drain({ urgency: answered(3, "drain.urgency"), status: "Done" })],
    }))).toHaveLength(0);
  });
});

// L2 / L3
describe("interference against influence", () => {
  it("offers support, reduction, negotiation, coping or exit when influence is low", () => {
    const [p] = influencePrompts(sheetWith({
      liabilities: [drain({ description: "shift pattern", interference: answered(4, "drain.interference"), influence: answered(0, "drain.influence") })],
    }));
    expect(p.id).toBe("high-interference-low-influence");
    expect(p.body.toLowerCase()).toMatch(/support|exposure|renegotiate|cope|exit/);
  });

  it("never tells a low-influence user to try harder", () => {
    const [p] = influencePrompts(sheetWith({
      liabilities: [drain({ interference: answered(4, "drain.interference"), influence: answered(1, "drain.influence") })],
    }));
    expect(p.body.toLowerCase()).not.toMatch(/try harder|push through|discipline|excuse/);
  });

  it("asks for the smallest action when influence is high", () => {
    const prompts = influencePrompts(sheetWith({
      liabilities: [drain({ interference: answered(3, "drain.interference"), influence: answered(3, "drain.influence") })],
    }));
    expect(prompts.some(p => p.id === "high-interference-high-influence")).toBe(true);
  });

  it("stays silent when interference is low", () => {
    expect(influencePrompts(sheetWith({
      liabilities: [drain({ interference: answered(1, "drain.interference"), influence: answered(0, "drain.influence") })],
    }))).toHaveLength(0);
  });

  it("stays silent when influence was never answered", () => {
    const prompts = influencePrompts(sheetWith({
      liabilities: [drain({ interference: answered(4, "drain.interference"), influence: unanswered("drain.influence") })],
    }));
    expect(prompts.some(p => p.id === "high-interference-high-influence")).toBe(false);
  });
});

// L4
describe("capacity prompts", () => {
  const low = (n) => Object.fromEntries(
    ["rest", "physical", "focus", "home"].slice(0, n).map(id => [id, { rating: answered(1, "capacity.item") }])
  );

  it(`stays silent below ${THRESHOLDS.CAPACITY_LOW_COUNT} low items`, () => {
    expect(capacityPrompts(sheetWith({ capacity: low(2) }))).toHaveLength(0);
  });

  it("offers restore-capacity-first at the threshold", () => {
    const [p] = capacityPrompts(sheetWith({ capacity: low(3) }));
    expect(p.id).toBe("restore-capacity-first");
    expect(p.body.toLowerCase()).toContain("restoring capacity");
  });

  it("does not blame the user for low capacity", () => {
    const [p] = capacityPrompts(sheetWith({ capacity: low(3) }));
    expect(p.body.toLowerCase()).toContain("not");
    expect(p.body.toLowerCase()).not.toMatch(/lazy|weak|excuse/);
  });

  it("counts a genuine 0 as low", () => {
    const caps = { rest: { rating: answered(0, "capacity.item") }, physical: { rating: answered(0, "capacity.item") }, focus: { rating: answered(0, "capacity.item") } };
    expect(capacityPrompts(sheetWith({ capacity: caps }))).toHaveLength(1);
  });

  it("does not count declined answers as low", () => {
    const caps = { rest: { rating: preferNot("capacity.item") }, physical: { rating: preferNot("capacity.item") }, focus: { rating: preferNot("capacity.item") } };
    expect(capacityPrompts(sheetWith({ capacity: caps }))).toHaveLength(0);
  });
});

// L5
describe("resource access prompts", () => {
  it("prompts when a named resource cannot be reached", () => {
    const [p] = accessPrompts(sheetWith({
      assets: [{ ...newAsset(), description: "my brother", access: answered(0, "resource.access") }],
    }));
    expect(p.id).toBe("improve-resource-access");
    expect(p.items).toContain("my brother");
  });

  it("stays silent when resources are reachable", () => {
    expect(accessPrompts(sheetWith({
      assets: [{ ...newAsset(), access: answered(4, "resource.access") }],
    }))).toHaveLength(0);
  });
});

// L6 / L7
describe("importance and confidence prompts", () => {
  it(`invites revision below importance ${THRESHOLDS.IMPORTANCE_MIN}`, () => {
    const p = importancePrompt({ ...newGoal("30"), importance: answered(4, "plan.importance") });
    expect(p.id).toBe("low-importance");
  });

  it("stays silent at or above the importance bar", () => {
    expect(importancePrompt({ ...newGoal("30"), importance: answered(7, "plan.importance") })).toBeNull();
  });

  it(`offers shrink / support / context below confidence ${THRESHOLDS.CONFIDENCE_MIN}`, () => {
    const p = confidencePrompt({ ...newGoal("30"), confidence: answered(3, "plan.confidence") });
    expect(p.id).toBe("low-confidence");
    expect(p.body.toLowerCase()).toMatch(/shrink|smaller/);
    expect(p.body.toLowerCase()).toMatch(/add a person|support/);
    expect(p.body.toLowerCase()).toMatch(/when and where/);
  });

  it("does not shame low confidence", () => {
    const p = confidencePrompt({ ...newGoal("30"), confidence: answered(2, "plan.confidence") });
    expect(`${p.title} ${p.body}`.toLowerCase()).not.toMatch(/fail|weak|lazy|should have|discipline/);
    expect(p.title.toLowerCase()).toContain("useful information");
  });

  it("stays silent when confidence was never rated", () => {
    expect(confidencePrompt({ ...newGoal("30") })).toBeNull();
  });
});

describe("decisionSupport aggregate", () => {
  it("returns nothing for an empty sheet", () => {
    expect(decisionSupport(emptySheet())).toHaveLength(0);
  });

  it("never emits a diagnosis, score, or clinical label", () => {
    const sheet = sheetWith({
      liabilities: [drain({ interference: answered(4, "drain.interference"), influence: answered(0, "drain.influence"), urgency: answered(3, "drain.urgency") })],
      capacity: { rest: { rating: answered(0, "capacity.item") }, physical: { rating: answered(1, "capacity.item") }, focus: { rating: answered(0, "capacity.item") } },
      assets: [{ ...newAsset(), access: answered(0, "resource.access") }],
    });
    const text = decisionSupport(sheet).map(p => `${p.title} ${p.body}`).join(" ").toLowerCase();
    expect(text).not.toMatch(/depress|anxiet|disorder|diagnos|risk score|severity|clinical/);
  });
});
