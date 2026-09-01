import { describe, it, expect } from "vitest";
import {
  emptySheet, migrate, deriveSummary, capacityScores, sortedCommandCenter,
  scrubText, buildAIPayload, weeklySeries, newAsset, newLiability, newGoal, newWeekly,
  SCHEMA_VERSION,
} from "../balanceSheet.js";
import {
  answered, unanswered, preferNot, valueOf, isAnswered, isDeclined, comparable,
} from "../balanceAnswers.js";

// ── Answer semantics (audit D4/D5) ────────────────────────────
describe("answer states are distinct", () => {
  it("treats 0 as a real answer, not a missing value", () => {
    const a = answered(0, "capacity.item");
    expect(isAnswered(a)).toBe(true);
    expect(valueOf(a)).toBe(0);
  });

  it("never coerces unanswered or declined to 0", () => {
    expect(valueOf(unanswered("capacity.item"))).toBeNull();
    expect(valueOf(preferNot("capacity.item"))).toBeNull();
  });

  it("distinguishes prefer-not-to-answer from unanswered", () => {
    expect(isDeclined(preferNot("capacity.item"))).toBe(true);
    expect(isDeclined(unanswered("capacity.item"))).toBe(false);
  });

  it("records the anchor set and question version on every answer", () => {
    const a = answered(3, "drain.interference");
    expect(a.anchors).toBe("interference-0to4-v1");
    expect(a.qv).toBe(1);
  });
});

// ── Trend integrity (audit D7) ────────────────────────────────
describe("comparability across instrument versions", () => {
  it("refuses to compare answers from different anchor sets", () => {
    const a = answered(3, "capacity.item");
    const b = { value: 3, state: "answered", anchors: "legacy-1to5-v1", qv: 1 };
    expect(comparable(a, b)).toBe(false);
  });

  it("compares answers sharing anchors and version", () => {
    expect(comparable(answered(2, "capacity.item"), answered(4, "capacity.item"))).toBe(true);
  });

  it("weeklySeries only returns the current instrument's points", () => {
    const sheet = {
      ...emptySheet(),
      weeklyCloses: [
        { id: "1", weekOf: "2026-01-01", ratings: { energy: { value: 4, state: "answered", anchors: "legacy-1to5-v1", qv: 1 } } },
        { id: "2", weekOf: "2026-01-08", ratings: { energy: answered(2, "weekly.item") } },
        { id: "3", weekOf: "2026-01-15", ratings: { energy: answered(3, "weekly.item") } },
      ],
    };
    const s = weeklySeries(sheet, "energy");
    expect(s.series.map(p => p.value)).toEqual([2, 3]);
    expect(s.split).toBe(true);
  });

  it("produces no composite score across different questions", () => {
    const summary = deriveSummary({ ...emptySheet(), weeklyCloses: [newWeekly()] });
    expect(summary).not.toHaveProperty("weeklyScore");
    expect(summary).not.toHaveProperty("overallScore");
    expect(summary).not.toHaveProperty("netWorth");
  });
});

// ── Migration (audit §7) ──────────────────────────────────────
describe("v1 → v2 migration", () => {
  const v1 = {
    id: "primary", version: 1, completionState: "in_progress",
    assets: [{ id: "a", description: "brother", strength: 5, access: 2, note: "" }],
    liabilities: [{ id: "l", description: "mail", urgency: 3, status: "Not started" }],
    capacity: { sleep: { rating: 2, affecting: "shift work" } },
    weeklyCloses: [{ id: "w", weekOf: "2026-01-01", ratings: { sleep: 4 } }],
    equity: { values: "keep my word" },
  };

  it("does NOT re-base old rating numbers", () => {
    const m = migrate(v1);
    expect(m.assets[0].access.value).toBe(2);       // not 1
    expect(m.liabilities[0].urgency.value).toBe(3); // not 2
  });

  it("tags migrated answers with a legacy anchor set", () => {
    const m = migrate(v1);
    expect(m.assets[0].access.anchors).toBe("legacy-1to5-v1");
    expect(m.liabilities[0].urgency.anchors).toBe("legacy-urgency-1to3-v1");
  });

  it("preserves v1 capacity verbatim instead of guessing a mapping", () => {
    const m = migrate(v1);
    expect(m.capacityLegacy).toEqual(v1.capacity);
    expect(m.capacity).toEqual({});
  });

  it("keeps free text and stamps the new schema version", () => {
    const m = migrate(v1);
    expect(m.equity.values).toBe("keep my word");
    expect(m.assets[0].description).toBe("brother");
    expect(m.version).toBe(SCHEMA_VERSION);
    expect(m.migratedFrom).toBe(1);
  });

  it("adds the new dimensions as unanswered rather than zero", () => {
    const m = migrate(v1);
    expect(valueOf(m.liabilities[0].interference)).toBeNull();
    expect(valueOf(m.liabilities[0].influence)).toBeNull();
  });

  it("is idempotent for an already-migrated sheet", () => {
    const once = migrate(v1);
    const twice = migrate(once);
    expect(twice.assets[0].access.value).toBe(2);
    expect(twice.capacityLegacy).toEqual(v1.capacity);
  });
});

// ── Derivations ───────────────────────────────────────────────
describe("capacityScores", () => {
  it("includes a genuine 0 and excludes unanswered and declined", () => {
    const sheet = {
      ...emptySheet(),
      capacity: {
        rest: { rating: answered(0, "capacity.item") },
        focus: { rating: unanswered("capacity.item") },
        home: { rating: preferNot("capacity.item") },
        recover: { rating: answered(3, "capacity.item") },
      },
    };
    const ids = capacityScores(sheet).map(c => c.id);
    expect(ids).toContain("rest");
    expect(ids).toContain("recover");
    expect(ids).not.toContain("focus");
    expect(ids).not.toContain("home");
  });
});

describe("summary labels are evidence-gated", () => {
  it("produces no labels for an empty sheet", () => {
    expect(deriveSummary(emptySheet()).labels).toEqual([]);
  });

  it("flags high pressure only at three or more urgent drains", () => {
    const drain = (n) => ({ ...newLiability(), id: `l${n}`, urgency: answered(3, "drain.urgency") });
    const two = deriveSummary({ ...emptySheet(), liabilities: [drain(1), drain(2)] });
    const three = deriveSummary({ ...emptySheet(), liabilities: [drain(1), drain(2), drain(3)] });
    expect(two.labels).not.toContain("High pressure requiring immediate prioritization");
    expect(three.labels).toContain("High pressure requiring immediate prioritization");
  });

  it("does not claim capacity constraint without enough rated items", () => {
    const sheet = {
      ...emptySheet(),
      assets: [newAsset(), newAsset(), newAsset()],
      capacity: { rest: { rating: answered(0, "capacity.item") } },
    };
    expect(deriveSummary(sheet).labels).not.toContain("Resource-rich but currently capacity-constrained");
  });
});

// ── Command centre ordering ───────────────────────────────────
describe("sortedCommandCenter", () => {
  const now = Date.parse("2026-08-30T12:00:00Z");
  const items = [
    { id: "a", issue: "Renew licence", deadline: "2026-12-01", priority: "Low", status: "Not started" },
    { id: "b", issue: "Unopened mail", deadline: "", priority: "High", status: "Not started" },
    { id: "c", issue: "Call clinic", deadline: "2026-09-02", priority: "High", status: "Not started" },
    { id: "d", issue: "Overdue form", deadline: "2026-08-20", priority: "Low", status: "Not started" },
    { id: "e", issue: "Finished", deadline: "2026-08-21", priority: "High", status: "Done" },
  ];

  it("puts overdue and imminent work first", () => {
    const order = sortedCommandCenter({ commandCenter: items }, now).map(i => i.id);
    expect(order.slice(0, 2)).toEqual(["d", "c"]);
  });

  it("ranks a high-priority undated item above a distant low-priority one", () => {
    const order = sortedCommandCenter({ commandCenter: items }, now).map(i => i.id);
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("a"));
  });

  it("always puts done items last", () => {
    const order = sortedCommandCenter({ commandCenter: items }, now).map(i => i.id);
    expect(order[order.length - 1]).toBe("e");
  });
});

// ── Privacy ───────────────────────────────────────────────────
describe("scrubText", () => {
  it("replaces emails, phones, and long numbers with placeholders", () => {
    const out = scrubText("mail me at sam.b@work.co.uk or 07700 900123, acct 4111111111111111");
    expect(out).not.toMatch(/sam\.b@work/);
    expect(out).toContain("[EMAIL]");
    expect(out).toMatch(/\[PHONE\]|\[NUMBER\]/);
    expect(out).not.toContain("4111111111111111");
  });

  it("masks a named clinician", () => {
    expect(scrubText("referred by Dr Okafor")).toContain("[CLINICIAN]");
  });

  it("is safe on empty input", () => {
    expect(scrubText("")).toBe("");
    expect(scrubText(undefined)).toBe("");
  });
});

describe("buildAIPayload", () => {
  const sheet = {
    ...emptySheet(),
    assets: [{ ...newAsset(), description: "brother, call him on 07700 900123", access: answered(4, "resource.access") }],
    liabilities: [{ ...newLiability(), description: "unopened mail", interference: answered(4, "drain.interference"), influence: answered(1, "drain.influence") }],
    escalationPlan: "SECRET ESCALATION PLAN",
    risks: [{ id: "r", risk: "SECRET RISK" }],
  };

  it("scrubs identifiers by default", () => {
    expect(buildAIPayload(sheet)).not.toContain("07700 900123");
  });

  it("includes the anchor labels so ratings are interpretable", () => {
    const p = buildAIPayload(sheet);
    expect(p).toMatch(/Reliably available/);
    expect(p).toMatch(/Extremely/);
  });

  it("does not include sections that were never declared to the user", () => {
    const p = buildAIPayload(sheet);
    expect(p).not.toContain("SECRET ESCALATION PLAN");
    expect(p).not.toContain("SECRET RISK");
  });

  it("omits unanswered ratings rather than sending zeros", () => {
    const bare = { ...emptySheet(), assets: [{ ...newAsset(), description: "a friend" }] };
    const p = buildAIPayload(bare);
    expect(p).toContain("a friend");
    expect(p).not.toMatch(/availability/i);
  });
});
