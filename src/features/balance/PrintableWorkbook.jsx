import { useEffect } from "react";
import { equityStatement, deriveSummary, CAPACITY_AREAS, WEEKLY_AREAS } from "../../lib/balanceSheet.js";
import { valueOf, ANCHOR_SETS } from "../../lib/balanceAnswers.js";
import { useScrollLock } from "../../lib/useScrollLock.js";
import { D, HEAD, Button } from "./BalanceUI.jsx";

/** Renders an Answer as "3 — Mostly able", or a blank rule when unanswered. */
const rate = (answer, anchorId) => {
  const v = valueOf(answer);
  const set = ANCHOR_SETS[anchorId];
  if (v == null) return `___ / ${set?.max ?? 4}`;
  const label = set?.labels?.[v];
  return label ? `${v} — ${label}` : String(v);
};

// The printable workbook renders as a full-screen overlay INSIDE the app.
//
// It used to open via window.open(). MindVault's manifest sets
// "display": "standalone", so a popped window has no browser chrome — no back
// button, no tabs — which left the reader stuck and forced them to kill the
// app. Anything full-screen in this app therefore needs its own way out.

const esc = (t) => String(t ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const line = (label, val) =>
  `<p><span class="k">${esc(label)}</span> ${val ? esc(val) : '<span class="blank">&nbsp;</span>'}</p>`;
const blanks = (n, fn) => Array.from({ length: n }).map(fn).join("");

export function buildWorkbookHTML(sheet, { filled }) {
  const s = sheet;
  const summary = filled ? deriveSummary(s) : null;

  return `
<h1>The Personal Balance Sheet</h1>
<p class="sub">A life inventory and action toolkit${s.ownerLabel ? ` — ${esc(s.ownerLabel)}` : ""}</p>
<p class="lede">Struggling does not erase your value. But identifying your value is not enough if you continue avoiding serious liabilities.</p>

<h2>1 · Resources</h2>
<p class="note">The people, abilities, experiences, resources, values, and resilience already working for you. Availability is rated for the past 7 days: 0 Not available · 1 Rarely · 2 Sometimes · 3 Usually · 4 Reliably.</p>
${s.assets.length
    ? s.assets.map(a => `<div class="item">${line("What:", a.description)}<small>Availability: ${esc(rate(a.access, "access-0to4-v1"))}</small>${a.easierToUse ? `<p><small>Would help: ${esc(a.easierToUse)}</small></p>` : ""}${a.note ? `<p><small>${esc(a.note)}</small></p>` : ""}</div>`).join("")
    : blanks(5, () => `<div class="item">${line("What:", "")}<small>Availability past 7 days: ___ / 4 &nbsp; What would make it easier to use: <span class="blank">&nbsp;</span></small></div>`)}
${line("Resource I must protect first:", s.protectFirst)}

<h2>2 · Drains and Pressures</h2>
<p class="note">Three separate questions. Interference: 0 Not at all → 4 Extremely. Urgency: 0 No action now → 3 Today. Influence: 0 None right now → 3 A great deal.</p>
${s.liabilities.length
    ? s.liabilities.map(l => `<div class="item">${line("What:", l.description)}${line("First next action:", l.firstAction)}<small>Interference ${esc(rate(l.interference, "interference-0to4-v1"))} · Urgency ${esc(rate(l.urgency, "urgency-0to3-v1"))} · Influence ${esc(rate(l.influence, "influence-0to3-v1"))}${l.response ? ` · Response: ${esc(l.response)}` : ""}</small></div>`).join("")
    : blanks(5, () => `<div class="item">${line("What:", "")}${line("First next action:", "")}<small>Interference ___/4 · Urgency ___/3 · Influence ___/3<br/>Response: act / ask / reduce / negotiate / cope / monitor / exit</small></div>`)}
${line("More dangerous if delayed:", s.mostDangerousDelay)}

<h2>3 · Current Capacity</h2>
<p class="note">Past 7 days, ability not worth: 0 Not able · 1 With great difficulty · 2 With some difficulty · 3 Mostly able · 4 Fully able.</p>
${CAPACITY_AREAS.map(a => {
    const d = s.capacity[a.id] || {};
    return `<p><span class="k">${esc(a.label)}:</span> ${esc(rate(d.rating, "capacity-0to4-v1"))}${d.affecting ? ` — affected by ${esc(d.affecting)}` : ""}${d.replenishes ? ` · would restore 10%: ${esc(d.replenishes)}` : ""}</p>`;
  }).join("")}

<h2>4 · Personal Equity</h2>
${line("Core values:", s.equity.values)}
${line("Who values me beyond performance:", s.equity.whoValuesMe)}
${line("Proven strengths:", s.equity.provenStrengths)}
${line("Cannot be taken by a setback:", s.equity.cannotBeTaken)}
${line("Asset that could reduce a liability:", s.equity.assetAgainstLiability)}
<p class="quote">${esc(equityStatement(s))}</p>

<h2>5 · Command Center</h2>
${s.commandCenter.length
    ? s.commandCenter.map(i => `<div class="item">${line("Issue:", i.issue)}${line("Next physical action:", i.nextAction)}<small>${esc(i.priority || "—")} priority · due ${esc(i.deadline || "—")} · ${esc(i.status || "")}</small></div>`).join("")
    : blanks(6, () => `<div class="item">${line("Issue:", "")}${line("Next physical action:", "")}<small>Priority ______ · Due ______ · Status ______</small></div>`)}
<p class="rule"><strong>Rule:</strong> List first. Solve second. Complete one command-center item before beginning optional expansion work.</p>
<p class="note">A next physical action starts with one of: Open · Call · Send · Schedule · Gather · Pay · Ask · Complete.</p>

<h2>6 · Risks and Early Warning Signs</h2>
${s.risks.length
    ? s.risks.map(r => `<div class="item">${line("Risk:", r.risk)}${line("Early warning sign:", r.warningSign)}${line("Prevention:", r.prevention)}${line("Who can help:", r.helper)}${line("Escalation point:", r.escalationPoint)}</div>`).join("")
    : blanks(4, () => `<div class="item">${line("Risk:", "")}${line("Early warning sign:", "")}${line("Prevention:", "")}${line("Escalation point:", "")}</div>`)}
${line("Escalation plan:", s.escalationPlan)}
<p class="safety"><strong>If you are in immediate danger,</strong> contact your local emergency number or go to the nearest emergency department. In the United States you can call or text 988 (Suicide &amp; Crisis Lifeline). This workbook is not a crisis service.</p>

<h2>7 · Choose One Priority</h2>
${line("My one priority right now:", s.priority?.area)}
${line("Why it matters now:", s.priority?.whyNow)}
${line("What 30 more days unchanged could cost:", s.priority?.costOfNoChange)}

<h2>8 · Build an Action Plan</h2>
${[["30", "Stabilize urgent problems and restore basic routines."],
   ["90", "Build consistency, reduce open loops, complete one meaningful priority."],
   ["365", "Create sustainable health, family, work, and purpose systems."]].map(([h, purpose]) => {
    const gs = s.goals.filter(g => g.horizon === h);
    return `<p class="k">Next ${h} days</p><p class="note">${purpose}</p>` + (gs.length
      ? gs.map(g => `<div class="item">${line("Desired outcome:", g.priority)}${line("Why it matters:", g.why)}<small>Importance ${esc(rate(g.importance, "importance-0to10-v1"))}</small>${line("Evidence of progress:", g.measureOfDone)}${line("Likely obstacle:", g.obstacle)}${line("Smallest next action:", g.firstAction)}${line("When and where:", g.whenWhere)}${line("If–then:", g.ifThen)}${line("Support needed:", g.support)}<small>Confidence ${esc(rate(g.confidence, "confidence-0to10-v1"))} · Review ${esc(g.targetDate || "—")}</small></div>`).join("")
      : blanks(3, () => `<div class="item">${line("Desired outcome:", "")}<small>Importance ___ / 10</small>${line("Evidence of progress:", "")}${line("Likely obstacle:", "")}${line("Smallest next action:", "")}${line("When and where:", "")}${line("If [obstacle], then I will:", "")}${line("Support needed:", "")}<small>Confidence ___ / 10 · Review date ________</small></div>`));
  }).join("")}
<p class="note">Maximum three priorities per horizon. If confidence is below 7, shrink the step, add support, or change when and where it happens.</p>

<h2>9 · Weekly Close</h2>
<p class="note">Rate each 0–4 for the past 7 days. Each item is tracked on its own — there is no combined score, because averaging different questions together hides the movement worth seeing.</p>
${s.weeklyCloses.length
    ? s.weeklyCloses.map(w => `<div class="item"><p class="k">Week of ${esc(w.weekOf)}</p>${WEEKLY_AREAS.map(a => `<small>${esc(a.label)}: ${esc(rate(w.ratings?.[a.id], "capacity-0to4-v1"))}</small><br/>`).join("")}${line("Action status:", w.actionStatus)}${line("Strengthened:", w.strengthened)}${line("Drained:", w.liabilityIncreased)}${line("One adjustment next week:", w.oneMove)}</div>`).join("")
    : blanks(2, () => `<div class="item">${line("Week of:", "")}${WEEKLY_AREAS.map(a => `<small>${esc(a.label)}: ___ / 4</small><br/>`).join("")}${line("Action status:", "")}${line("What strengthened this week?", "")}${line("What drained you?", "")}${line("What remains unresolved?", "")}${line("Where did you ask for help?", "")}${line("One adjustment for next week:", "")}</div>`)}

<h2>10 · Focus Triage</h2>
${s.focus.length
    ? s.focus.map(f => `<p><span class="k">${esc(f.decision)}</span> — ${esc(f.name)}${f.reviewDate ? ` <small>(review ${esc(f.reviewDate)})</small>` : ""}</p>`).join("")
    : blanks(5, () => `<p><span class="blank">&nbsp;</span> &nbsp; ACTIVE / MAINTAIN / PARK / ARCHIVE</p>`)}
<p class="rule">One foundation priority + one flagship commitment + one limited creative outlet. New ideas go to the parking lot until something ships or the review date arrives.</p>

${summary ? `<h2>Summary</h2>
<p><span class="k">Resources you can reach:</span> ${summary.accessible.length} &nbsp; <span class="k">Marked for today:</span> ${summary.urgentCount} &nbsp; <span class="k">Average capacity:</span> ${summary.capacityMean ?? "—"}/${summary.capacityMax}</p>
${summary.labels.map(l => `<p>· ${esc(l)}</p>`).join("")}` : ""}

<p class="foot">Not a diagnosis, clinical label, legal conclusion, or financial recommendation.<br/>
Generated by MindVault on ${new Date().toLocaleDateString()}.</p>`;
}

export function PrintableWorkbook({ sheet, filled, onClose }) {
  useScrollLock();
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="pbs-overlay"
      role="dialog" aria-modal="true" aria-label="Printable workbook"
      style={{
        position: "fixed", inset: 0, zIndex: 500, background: "#FFFFFF",
        display: "flex", flexDirection: "column",
      }}
    >
      <style>{`
        .pbs-doc { font-family: Georgia, 'Times New Roman', serif; color: #111; line-height: 1.7; }
        .pbs-doc h1 { font-size: 24px; margin: 0 0 2px; }
        .pbs-doc h2 { font-size: 15px; margin: 26px 0 4px; border-bottom: 2px solid #1D3557; padding-bottom: 4px; }
        .pbs-doc .sub { color: #555; margin: 0 0 14px; }
        .pbs-doc .lede { font-style: italic; margin-bottom: 18px; }
        .pbs-doc .note { color: #666; font-size: 13px; margin: 2px 0 10px; }
        .pbs-doc .k { font-weight: bold; }
        .pbs-doc .blank { display: inline-block; border-bottom: 1px solid #999; min-width: 220px; }
        .pbs-doc .item { border-left: 3px solid #1D3557; padding-left: 11px; margin-bottom: 12px; }
        .pbs-doc .quote { background: #f4f1ea; padding: 12px; border-radius: 6px; }
        .pbs-doc .rule { background: #fdf6e3; padding: 10px; border-radius: 6px; font-size: 13px; }
        .pbs-doc .safety { border: 2px solid #C1121F; padding: 10px; border-radius: 6px; font-size: 13px; }
        .pbs-doc .foot { color: #666; font-size: 12px; margin-top: 30px; }
        .pbs-doc p { margin: 6px 0; }
        @media print {
          body * { visibility: hidden !important; }
          .pbs-overlay, .pbs-overlay * { visibility: visible !important; }
          .pbs-overlay { position: absolute !important; inset: auto !important;
            left: 0 !important; top: 0 !important; width: 100% !important; overflow: visible !important; }
          .pbs-bar { display: none !important; }
          .pbs-scroll { overflow: visible !important; padding: 0 !important; }
          @page { margin: 16mm; }
        }
      `}</style>

      {/* Always-present way out — this app runs standalone with no browser back */}
      <div
        className="pbs-bar"
        style={{
          display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
          padding: "12px 14px", borderBottom: `1px solid ${D.border}`,
          background: D.bk,
        }}
      >
        <Button small variant="secondary" onClick={onClose} autoFocus
          style={{ background: "transparent", color: "#E8B84B", borderColor: "#E8B84B" }}>
          ← Close
        </Button>
        <span style={{
          fontFamily: HEAD, fontSize: 9, fontWeight: 700, letterSpacing: ".12em",
          color: "#FAFAF7", textTransform: "uppercase", flex: 1,
        }}>
          Printable Workbook
        </span>
        <Button small onClick={() => window.print()} accent="#E8B84B"
          style={{ color: "#0A0A0A" }}>
          Print
        </Button>
      </div>

      <div className="pbs-scroll" style={{ flex: 1, overflowY: "auto", padding: "22px 18px 60px" }}>
        <div
          className="pbs-doc"
          style={{ maxWidth: 720, margin: "0 auto" }}
          dangerouslySetInnerHTML={{ __html: buildWorkbookHTML(sheet, { filled }) }}
        />
        <div style={{ maxWidth: 720, margin: "24px auto 0" }}>
          <Button variant="secondary" full onClick={onClose}>← Close workbook</Button>
        </div>
      </div>
    </div>
  );
}
