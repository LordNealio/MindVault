import { useState } from "react";
import {
  C, ASSET_CATEGORIES, LIABILITY_CATEGORIES, CAPACITY_AREAS, WEEKLY_AREAS,
  ACTION_VERBS, STATUSES, PRIORITIES, FOCUS_DECISIONS, HORIZONS,
  MAX_GOALS_PER_HORIZON, uid, equityStatement, sortedCommandCenter,
} from "../../lib/balanceSheet.js";
import {
  D, TextField, TextArea, SelectField, Scale, Disclosure, Button,
  Card, Callout, Repeater, SectionShell,
} from "./BalanceUI.jsx";

const catOptions = (cats) => cats.map(c => ({ value: c.id, label: c.label }));

// ── 1. Assets ─────────────────────────────────────────────────
export function AssetsSection({ sheet, patch }) {
  return (
    <SectionShell
      title="Assets Inventory" accent={C.green}
      intro="Assets are the people, abilities, experiences, resources, values, and forms of resilience already working for you."
    >
      <Disclosure summary="Examples by category">
        {ASSET_CATEGORIES.map(c => (
          <p key={c.id} style={{ marginBottom: 6 }}><strong>{c.label}:</strong> {c.example}</p>
        ))}
      </Disclosure>

      <Repeater
        items={sheet.assets} accent={C.green} addLabel="Add an asset"
        emptyHint="Start with one. It does not have to be impressive — it has to be true."
        onChange={(assets) => patch({ assets })}
        blank={() => ({ id: uid(), category: "relationships", description: "", strength: 0, access: 0, note: "" })}
        render={(item, set) => (
          <>
            <SelectField label="Category" value={item.category} onChange={(v) => set({ category: v })} options={catOptions(ASSET_CATEGORIES)} />
            <TextArea label="What is it?" value={item.description} onChange={(v) => set({ description: v })}
              placeholder="e.g. My brother — he answers when I call" rows={2} />
            <Scale label="Strength" hint="How solid is this in general?" accent={C.green}
              value={item.strength} onChange={(v) => set({ strength: v })} lowLabel="Fragile" highLabel="Very solid" />
            <Scale label="Access right now" hint="How much of it can you actually reach today?" accent={C.green}
              value={item.access} onChange={(v) => set({ access: v })} lowLabel="Hard to reach" highLabel="Fully available" />
            <TextArea label="Note (optional)" value={item.note} onChange={(v) => set({ note: v })} rows={2} />
          </>
        )}
      />

      <div style={{ marginTop: 20 }}>
        <TextArea
          label="Which asset must you protect first?"
          hint="The one that, if it slipped, would cost you the most."
          value={sheet.protectFirst} onChange={(v) => patch({ protectFirst: v })} rows={2}
        />
      </div>
    </SectionShell>
  );
}

// ── 2. Liabilities ────────────────────────────────────────────
export function LiabilitiesSection({ sheet, patch }) {
  return (
    <SectionShell
      title="Liabilities Inventory" accent={C.red}
      intro="A liability is not a character flaw. It is a condition, obligation, habit, fear, or unresolved problem draining capacity or creating risk."
    >
      <Disclosure summary="Examples by category">
        {LIABILITY_CATEGORIES.map(c => (
          <p key={c.id} style={{ marginBottom: 6 }}><strong>{c.label}:</strong> {c.example}</p>
        ))}
      </Disclosure>

      <Repeater
        items={sheet.liabilities} accent={C.red} addLabel="Add a liability"
        emptyHint="Nothing here is a judgement. Listing it is how it stops growing in the dark."
        onChange={(liabilities) => patch({ liabilities })}
        blank={() => ({ id: uid(), category: "health", description: "", urgency: 0, firstAction: "", deadline: "", helper: "", status: "Not started" })}
        render={(item, set) => (
          <>
            <SelectField label="Category" value={item.category} onChange={(v) => set({ category: v })} options={catOptions(LIABILITY_CATEGORIES)} />
            <TextArea label="What is it?" value={item.description} onChange={(v) => set({ description: v })}
              placeholder="e.g. Three months of unopened mail" rows={2} />
            <Scale label="Urgency" max={3} accent={C.red} value={item.urgency} onChange={(v) => set({ urgency: v })}
              lowLabel="1 — can wait" highLabel="3 — needs attention now" />
            <TextField label="First next action" hint="One visible thing. Open, Call, Send, Schedule, Gather, Pay, Ask, Complete."
              value={item.firstAction} onChange={(v) => set({ firstAction: v })} placeholder="e.g. Open the mail and sort into three piles" />
            <TextField label="Deadline (optional)" type="date" value={item.deadline} onChange={(v) => set({ deadline: v })} />
            <TextField label="Person who could help (optional)" value={item.helper} onChange={(v) => set({ helper: v })} />
            <SelectField label="Status" value={item.status} onChange={(v) => set({ status: v })} options={STATUSES} />
          </>
        )}
      />

      <div style={{ marginTop: 20 }}>
        <TextArea
          label="Which liability becomes more dangerous if you continue delaying it?"
          value={sheet.mostDangerousDelay} onChange={(v) => patch({ mostDangerousDelay: v })} rows={2}
        />
      </div>
    </SectionShell>
  );
}

// ── 3. Capacity ───────────────────────────────────────────────
export function CapacitySection({ sheet, patch }) {
  const set = (areaId, field, value) => patch({
    capacity: { ...sheet.capacity, [areaId]: { ...(sheet.capacity[areaId] || {}), [field]: value } },
  });
  return (
    <SectionShell
      title="Capacity and Liquidity Check" accent={C.blue}
      intro="Potential is not the same as the time, energy, attention, or emotional capacity you can reliably access today."
    >
      <Callout accent={C.blue}>
        This is a self-rating of what you can reach right now. It is not a score, a test result,
        or a mental-health assessment, and it does not diagnose anything.
      </Callout>

      {CAPACITY_AREAS.map(area => {
        const d = sheet.capacity[area.id] || {};
        return (
          <Card key={area.id} accent={C.blue}>
            <Scale label={area.label} accent={C.blue} value={d.rating}
              onChange={(v) => set(area.id, "rating", v)} lowLabel="Very limited" highLabel="Fully available" />
            {d.rating ? (
              <>
                <TextField label="What is affecting this area?" value={d.affecting} onChange={(v) => set(area.id, "affecting", v)} />
                <TextField label="What replenishes me?" value={d.replenishes} onChange={(v) => set(area.id, "replenishes", v)} />
                <TextField label="What must be reduced?" value={d.reduce} onChange={(v) => set(area.id, "reduce", v)} />
              </>
            ) : null}
          </Card>
        );
      })}
    </SectionShell>
  );
}

// ── 4. Personal Equity ────────────────────────────────────────
export function EquitySection({ sheet, patch }) {
  const e = sheet.equity;
  const set = (field, v) => patch({ equity: { ...e, [field]: v } });
  const generated = equityStatement({ ...sheet, equity: { ...e, statementOverride: "" } });
  return (
    <SectionShell
      title="Personal Equity" accent={C.navy}
      intro="Personal equity is the durable value that remains after current liabilities and limitations are honestly acknowledged."
    >
      <TextArea label="What are my core values?" value={e.values} onChange={(v) => set("values", v)} />
      <TextArea label="Who values me beyond my performance?" value={e.whoValuesMe} onChange={(v) => set("whoValuesMe", v)} />
      <TextArea label="What strengths have I already proven through experience?" value={e.provenStrengths} onChange={(v) => set("provenStrengths", v)} />
      <TextArea label="What knowledge, relationships, character, perspective, or faith cannot be taken by a setback?" value={e.cannotBeTaken} onChange={(v) => set("cannotBeTaken", v)} />
      <TextArea label="Which existing asset could help reduce a current liability?" value={e.assetAgainstLiability} onChange={(v) => set("assetAgainstLiability", v)} />

      <Card accent={C.navy} style={{ marginTop: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Personal Equity Statement</div>
        <TextField label="Even while I am dealing with…" value={e.dealingWith} onChange={(v) => set("dealingWith", v)} />
        <TextField label="…I still possess…" value={e.stillPossess} onChange={(v) => set("stillPossess", v)} />
        <TextField label="…and my next responsible move is…" value={e.nextMove} onChange={(v) => set("nextMove", v)} />
        <div style={{
          background: D.white, border: `1px solid ${D.border}`, borderRadius: 8,
          padding: 12, fontSize: 13, lineHeight: 1.7, marginTop: 4, marginBottom: 12,
        }}>
          {generated}
        </div>
        <TextArea
          label="Edit the statement in your own words (optional)"
          hint="Anything you write here replaces the sentence above."
          value={e.statementOverride} onChange={(v) => set("statementOverride", v)} rows={3}
        />
      </Card>
    </SectionShell>
  );
}

// ── 5. Command Center ─────────────────────────────────────────
export function CommandSection({ sheet, patch }) {
  const sorted = sortedCommandCenter(sheet);
  const importable = (sheet.liabilities || []).filter(
    l => l.description && !sheet.commandCenter.some(c => c.sourceId === l.id)
  );

  const importFromLiabilities = () => patch({
    commandCenter: [
      ...sheet.commandCenter,
      ...importable.map(l => ({
        id: uid(), sourceId: l.id, issue: l.description, category: l.category,
        deadline: l.deadline || "", nextAction: l.firstAction || "", verb: "",
        helper: l.helper || "", status: l.status || "Not started",
        priority: l.urgency === 3 ? "High" : l.urgency === 2 ? "Medium" : "Low",
      })),
    ],
  });

  return (
    <SectionShell
      title="Personal Command Center" accent={C.amber}
      intro="One list of everything that needs a decision or a move, with the next physical action written down."
    >
      <Callout accent={C.amber} title="The rule">
        List first. Solve second. Complete one command-center item before beginning optional expansion work.
      </Callout>

      <Disclosure summary="What counts as a next physical action?">
        <p>Something visible and specific that someone could watch you do. Start it with one of:</p>
        <p style={{ marginTop: 6 }}><strong>{ACTION_VERBS.join(" · ")}</strong></p>
        <p style={{ marginTop: 6 }}>“Deal with the insurance” is not an action. “Call the claims number and ask what is outstanding” is.</p>
      </Disclosure>

      {importable.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Button variant="secondary" full onClick={importFromLiabilities}>
            Pull in {importable.length} item{importable.length === 1 ? "" : "s"} from your liabilities
          </Button>
        </div>
      )}

      <Repeater
        items={sheet.commandCenter} accent={C.amber} addLabel="Add an item"
        emptyHint="Everything you are carrying, in one place, so none of it lives only in your head."
        onChange={(commandCenter) => patch({ commandCenter })}
        blank={() => ({ id: uid(), issue: "", category: "", deadline: "", nextAction: "", verb: "", helper: "", status: "Not started", priority: "Medium" })}
        render={(item, set) => (
          <>
            <TextField label="Issue" value={item.issue} onChange={(v) => set({ issue: v })} />
            <TextField label="Category" value={item.category} onChange={(v) => set({ category: v })} placeholder="e.g. Health, Home, Money" />
            <SelectField label="Action verb" value={item.verb} onChange={(v) => set({ verb: v })} options={ACTION_VERBS} placeholder="Pick a verb…" />
            <TextField label="Next physical action" value={item.nextAction} onChange={(v) => set({ nextAction: v })}
              placeholder="e.g. Call the clinic and book the follow-up" />
            <TextField label="Deadline (optional)" type="date" value={item.deadline} onChange={(v) => set({ deadline: v })} />
            <TextField label="Helper or owner (optional)" value={item.helper} onChange={(v) => set({ helper: v })} />
            <SelectField label="Priority" value={item.priority} onChange={(v) => set({ priority: v })} options={PRIORITIES} />
            <SelectField label="Status" value={item.status} onChange={(v) => set({ status: v })} options={STATUSES} />
          </>
        )}
      />

      {sorted.length > 1 && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>In order of what comes first</h3>
          <ol style={{ paddingLeft: 18, margin: 0 }}>
            {sorted.map(i => (
              <li key={i.id} style={{ fontSize: 12, color: i.status === "Done" ? D.faint : D.bk, marginBottom: 6, lineHeight: 1.5 }}>
                <strong>{i.issue || "Untitled"}</strong>
                {i.deadline && <> · due {i.deadline}</>}
                {i.priority && <> · {i.priority} priority</>}
                {i.status === "Done" && <> · done</>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </SectionShell>
  );
}

// ── 6. Risks ──────────────────────────────────────────────────
export function RisksSection({ sheet, patch }) {
  return (
    <SectionShell
      title="Risks and Early Warning Signs" accent={C.red}
      intro="A contingent liability is a manageable problem that may become serious if warning signs appear or action is delayed."
    >
      <Repeater
        items={sheet.risks} accent={C.red} addLabel="Add a risk"
        emptyHint="Name the thing you can see coming, and the signal that tells you it has arrived."
        onChange={(risks) => patch({ risks })}
        blank={() => ({ id: uid(), risk: "", warningSign: "", prevention: "", helper: "", escalationPoint: "" })}
        render={(item, set) => (
          <>
            <TextArea label="Possible risk" value={item.risk} onChange={(v) => set({ risk: v })} rows={2} />
            <TextField label="Early warning sign" hint="What would you notice first?" value={item.warningSign} onChange={(v) => set({ warningSign: v })} />
            <TextField label="Prevention action" value={item.prevention} onChange={(v) => set({ prevention: v })} />
            <TextField label="Who can help?" value={item.helper} onChange={(v) => set({ helper: v })} />
            <TextField label="Escalation point" hint="The line where you stop handling it alone." value={item.escalationPoint} onChange={(v) => set({ escalationPoint: v })} />
          </>
        )}
      />

      <Card accent={C.navy} style={{ marginTop: 20 }}>
        <TextArea
          label="My escalation plan"
          hint="What symptoms, behaviors, missed responsibilities, or safety concerns mean I should contact a trusted person, clinician, crisis service, or emergency support?"
          value={sheet.escalationPlan} onChange={(v) => patch({ escalationPlan: v })} rows={5}
        />
      </Card>

      <SafetyNotice />
    </SectionShell>
  );
}

/**
 * Crisis pathway. This app has no existing crisis-resource system, so nothing
 * location-specific is asserted: the primary instruction is the user's own
 * local emergency number, and the one named line is explicitly labelled by
 * country. The user's trusted contacts come from their own escalation plan.
 */
export function SafetyNotice() {
  return (
    <div role="note" style={{
      border: `2px solid ${C.red}`, borderRadius: 12, padding: 14, marginTop: 20,
      background: "#FFF5F5",
    }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.red, marginBottom: 6 }}>
        If you are in immediate danger
      </div>
      <p style={{ fontSize: 12, lineHeight: 1.7, color: D.bk, margin: 0 }}>
        This tool is not a crisis service and cannot help in an emergency. If you are thinking about
        harming yourself or someone else, or you are not safe right now, contact your local emergency
        number immediately, or go to your nearest emergency department.
      </p>
      <p style={{ fontSize: 12, lineHeight: 1.7, color: D.bk, marginTop: 8, marginBottom: 0 }}>
        In the <strong>United States</strong>, you can call or text <strong>988</strong> (Suicide &amp; Crisis Lifeline),
        24 hours a day. Outside the US, use your country's emergency number or a local crisis line —
        this app does not know your location and will not guess at a service that may not exist where you are.
      </p>
      <p style={{ fontSize: 11, lineHeight: 1.7, color: D.muted, marginTop: 8, marginBottom: 0 }}>
        Don't suffer in silence. Telling one person is a real action, and it counts.
      </p>
    </div>
  );
}

// ── 7. 30 / 90 / 365 ──────────────────────────────────────────
export function PlanSection({ sheet, patch }) {
  const goalsFor = (h) => sheet.goals.filter(g => g.horizon === h);
  const setGoals = (h, next) => patch({ goals: [...sheet.goals.filter(g => g.horizon !== h), ...next] });

  return (
    <SectionShell
      title="The 30 · 90 · 365 Plan" accent={C.blue}
      intro="Three horizons, no more than three priorities each. The limit is the point — completion before expansion."
    >
      {HORIZONS.map(h => {
        const items = goalsFor(h.id);
        return (
          <div key={h.id} style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, margin: "0 0 2px" }}>{h.label}</h3>
            <p style={{ fontSize: 12, color: D.muted, lineHeight: 1.6, marginBottom: 4 }}>{h.purpose}</p>
            <p style={{ fontSize: 11, color: items.length >= MAX_GOALS_PER_HORIZON ? C.amber : D.faint, marginBottom: 10, fontWeight: 700 }}>
              {items.length} of {MAX_GOALS_PER_HORIZON} priorities used
            </p>
            <Repeater
              items={items} accent={C.blue} addLabel="Add a priority" max={MAX_GOALS_PER_HORIZON}
              onChange={(next) => setGoals(h.id, next)}
              blank={() => ({ id: uid(), horizon: h.id, priority: "", why: "", measureOfDone: "", firstAction: "", targetDate: "", support: "", status: "Not started", progress: 0 })}
              render={(item, set) => (
                <>
                  <TextField label="Priority" value={item.priority} onChange={(v) => set({ priority: v })} />
                  <TextArea label="Why this matters" value={item.why} onChange={(v) => set({ why: v })} rows={2} />
                  <TextField label="Measure of done" hint="How will you know it is finished?" value={item.measureOfDone} onChange={(v) => set({ measureOfDone: v })} />
                  <TextField label="First visible action" value={item.firstAction} onChange={(v) => set({ firstAction: v })} />
                  <TextField label="Target date" type="date" value={item.targetDate} onChange={(v) => set({ targetDate: v })} />
                  <TextField label="Support person" value={item.support} onChange={(v) => set({ support: v })} />
                  <SelectField label="Status" value={item.status} onChange={(v) => set({ status: v })} options={STATUSES} />
                  <Scale label="Progress" accent={C.blue} value={item.progress} onChange={(v) => set({ progress: v })}
                    lowLabel="Not begun" highLabel="Finished" />
                </>
              )}
            />
          </div>
        );
      })}
    </SectionShell>
  );
}

// ── 8. Weekly Close ───────────────────────────────────────────
export function WeeklySection({ sheet, patch }) {
  const blankWeek = () => ({
    id: uid(), weekOf: new Date().toISOString().slice(0, 10), ratings: {},
    strengthened: "", liabilityIncreased: "", unresolved: "", askedForHelp: "", oneMove: "",
  });
  const [draft, setDraft] = useState(null);
  const history = [...sheet.weeklyCloses].sort((a, b) => (b.weekOf || "").localeCompare(a.weekOf || ""));

  const save = () => {
    patch({ weeklyCloses: [...sheet.weeklyCloses.filter(w => w.id !== draft.id), draft] });
    setDraft(null);
  };

  return (
    <SectionShell
      title="Weekly Close" accent={C.green}
      intro="A short, repeatable review. Run it once a week — the trend matters more than any single week."
    >
      {!draft && (
        <Button variant="primary" accent={C.green} full onClick={() => setDraft(blankWeek())}>
          Start a weekly close
        </Button>
      )}

      {draft && (
        <Card accent={C.green}>
          <TextField label="Week of" type="date" value={draft.weekOf} onChange={(v) => setDraft({ ...draft, weekOf: v })} />
          {WEEKLY_AREAS.map(a => (
            <Scale key={a.id} label={a.label} accent={C.green} value={draft.ratings[a.id]}
              onChange={(v) => setDraft({ ...draft, ratings: { ...draft.ratings, [a.id]: v } })} />
          ))}
          <TextArea label="What strengthened this week?" value={draft.strengthened} onChange={(v) => setDraft({ ...draft, strengthened: v })} rows={2} />
          <TextArea label="What liability increased?" value={draft.liabilityIncreased} onChange={(v) => setDraft({ ...draft, liabilityIncreased: v })} rows={2} />
          <TextArea label="What remains unresolved?" value={draft.unresolved} onChange={(v) => setDraft({ ...draft, unresolved: v })} rows={2} />
          <TextArea label="Where did I ask for help?" value={draft.askedForHelp} onChange={(v) => setDraft({ ...draft, askedForHelp: v })} rows={2} />
          <TextArea label="What is the one move for next week?" value={draft.oneMove} onChange={(v) => setDraft({ ...draft, oneMove: v })} rows={2} />
          <div style={{ display: "flex", gap: 8 }}>
            <Button accent={C.green} onClick={save} full>Save this week</Button>
            <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
          </div>
        </Card>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>History</h3>
          <p style={{ fontSize: 11, color: D.muted, marginBottom: 12, lineHeight: 1.6 }}>
            Averages of what you rated. A trend, not a medical conclusion.
          </p>
          {history.map(w => {
            const vals = Object.values(w.ratings || {}).filter(Boolean);
            const mean = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "—";
            return (
              <Card key={w.id} accent={C.green}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: 12 }}>Week of {w.weekOf}</strong>
                  <span style={{ fontSize: 12, color: D.muted }}>average {mean} of 5 · {vals.length} rated</span>
                </div>
                {w.oneMove && <p style={{ fontSize: 12, color: D.bk, marginTop: 8, lineHeight: 1.6 }}><strong>Next move:</strong> {w.oneMove}</p>}
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <Button small variant="secondary" onClick={() => setDraft(w)}>Edit</Button>
                  <Button small variant="ghost" onClick={() => patch({ weeklyCloses: sheet.weeklyCloses.filter(x => x.id !== w.id) })}>Delete</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </SectionShell>
  );
}

// ── 9. Focus Triage ───────────────────────────────────────────
export function FocusSection({ sheet, patch }) {
  const counts = FOCUS_DECISIONS.reduce((acc, d) => ({ ...acc, [d]: sheet.focus.filter(f => f.decision === d).length }), {});
  return (
    <SectionShell
      title="Focus and Commitment Triage" accent={C.amber}
      intro="Every project, obligation, and idea you are carrying — and an honest decision about each one."
    >
      <Callout accent={C.amber} title="The capacity rule">
        One foundation priority + one flagship commitment + one limited creative outlet.
        New ideas go to the parking lot until something ships or the review date arrives.
      </Callout>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {FOCUS_DECISIONS.map(d => (
          <span key={d} style={{
            fontSize: 10, fontWeight: 700, padding: "5px 9px", borderRadius: 6,
            border: `1px solid ${D.border}`, background: D.white, color: D.bk,
          }}>
            {d} · {counts[d]}
          </span>
        ))}
      </div>

      <Repeater
        items={sheet.focus} accent={C.amber} addLabel="Add a commitment"
        emptyHint="List them all, including the ones you feel guilty about."
        onChange={(focus) => patch({ focus })}
        blank={() => ({ id: uid(), name: "", decision: "PARK", why: "", reviewDate: "" })}
        render={(item, set) => (
          <>
            <TextField label="Project or commitment" value={item.name} onChange={(v) => set({ name: v })} />
            <SelectField label="Decision" value={item.decision} onChange={(v) => set({ decision: v })} options={FOCUS_DECISIONS} />
            <TextArea label="Why this decision?" value={item.why} onChange={(v) => set({ why: v })} rows={2} />
            <TextField label="Next milestone or review date" type="date" value={item.reviewDate} onChange={(v) => set({ reviewDate: v })} />
          </>
        )}
      />
    </SectionShell>
  );
}
