import { useEffect } from "react";
import { equityStatement, deriveSummary, CAPACITY_AREAS } from "../../lib/balanceSheet.js";
import { D, HEAD, Button } from "./BalanceUI.jsx";

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

<h2>1 · Assets</h2>
<p class="note">The people, abilities, experiences, resources, values, and resilience already working for you.</p>
${s.assets.length
    ? s.assets.map(a => `<div class="item">${line("What:", a.description)}<small>Strength ${a.strength || "—"}/5 · Access now ${a.access || "—"}/5</small>${a.note ? `<p><small>${esc(a.note)}</small></p>` : ""}</div>`).join("")
    : blanks(5, () => `<div class="item">${line("What:", "")}<small>Strength ___/5 · Access now ___/5</small></div>`)}
${line("Asset I must protect first:", s.protectFirst)}

<h2>2 · Liabilities</h2>
<p class="note">Not a character flaw — a condition, obligation, habit, fear, or unresolved problem draining capacity.</p>
${s.liabilities.length
    ? s.liabilities.map(l => `<div class="item">${line("What:", l.description)}${line("First next action:", l.firstAction)}<small>Urgency ${l.urgency || "—"}/3 · Deadline ${esc(l.deadline || "—")} · Helper ${esc(l.helper || "—")} · ${esc(l.status || "")}</small></div>`).join("")
    : blanks(5, () => `<div class="item">${line("What:", "")}${line("First next action:", "")}<small>Urgency ___/3 · Deadline ________ · Helper ________</small></div>`)}
${line("More dangerous if delayed:", s.mostDangerousDelay)}

<h2>3 · Capacity</h2>
<p class="note">Not potential — what you can reliably reach today.</p>
${CAPACITY_AREAS.map(a => {
    const d = s.capacity[a.id] || {};
    return `<p><span class="k">${esc(a.label)}:</span> ${d.rating ? `${d.rating}/5` : "___/5"}${d.affecting ? ` — affected by ${esc(d.affecting)}` : ""}${d.replenishes ? ` · replenished by ${esc(d.replenishes)}` : ""}</p>`;
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

<h2>7 · The 30 · 90 · 365 Plan</h2>
${[["30", "Stabilize urgent problems and restore basic routines."],
   ["90", "Build consistency, reduce open loops, complete one meaningful priority."],
   ["365", "Create sustainable health, family, work, and purpose systems."]].map(([h, purpose]) => {
    const gs = s.goals.filter(g => g.horizon === h);
    return `<p class="k">Next ${h} days</p><p class="note">${purpose}</p>` + (gs.length
      ? gs.map(g => `<div class="item">${line("Priority:", g.priority)}${line("Why it matters:", g.why)}${line("Done when:", g.measureOfDone)}${line("First visible action:", g.firstAction)}<small>Target ${esc(g.targetDate || "—")} · ${esc(g.status || "")}</small></div>`).join("")
      : blanks(3, () => `<div class="item">${line("Priority:", "")}${line("Done when:", "")}${line("First visible action:", "")}</div>`));
  }).join("")}
<p class="note">Maximum three priorities per horizon.</p>

<h2>8 · Weekly Close</h2>
<p class="note">Rate 1–5 each week: sleep · basics · calm · focus · family · admin · support · habits · work.</p>
${s.weeklyCloses.length
    ? s.weeklyCloses.map(w => `<div class="item"><p class="k">Week of ${esc(w.weekOf)}</p>${line("Strengthened:", w.strengthened)}${line("Liability increased:", w.liabilityIncreased)}${line("One move next week:", w.oneMove)}</div>`).join("")
    : blanks(2, () => `<div class="item">${line("Week of:", "")}${line("What strengthened this week?", "")}${line("What liability increased?", "")}${line("What remains unresolved?", "")}${line("Where did I ask for help?", "")}${line("One move for next week:", "")}</div>`)}

<h2>9 · Focus Triage</h2>
${s.focus.length
    ? s.focus.map(f => `<p><span class="k">${esc(f.decision)}</span> — ${esc(f.name)}${f.reviewDate ? ` <small>(review ${esc(f.reviewDate)})</small>` : ""}</p>`).join("")
    : blanks(5, () => `<p><span class="blank">&nbsp;</span> &nbsp; ACTIVE / MAINTAIN / PARK / ARCHIVE</p>`)}
<p class="rule">One foundation priority + one flagship commitment + one limited creative outlet. New ideas go to the parking lot until something ships or the review date arrives.</p>

${summary ? `<h2>Summary</h2>
<p><span class="k">Assets reachable now:</span> ${summary.strongAccessible.length} &nbsp; <span class="k">Urgent liabilities:</span> ${summary.urgentCount} &nbsp; <span class="k">Average capacity:</span> ${summary.capacityAvg ?? "—"}/5</p>
${summary.labels.map(l => `<p>· ${esc(l)}</p>`).join("")}` : ""}

<p class="foot">Not a diagnosis, clinical label, legal conclusion, or financial recommendation.<br/>
Generated by MindVault on ${new Date().toLocaleDateString()}.</p>`;
}

export function PrintableWorkbook({ sheet, filled, onClose }) {
  // Escape closes, and body scroll is locked while the overlay is up.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
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
