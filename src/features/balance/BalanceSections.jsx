import { useState } from "react";
import {
  C, ASSET_CATEGORIES, LIABILITY_CATEGORIES, CAPACITY_AREAS, WEEKLY_AREAS,
  DRAIN_RESPONSES, ACTION_VERBS, ACTION_STATUSES, STATUSES, PRIORITIES,
  FOCUS_DECISIONS, HORIZONS, MAX_GOALS_PER_HORIZON,
  newAsset, newLiability, newGoal, newWeekly,
  uid, equityStatement, sortedCommandCenter,
} from "../../lib/balanceSheet.js";
import { valueOf } from "../../lib/balanceAnswers.js";
import {
  urgencyPrompts, influencePrompts, capacityPrompts, accessPrompts,
  importancePrompt, confidencePrompt,
} from "../../lib/balanceDecisionSupport.js";
import {
  D, TextField, TextArea, SelectField, Scale, Disclosure, Button,
  Card, Callout, Repeater, SectionShell, Kicker,
} from "./BalanceUI.jsx";
import { CrisisHelpButton } from "../safety/CrisisHelp.jsx";

const catOptions = (cats) => cats.map(c => ({ value: c.id, label: c.label }));

/** Supportive prompt block. Never a verdict — always something the user may ignore. */
function SupportPrompt({ p, accent = C.navy }) {
  if (!p) return null;
  return (
    <div style={{
      background: `${accent}0F`, border: `1px solid ${accent}55`, borderRadius: 14,
      padding: 14, marginBottom: 14,
    }}>
      <Kicker color={accent} style={{ marginBottom: 6 }}>{p.title}</Kicker>
      <p style={{ fontSize: 12.5, lineHeight: 1.75, color: D.bk, margin: 0 }}>{p.body}</p>
      {p.items?.length > 0 && (
        <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
          {p.items.slice(0, 4).map((t, i) => (
            <li key={i} style={{ fontSize: 12, color: D.muted, lineHeight: 1.6 }}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── 1. Resources ──────────────────────────────────────────────
export function AssetsSection({ sheet, patch }) {
  return (
    <SectionShell
      title="Resources" accent={C.green} kicker="Section 01 · What is working"
      intro="The people, abilities, experiences, resources, values, and resilience already working for you. Having something and being able to reach it are different questions — this section asks both."
    >
      <Disclosure summary="Examples by category">
        {ASSET_CATEGORIES.map(c => (
          <p key={c.id} style={{ marginBottom: 6 }}><strong>{c.label}:</strong> {c.example}</p>
        ))}
      </Disclosure>

      {accessPrompts(sheet).map(p => <SupportPrompt key={p.id} p={p} accent={C.green} />)}

      <Repeater
        items={sheet.assets} accent={C.green} addLabel="Add a resource"
        emptyHint="Start with one. It does not have to be impressive — it has to be true."
        onChange={(assets) => patch({ assets })}
        blank={newAsset}
        render={(item, set) => (
          <>
            <SelectField label="Category" value={item.category} onChange={(v) => set({ category: v })} options={catOptions(ASSET_CATEGORIES)} />
            <TextArea label="What is it?" value={item.description} onChange={(v) => set({ description: v })}
              placeholder="e.g. My brother — he answers when I call" rows={2} />
            <Scale label="How solid is this in general?" questionId="resource.strength" accent={C.green}
              value={item.strength} onChange={(v) => set({ strength: v })} />
            <Scale label="How available was it to you?" questionId="resource.access" accent={C.green}
              value={item.access} onChange={(v) => set({ access: v })} />
            {(valueOf(item.access) ?? 99) <= 1 && (
              <TextField label="What would make this easier to use?"
                hint="One step — a message, a time in the calendar, an honest sentence."
                value={item.easierToUse} onChange={(v) => set({ easierToUse: v })} />
            )}
            <TextArea label="Note (optional)" value={item.note} onChange={(v) => set({ note: v })} rows={2} />
          </>
        )}
      />

      <div style={{ marginTop: 22 }}>
        <TextArea
          label="Which resource must you protect first?"
          hint="The one that, if it slipped, would cost you the most."
          value={sheet.protectFirst} onChange={(v) => patch({ protectFirst: v })} rows={2}
        />
      </div>
    </SectionShell>
  );
}

// ── 2. Drains & Pressures ─────────────────────────────────────
export function LiabilitiesSection({ sheet, patch }) {
  return (
    <SectionShell
      title="Drains and Pressures" accent={C.red} kicker="Section 02 · What is draining"
      intro="Not character flaws — conditions, obligations, habits, fears, or unresolved problems consuming your time, energy, attention, money, health, or peace of mind."
    >
      <Callout accent={C.red}>
        Three separate questions, on purpose: how much it costs you, how soon it needs action, and how
        much say you actually have. They are not the same thing, and combining them hides the cases
        where trying harder is the wrong answer.
      </Callout>

      <Disclosure summary="Examples by category">
        {LIABILITY_CATEGORIES.map(c => (
          <p key={c.id} style={{ marginBottom: 6 }}><strong>{c.label}:</strong> {c.example}</p>
        ))}
      </Disclosure>

      {urgencyPrompts(sheet).map(p => <SupportPrompt key={p.id} p={p} accent={C.amber} />)}
      {influencePrompts(sheet).map(p => <SupportPrompt key={p.id} p={p} accent={C.red} />)}

      <Repeater
        items={sheet.liabilities} accent={C.red} addLabel="Add a drain"
        emptyHint="Nothing here is a judgement. Listing it is how it stops growing in the dark."
        onChange={(liabilities) => patch({ liabilities })}
        blank={newLiability}
        render={(item, set) => (
          <>
            <SelectField label="Category" value={item.category} onChange={(v) => set({ category: v })} options={catOptions(LIABILITY_CATEGORIES)} />
            <TextArea label="What is it?" value={item.description} onChange={(v) => set({ description: v })}
              placeholder="e.g. Three months of unopened mail" rows={2} />
            <Scale label="How much did this interfere with your life?" questionId="drain.interference"
              accent={C.red} value={item.interference} onChange={(v) => set({ interference: v })} />
            <Scale label="How soon does this need action?" questionId="drain.urgency"
              accent={C.amber} value={item.urgency} onChange={(v) => set({ urgency: v })} />
            <Scale label="How much influence do you have over it right now?" questionId="drain.influence"
              accent={C.blue} value={item.influence} onChange={(v) => set({ influence: v })} />
            <SelectField
              label="How do you want to respond to this?"
              hint="Not everything can be fixed by effort. All of these are legitimate."
              value={item.response} onChange={(v) => set({ response: v })}
              options={DRAIN_RESPONSES.map(r => ({ value: r.id, label: `${r.label} — ${r.hint}` }))}
            />
            <TextField label="First next action" hint="One visible thing. Open, Call, Send, Schedule, Gather, Pay, Ask, Complete."
              value={item.firstAction} onChange={(v) => set({ firstAction: v })} />
            <TextField label="Deadline (optional)" type="date" value={item.deadline} onChange={(v) => set({ deadline: v })} />
            <TextField label="Person who could help (optional)" value={item.helper} onChange={(v) => set({ helper: v })} />
            <SelectField label="Status" value={item.status} onChange={(v) => set({ status: v })} options={STATUSES} />
          </>
        )}
      />

      <div style={{ marginTop: 22 }}>
        <TextArea
          label="Which of these becomes more dangerous if you keep delaying it?"
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
      title="Current Capacity" accent={C.blue} kicker="Section 03 · What you can reach"
      intro="Potential is not the same as what you can reliably reach today. This asks about ability over the past 7 days — not effort, not character, not worth."
    >
      <Callout accent={C.blue}>
        This is your own reading of what you could reach. It is not a score, a test result, or a
        mental-health assessment, and it does not diagnose anything.
      </Callout>

      {sheet.capacityLegacy && (
        <Callout accent={C.amber} title="Earlier answers kept">
          You answered an earlier version of this section that used different wording and a different
          scale. Those answers are preserved in your export rather than converted, because rewriting
          them would change what you actually said.
        </Callout>
      )}

      {capacityPrompts(sheet).map(p => <SupportPrompt key={p.id} p={p} accent={C.blue} />)}

      {CAPACITY_AREAS.map(area => {
        const d = sheet.capacity[area.id] || {};
        return (
          <Card key={area.id} accent={C.blue}>
            <Scale label={area.label} questionId="capacity.item" accent={C.blue}
              value={d.rating} onChange={(v) => set(area.id, "rating", v)} />
            {valueOf(d.rating) != null && (
              <>
                <TextField label="What is affecting this?" value={d.affecting} onChange={(v) => set(area.id, "affecting", v)} />
                <TextField label="What could restore even 10% of your usable capacity here?"
                  value={d.replenishes} onChange={(v) => set(area.id, "replenishes", v)} />
                <TextField label="What would have to be reduced?" value={d.reduce} onChange={(v) => set(area.id, "reduce", v)} />
              </>
            )}
          </Card>
        );
      })}
    </SectionShell>
  );
}

// ── 4. What Still Belongs to You ──────────────────────────────
export function EquitySection({ sheet, patch }) {
  const e = sheet.equity;
  const set = (field, v) => patch({ equity: { ...e, [field]: v } });
  const generated = equityStatement({ ...sheet, equity: { ...e, statementOverride: "" } });
  return (
    <SectionShell
      title="What Still Belongs to You" accent={C.navy} kicker="Section 04 · What remains"
      intro="What is durably yours after the drains and limits are honestly named. No score here, and no requirement to feel positive about any of it."
    >
      <TextArea label="What choices, commitments, relationships, or practices still represent who you want to be?" value={e.values} onChange={(v) => set("values", v)} />
      <TextArea label="Who values you beyond what you produce?" value={e.whoValuesMe} onChange={(v) => set("whoValuesMe", v)} />
      <TextArea label="What have you learned, survived, built, or protected?" value={e.provenStrengths} onChange={(v) => set("provenStrengths", v)} />
      <TextArea label="What could not be taken by a setback?" value={e.cannotBeTaken} onChange={(v) => set("cannotBeTaken", v)} />
      <TextArea label="What do you want to protect while making changes?" value={e.assetAgainstLiability} onChange={(v) => set("assetAgainstLiability", v)} />

      <Card accent={C.navy} style={{ marginTop: 20 }}>
        <Kicker color={C.navy} style={{ marginBottom: 10 }}>Your statement</Kicker>
        <TextField label="Even while I am dealing with…" value={e.dealingWith} onChange={(v) => set("dealingWith", v)} />
        <TextField label="…I still possess…" value={e.stillPossess} onChange={(v) => set("stillPossess", v)} />
        <TextField label="…and my next responsible move is…" value={e.nextMove} onChange={(v) => set("nextMove", v)} />
        <div style={{
          background: D.white, border: `1px solid ${D.border}`, borderRadius: 10,
          padding: 12, fontSize: 13, lineHeight: 1.7, marginTop: 4, marginBottom: 12,
        }}>
          {generated}
        </div>
        <TextArea label="Say it in your own words instead (optional)"
          value={e.statementOverride} onChange={(v) => set("statementOverride", v)} rows={3} />
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
        priority: valueOf(l.urgency) === 3 ? "High" : valueOf(l.urgency) === 2 ? "Medium" : "Low",
      })),
    ],
  });

  return (
    <SectionShell
      title="Personal Command Center" accent={C.amber} kicker="Section 05 · What needs a move"
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
        <div style={{ marginBottom: 14 }}>
          <Button variant="secondary" full onClick={importFromLiabilities}>
            Pull in {importable.length} item{importable.length === 1 ? "" : "s"} from your drains
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
            <TextField label="Next physical action" value={item.nextAction} onChange={(v) => set({ nextAction: v })} />
            <TextField label="Deadline (optional)" type="date" value={item.deadline} onChange={(v) => set({ deadline: v })} />
            <TextField label="Helper or owner (optional)" value={item.helper} onChange={(v) => set({ helper: v })} />
            <SelectField label="Priority" value={item.priority} onChange={(v) => set({ priority: v })} options={PRIORITIES} />
            <SelectField label="Status" value={item.status} onChange={(v) => set({ status: v })} options={STATUSES} />
          </>
        )}
      />

      {sorted.length > 1 && (
        <div style={{ marginTop: 22 }}>
          <Kicker color={D.faint} style={{ marginBottom: 8 }}>In order of what comes first</Kicker>
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
      title="Risks and Early Warning Signs" accent={C.red} kicker="Section 06 · What to watch"
      intro="A manageable problem can become serious if warning signs appear or action is delayed. Naming the signal in advance is how you catch it early."
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

      <Card accent={C.navy} style={{ marginTop: 22 }}>
        <TextArea
          label="My escalation plan"
          hint="What symptoms, behaviours, missed responsibilities, or safety concerns mean I should contact a trusted person, clinician, crisis service, or emergency support?"
          value={sheet.escalationPlan} onChange={(v) => patch({ escalationPlan: v })} rows={5}
        />
        <div style={{ marginTop: 6 }}>
          <CrisisHelpButton />
        </div>
      </Card>
    </SectionShell>
  );
}

// ── 7. Choose a Priority ──────────────────────────────────────
export function PrioritySection({ sheet, patch }) {
  const p = sheet.priority || {};
  const set = (k, v) => patch({ priority: { ...p, [k]: v } });
  const candidates = [
    ...(sheet.liabilities || []).filter(l => l.description).map(l => l.description),
    ...(sheet.assets || []).filter(a => a.description && (valueOf(a.access) ?? 9) <= 1).map(a => `Reaching: ${a.description}`),
  ].slice(0, 8);

  return (
    <SectionShell
      title="Choose One Priority" accent={C.navy} kicker="Section 07 · What comes first"
      intro="One. Not a ranked list of everything. Nothing here picks it for you — the app can show you what you wrote, but the choice is yours to make and yours to justify."
    >
      {capacityPrompts(sheet).map(p2 => <SupportPrompt key={p2.id} p={p2} accent={C.blue} />)}

      {candidates.length > 0 && (
        <Disclosure summary="Things you have already named">
          {candidates.map((c, i) => <p key={i} style={{ marginBottom: 4 }}>· {c}</p>)}
        </Disclosure>
      )}

      <TextArea label="What is your one priority right now?" value={p.area} onChange={(v) => set("area", v)} rows={2} />
      <TextArea label="Why does it matter now?" value={p.whyNow} onChange={(v) => set("whyNow", v)} rows={3} />
      <TextArea
        label="What could continuing unchanged for 30 days cost you?"
        hint="Be concrete. This is the honest reason to start, and it is worth being able to read back later."
        value={p.costOfNoChange} onChange={(v) => set("costOfNoChange", v)} rows={3}
      />
    </SectionShell>
  );
}

// ── 8. Action Plan ────────────────────────────────────────────
export function PlanSection({ sheet, patch }) {
  const goalsFor = (h) => sheet.goals.filter(g => g.horizon === h);
  const setGoals = (h, next) => patch({ goals: [...sheet.goals.filter(g => g.horizon !== h), ...next] });

  return (
    <SectionShell
      title="Build an Action Plan" accent={C.blue} kicker="Section 08 · Where you are going"
      intro="Three horizons, no more than three priorities each. The limit is the point — completion before expansion."
    >
      {sheet.priority?.area && (
        <Callout accent={C.navy} title="Your chosen priority">{sheet.priority.area}</Callout>
      )}

      {HORIZONS.map(h => {
        const items = goalsFor(h.id);
        return (
          <div key={h.id} style={{ marginBottom: 30 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, margin: "0 0 2px" }}>{h.label}</h3>
            <p style={{ fontSize: 12, color: D.muted, lineHeight: 1.6, marginBottom: 4 }}>{h.purpose}</p>
            <p style={{ fontSize: 11, color: items.length >= MAX_GOALS_PER_HORIZON ? C.amber : D.faint, marginBottom: 12, fontWeight: 700 }}>
              {items.length} of {MAX_GOALS_PER_HORIZON} priorities used
            </p>
            <Repeater
              items={items} accent={C.blue} addLabel="Add a priority" max={MAX_GOALS_PER_HORIZON}
              onChange={(next) => setGoals(h.id, next)}
              blank={() => newGoal(h.id)}
              render={(item, set) => (
                <>
                  <TextField label="Desired outcome" value={item.priority} onChange={(v) => set({ priority: v })} />
                  <TextArea label="Why it matters" value={item.why} onChange={(v) => set({ why: v })} rows={2} />
                  <Scale label="How important is this to you?" questionId="plan.importance" accent={C.blue}
                    value={item.importance} onChange={(v) => set({ importance: v })} />
                  <SupportPrompt p={importancePrompt(item)} accent={C.amber} />
                  <TextField label="Observable evidence of progress"
                    hint="What would someone else be able to see?" value={item.measureOfDone} onChange={(v) => set({ measureOfDone: v })} />
                  <TextField label="Likely obstacle" value={item.obstacle} onChange={(v) => set({ obstacle: v })}
                    placeholder="What is most likely to get in the way?" />
                  <TextField label="Smallest visible next action" value={item.firstAction} onChange={(v) => set({ firstAction: v })} />
                  <TextField label="When and where will it happen?" value={item.whenWhere} onChange={(v) => set({ whenWhere: v })}
                    placeholder="e.g. Tuesday 7am, at the kitchen table" />
                  <TextArea label="If–then plan"
                    hint="If [obstacle or cue], then I will [response]."
                    value={item.ifThen} onChange={(v) => set({ ifThen: v })} rows={2}
                    placeholder="If I get home and I'm exhausted, then I will do the five-minute version instead of skipping it." />
                  <TextField label="Support or accountability needed" value={item.support} onChange={(v) => set({ support: v })} />
                  <Scale label="How confident are you that you will do it?" questionId="plan.confidence" accent={C.blue}
                    value={item.confidence} onChange={(v) => set({ confidence: v })} />
                  <SupportPrompt p={confidencePrompt(item)} accent={C.green} />
                  <TextField label="Review date" type="date" value={item.targetDate} onChange={(v) => set({ targetDate: v })} />
                  <SelectField label="Status" value={item.status} onChange={(v) => set({ status: v })} options={STATUSES} />
                </>
              )}
            />
          </div>
        );
      })}
    </SectionShell>
  );
}

// ── 9. Weekly Close ───────────────────────────────────────────
export function WeeklySection({ sheet, patch }) {
  const [draft, setDraft] = useState(null);
  const history = [...sheet.weeklyCloses].sort((a, b) => (b.weekOf || "").localeCompare(a.weekOf || ""));

  const save = () => {
    patch({ weeklyCloses: [...sheet.weeklyCloses.filter(w => w.id !== draft.id), draft] });
    setDraft(null);
  };

  return (
    <SectionShell
      title="Weekly Close" accent={C.green} kicker="Section 09 · The repeating review"
      intro="A short, repeatable review. Run it once a week — the direction over time matters more than any single week."
    >
      {!draft && (
        <Button variant="primary" accent={C.green} full onClick={() => setDraft(newWeekly())}>
          Start a weekly close
        </Button>
      )}

      {draft && (
        <Card accent={C.green}>
          <TextField label="Week of" type="date" value={draft.weekOf} onChange={(v) => setDraft({ ...draft, weekOf: v })} />
          {WEEKLY_AREAS.map(a => (
            <Scale key={a.id} label={a.label} questionId="weekly.item" accent={C.green}
              value={draft.ratings[a.id]}
              onChange={(v) => setDraft({ ...draft, ratings: { ...draft.ratings, [a.id]: v } })} />
          ))}
          <SelectField label="Where did your action get to?" value={draft.actionStatus}
            onChange={(v) => setDraft({ ...draft, actionStatus: v })} options={ACTION_STATUSES} />
          <TextArea label="What strengthened this week?" value={draft.strengthened} onChange={(v) => setDraft({ ...draft, strengthened: v })} rows={2} />
          <TextArea label="What drained you this week?" value={draft.liabilityIncreased} onChange={(v) => setDraft({ ...draft, liabilityIncreased: v })} rows={2} />
          <TextArea label="What remains unresolved?" value={draft.unresolved} onChange={(v) => setDraft({ ...draft, unresolved: v })} rows={2} />
          <TextArea label="Where did you ask for help?" value={draft.askedForHelp} onChange={(v) => setDraft({ ...draft, askedForHelp: v })} rows={2} />
          <TextArea label="What is the one adjustment for next week?" value={draft.oneMove} onChange={(v) => setDraft({ ...draft, oneMove: v })} rows={2} />
          <div style={{ display: "flex", gap: 8 }}>
            <Button accent={C.green} onClick={save} full>Save this week</Button>
            <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
          </div>
        </Card>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <Kicker color={D.faint} style={{ marginBottom: 8 }}>History</Kicker>
          <p style={{ fontSize: 11, color: D.muted, marginBottom: 14, lineHeight: 1.7 }}>
            Each item is tracked on its own. There is no combined score — averaging different
            questions together would hide exactly the movement worth seeing.
          </p>
          {history.map(w => (
            <Card key={w.id} accent={C.green}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: 12 }}>Week of {w.weekOf}</strong>
                {w.actionStatus && <span style={{ fontSize: 11, color: D.muted }}>{w.actionStatus}</span>}
              </div>
              {w.oneMove && <p style={{ fontSize: 12, color: D.bk, marginTop: 8, lineHeight: 1.6 }}><strong>Next:</strong> {w.oneMove}</p>}
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <Button small variant="secondary" onClick={() => setDraft(w)}>Edit</Button>
                <Button small variant="ghost" onClick={() => patch({ weeklyCloses: sheet.weeklyCloses.filter(x => x.id !== w.id) })}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

// ── 10. Focus Triage ──────────────────────────────────────────
export function FocusSection({ sheet, patch }) {
  const counts = FOCUS_DECISIONS.reduce((acc, d) => ({ ...acc, [d]: sheet.focus.filter(f => f.decision === d).length }), {});
  return (
    <SectionShell
      title="Focus and Commitment Triage" accent={C.amber} kicker="Section 10 · What gets your attention"
      intro="Every project, obligation, and idea you are carrying — and an honest decision about each one."
    >
      <Callout accent={C.amber} title="The capacity rule">
        One foundation priority + one flagship commitment + one limited creative outlet.
        New ideas go to the parking lot until something ships or the review date arrives.
      </Callout>

      <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
        {FOCUS_DECISIONS.map(d => (
          <span key={d} style={{
            fontSize: 10, fontWeight: 700, padding: "6px 10px", borderRadius: 20,
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
