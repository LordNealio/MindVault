import { useState, useEffect, useRef, useCallback } from "react";
import {
  C, SECTIONS, emptySheet, loadSheet, saveSheet, deleteSheet,
  storageLocation, sectionProgress, deriveSummary, equityStatement,
} from "../../lib/balanceSheet.js";
import { trackEvent } from "../../lib/metrics.js";
import { D, Button, Card, Callout, TextField } from "./BalanceUI.jsx";
import {
  AssetsSection, LiabilitiesSection, CapacitySection, EquitySection,
  CommandSection, RisksSection, PlanSection, WeeklySection, FocusSection,
} from "./BalanceSections.jsx";
import { BalanceResults } from "./BalanceResults.jsx";

const SECTION_COMPONENTS = {
  assets: AssetsSection, liabilities: LiabilitiesSection, capacity: CapacitySection,
  equity: EquitySection, command: CommandSection, risks: RisksSection,
  plan: PlanSection, weekly: WeeklySection, focus: FocusSection,
};

// view: 'loading' | 'landing' | 'intro' | 'section' | 'results'
export function BalanceSheetScreen({ accessToken = "" }) {
  const [view, setView] = useState("loading");
  const [sheet, setSheet] = useState(null);
  const [sectionIdx, setSectionIdx] = useState(0);
  const [savedAt, setSavedAt] = useState(null);
  const [where, setWhere] = useState("this device");
  const [nameDraft, setNameDraft] = useState("");
  const saveTimer = useRef(null);
  const liveRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [existing, loc] = await Promise.all([loadSheet(), storageLocation()]);
      if (!alive) return;
      setWhere(loc);
      if (existing) {
        setSheet(existing);
        const idx = SECTIONS.findIndex(s => s.id === existing.currentSection);
        setSectionIdx(idx >= 0 ? idx : 0);
        setView("landing");
      } else {
        setView("landing");
      }
    })();
    trackEvent("feature_use", "balance_sheet").catch(() => {});
    return () => { alive = false; };
  }, []);

  // Debounced autosave. Only ever writes locally — no content in analytics.
  const persist = useCallback((next) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const stored = await saveSheet(next);
      setSavedAt(new Date());
      setSheet(s => (s ? { ...s, updatedAt: stored.updatedAt } : s));
    }, 600);
  }, []);

  const patch = useCallback((changes) => {
    setSheet(prev => {
      const next = { ...prev, ...changes, completionState: prev.completionState === "complete" ? "complete" : "in_progress" };
      persist(next);
      return next;
    });
  }, [persist]);

  const startNew = async () => {
    const fresh = { ...emptySheet(), ownerLabel: nameDraft.trim() || null, completionState: "in_progress" };
    setSheet(fresh);
    setSectionIdx(0);
    await saveSheet(fresh);
    setView("section");
  };

  const goToSection = (idx) => {
    const clamped = Math.max(0, Math.min(SECTIONS.length - 1, idx));
    setSectionIdx(clamped);
    patch({ currentSection: SECTIONS[clamped].id });
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (liveRef.current) {
      liveRef.current.textContent = `Section ${clamped + 1} of ${SECTIONS.length}: ${SECTIONS[clamped].label}`;
    }
    trackEvent("feature_use", "balance_sheet_section", { section: SECTIONS[clamped].id }).catch(() => {});
  };

  const finish = () => {
    patch({ completionState: "complete", currentSection: SECTIONS[sectionIdx].id });
    setView("results");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify({ app: "MindVault", kind: "personal-balance-sheet", exportedAt: new Date().toISOString(), sheet }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `personal-balance-sheet-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handlePrint = () => openPrintable(sheet);

  const handleDelete = async () => {
    await deleteSheet();
    setSheet(null);
    setSectionIdx(0);
    setView("landing");
  };

  // ── Loading ──
  if (view === "loading") {
    return <div style={{ padding: 24, color: D.muted, fontSize: 13 }}>Loading your balance sheet…</div>;
  }

  const wrap = (children) => (
    <div style={{ padding: "18px 16px 120px", maxWidth: 560, margin: "0 auto" }}>
      <div ref={liveRef} aria-live="polite" role="status"
        style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }} />
      {children}
    </div>
  );

  // ── Landing / entry point ──
  if (view === "landing") {
    const started = !!sheet && sheet.completionState !== "not_started";
    const done = sheet?.completionState === "complete";
    const prog = sheet ? sectionProgress(sheet) : {};
    const completedCount = Object.values(prog).filter(Boolean).length;

    return wrap(
      <>
        <header style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", color: D.bk }}>
            The Personal Balance Sheet
          </h1>
          <p style={{ fontSize: 13, color: D.muted, margin: 0 }}>A life inventory and action toolkit</p>
          <div style={{ height: 3, width: 48, background: C.navy, borderRadius: 2, marginTop: 10 }} />
        </header>

        <p style={{ fontSize: 13, lineHeight: 1.75, color: D.bk, marginBottom: 18 }}>
          Take inventory of what is strong, what is draining you, and what needs your attention next.
        </p>

        <Callout accent={C.navy}>
          Struggling does not erase your value. But identifying your value is not enough if you
          continue avoiding serious liabilities.
        </Callout>

        {started && (
          <Card accent={C.green}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              {done ? "Completed" : "In progress"}
            </div>
            <div style={{ fontSize: 11, color: D.muted, lineHeight: 1.6 }}>
              {completedCount} of {SECTIONS.length} sections have entries · last saved{" "}
              {new Date(sheet.updatedAt).toLocaleDateString()}
              {sheet.ownerLabel ? ` · ${sheet.ownerLabel}` : " · anonymous"}
            </div>
          </Card>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {started ? (
            <>
              <Button accent={C.navy} full onClick={() => { setView("section"); window.scrollTo(0, 0); }}>
                Continue My Balance Sheet
              </Button>
              <Button variant="secondary" full onClick={() => { setView("results"); window.scrollTo(0, 0); }}>
                View my summary
              </Button>
            </>
          ) : (
            <Button accent={C.navy} full onClick={() => setView("intro")}>
              Start My Balance Sheet
            </Button>
          )}
          <Button variant="secondary" full onClick={() => openPrintable(sheet)}>
            Download Printable Workbook
          </Button>
        </div>

        <div style={{ marginTop: 22 }}>
          <h2 style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>What it covers</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SECTIONS.map(s => (
              <span key={s.id} style={{
                fontSize: 10, fontWeight: 700, padding: "5px 9px", borderRadius: 6,
                background: D.surf, border: `1px solid ${D.border}`, borderLeft: `3px solid ${s.accent}`,
              }}>{s.label}</span>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 11, color: D.faint, lineHeight: 1.7, marginTop: 22 }}>
          Principles: stability before scale · evidence before certainty · completion before expansion ·
          don't suffer in silence.
        </p>
      </>
    );
  }

  // ── Intro ──
  if (view === "intro") {
    return wrap(
      <>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 12px" }}>Before you start</h1>
        <p style={{ fontSize: 13, lineHeight: 1.8, color: D.bk, marginBottom: 18 }}>
          The Personal Balance Sheet helps you examine your life without reducing your worth to your job,
          income, productivity, or current struggles. This is not a test or diagnosis. It is a structured
          way to see your position clearly and decide what to do next.
        </p>

        <Card accent={C.blue}>
          {[
            ["Time", "About 20–30 minutes. You do not have to finish in one sitting."],
            ["Autosave", "Every answer saves by itself as you type. You can pause and return at any time."],
            ["Privacy", `Your answers stay on ${where}. Nothing is uploaded unless you explicitly ask for AI help later, and you review the exact text first.`],
            ["Nothing is required", "Skip any question. Sensitive fields are never forced."],
          ].map(([t, body]) => (
            <div key={t} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.navy, marginBottom: 2 }}>{t}</div>
              <div style={{ fontSize: 12, color: D.muted, lineHeight: 1.65 }}>{body}</div>
            </div>
          ))}
        </Card>

        <TextField
          label="What should this be filed under?"
          hint="A name, a nickname, your initials — or leave it blank to stay anonymous."
          value={nameDraft} onChange={setNameDraft} placeholder="Optional"
        />

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <Button accent={C.navy} full onClick={startNew}>Start</Button>
          <Button variant="ghost" onClick={() => setView("landing")}>Back</Button>
        </div>
      </>
    );
  }

  // ── Results ──
  if (view === "results" && sheet) {
    return wrap(
      <>
        <Button variant="ghost" small onClick={() => setView("landing")}>← Balance Sheet home</Button>
        <div style={{ height: 10 }} />
        <BalanceResults
          sheet={sheet} patch={patch} accessToken={accessToken}
          onEditSection={() => { setView("section"); window.scrollTo(0, 0); }}
          onExport={handleExport} onPrint={handlePrint} onDelete={handleDelete}
        />
      </>
    );
  }

  // ── Section flow ──
  if (view === "section" && sheet) {
    const section = SECTIONS[sectionIdx];
    const Component = SECTION_COMPONENTS[section.id];
    const isLast = sectionIdx === SECTIONS.length - 1;
    const prog = sectionProgress(sheet);

    return wrap(
      <>
        {/* Progress */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: D.bk }}>
              Step {sectionIdx + 1} of {SECTIONS.length}
            </span>
            <span style={{ fontSize: 10, color: D.muted }}>
              {savedAt ? `Saved ${savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Autosaves as you type"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 3 }} role="presentation">
            {SECTIONS.map((s, i) => (
              <div key={s.id} title={s.label} style={{
                flex: 1, height: 5, borderRadius: 3,
                background: i === sectionIdx ? s.accent : prog[s.id] ? `${s.accent}77` : D.border,
              }} />
            ))}
          </div>
        </div>

        <Component sheet={sheet} patch={patch} />

        {/* Navigation */}
        <div style={{ display: "flex", gap: 8, marginTop: 28, flexWrap: "wrap" }}>
          <Button variant="secondary" disabled={sectionIdx === 0} onClick={() => goToSection(sectionIdx - 1)}>
            ← Previous
          </Button>
          {isLast ? (
            <Button accent={C.navy} onClick={finish} style={{ flex: 1 }}>See my summary</Button>
          ) : (
            <Button accent={section.accent} onClick={() => goToSection(sectionIdx + 1)} style={{ flex: 1 }}>
              Next →
            </Button>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <Button variant="ghost" small onClick={() => { setView("landing"); window.scrollTo(0, 0); }}>
            Save and exit
          </Button>
          {!isLast && (
            <Button variant="ghost" small onClick={finish}>Skip to summary</Button>
          )}
        </div>

        <p style={{ fontSize: 10, color: D.faint, marginTop: 16, lineHeight: 1.6 }}>
          Nothing here is required. Leave anything blank and keep moving — an honest partial answer is
          worth more than a complete invented one.
        </p>
      </>
    );
  }

  return null;
}

/**
 * Printable workbook. Generated from the app itself so it always exists and
 * always matches the current content — the source PDF is not bundled in this
 * repo. Prints blank prompts when there are no answers yet, so it doubles as
 * the paper workbook.
 */
function openPrintable(sheet) {
  const s = sheet || emptySheet();
  const summary = deriveSummary(s);
  const esc = (t) => String(t ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const line = (label, val) => `<p><span class="k">${esc(label)}</span> ${val ? esc(val) : '<span class="blank">&nbsp;</span>'}</p>`;

  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>Personal Balance Sheet</title>
<style>
  @media print { @page { margin: 18mm; } .noprint { display: none; } }
  body { font-family: Georgia, 'Times New Roman', serif; color: #111; line-height: 1.6; max-width: 720px; margin: 0 auto; padding: 28px; }
  h1 { font-size: 24px; margin: 0 0 2px; } h2 { font-size: 15px; margin: 26px 0 6px; border-bottom: 2px solid #1D3557; padding-bottom: 4px; }
  .sub { color: #555; margin: 0 0 18px; } .k { font-weight: bold; }
  .blank { display: inline-block; border-bottom: 1px solid #999; min-width: 240px; }
  .item { border-left: 3px solid #1D3557; padding-left: 10px; margin-bottom: 10px; }
  .quote { background: #f4f1ea; padding: 12px; border-radius: 6px; }
  small { color: #666; }
</style></head><body>
<button class="noprint" onclick="window.print()" style="padding:10px 16px;font-size:13px;cursor:pointer;margin-bottom:16px">Print / Save as PDF</button>
<h1>The Personal Balance Sheet</h1>
<p class="sub">A life inventory and action toolkit${s.ownerLabel ? ` — ${esc(s.ownerLabel)}` : ""}</p>
<p><em>Struggling does not erase your value. But identifying your value is not enough if you continue avoiding serious liabilities.</em></p>

<h2>1. Assets</h2>
${s.assets.length ? s.assets.map(a => `<div class="item">${line("What:", a.description)}<small>Strength ${a.strength || "—"}/5 · Access now ${a.access || "—"}/5</small>${a.note ? `<p><small>${esc(a.note)}</small></p>` : ""}</div>`).join("")
  : Array.from({ length: 4 }).map(() => `<div class="item">${line("What:", "")}<small>Strength ___/5 · Access now ___/5</small></div>`).join("")}
${line("Asset I must protect first:", s.protectFirst)}

<h2>2. Liabilities</h2>
${s.liabilities.length ? s.liabilities.map(l => `<div class="item">${line("What:", l.description)}${line("First next action:", l.firstAction)}<small>Urgency ${l.urgency || "—"}/3 · Deadline ${esc(l.deadline || "—")} · Helper ${esc(l.helper || "—")} · ${esc(l.status || "")}</small></div>`).join("")
  : Array.from({ length: 4 }).map(() => `<div class="item">${line("What:", "")}${line("First next action:", "")}<small>Urgency ___/3 · Deadline ______ · Helper ______</small></div>`).join("")}
${line("More dangerous if delayed:", s.mostDangerousDelay)}

<h2>3. Capacity</h2>
${["Sleep and physical energy","Concentration and task initiation","Emotional regulation and calm","Self-care and daily routines","Family and relationship presence","Administrative follow-through","Work or study capacity","Ability to ask for and accept help"]
  .map((label, i) => {
    const id = ["sleep","focus","regulation","selfcare","presence","admin","work","help"][i];
    const d = s.capacity[id] || {};
    return `<p><span class="k">${label}:</span> ${d.rating ? `${d.rating}/5` : "___/5"}${d.affecting ? ` — affected by ${esc(d.affecting)}` : ""}</p>`;
  }).join("")}

<h2>4. Personal Equity</h2>
${line("Core values:", s.equity.values)}
${line("Who values me beyond performance:", s.equity.whoValuesMe)}
${line("Proven strengths:", s.equity.provenStrengths)}
${line("Cannot be taken by a setback:", s.equity.cannotBeTaken)}
<p class="quote">${esc(equityStatement(s))}</p>

<h2>5. Command Center</h2>
${s.commandCenter.length ? s.commandCenter.map(i => `<div class="item">${line("Issue:", i.issue)}${line("Next physical action:", i.nextAction)}<small>${esc(i.priority || "")} · due ${esc(i.deadline || "—")} · ${esc(i.status || "")}</small></div>`).join("")
  : Array.from({ length: 5 }).map(() => `<div class="item">${line("Issue:", "")}${line("Next physical action:", "")}<small>Priority ______ · Due ______ · Status ______</small></div>`).join("")}
<p><small><strong>Rule:</strong> List first. Solve second. Complete one command-center item before beginning optional expansion work.</small></p>

<h2>6. Risks and Early Warning Signs</h2>
${s.risks.length ? s.risks.map(r => `<div class="item">${line("Risk:", r.risk)}${line("Early warning sign:", r.warningSign)}${line("Prevention:", r.prevention)}${line("Escalation point:", r.escalationPoint)}</div>`).join("")
  : Array.from({ length: 3 }).map(() => `<div class="item">${line("Risk:", "")}${line("Early warning sign:", "")}${line("Prevention:", "")}</div>`).join("")}
${line("Escalation plan:", s.escalationPlan)}
<p><small><strong>If you are in immediate danger,</strong> contact your local emergency number or go to the nearest emergency department. In the United States you can call or text 988. This workbook is not a crisis service.</small></p>

<h2>7. The 30 · 90 · 365 Plan</h2>
${["30","90","365"].map(h => {
  const gs = s.goals.filter(g => g.horizon === h);
  return `<p class="k">Next ${h} days</p>` + (gs.length ? gs.map(g => `<div class="item">${line("Priority:", g.priority)}${line("Done when:", g.measureOfDone)}${line("First action:", g.firstAction)}<small>Target ${esc(g.targetDate || "—")}</small></div>`).join("")
    : Array.from({ length: 3 }).map(() => `<div class="item">${line("Priority:", "")}${line("Done when:", "")}</div>`).join(""));
}).join("")}

<h2>8. Weekly Close</h2>
${s.weeklyCloses.length ? s.weeklyCloses.map(w => `<div class="item"><p class="k">Week of ${esc(w.weekOf)}</p>${line("One move next week:", w.oneMove)}</div>`).join("")
  : `<p>Rate 1–5 each week: sleep · basics · calm · focus · family · admin · support · habits · work.</p>${line("What strengthened this week?", "")}${line("What liability increased?", "")}${line("One move for next week:", "")}`}

<h2>9. Focus Triage</h2>
${s.focus.length ? s.focus.map(f => `<p><span class="k">${esc(f.decision)}</span> — ${esc(f.name)}${f.reviewDate ? ` <small>(review ${esc(f.reviewDate)})</small>` : ""}</p>`).join("")
  : `<p>Classify each commitment: ACTIVE · MAINTAIN · PARK · ARCHIVE</p>`}
<p><small>One foundation priority + one flagship commitment + one limited creative outlet. New ideas go to the parking lot.</small></p>

${sheet ? `<h2>Summary</h2>
<p><span class="k">Assets reachable now:</span> ${summary.strongAccessible.length} · <span class="k">Urgent liabilities:</span> ${summary.urgentCount} · <span class="k">Average capacity:</span> ${summary.capacityAvg ?? "—"}/5</p>
${summary.labels.map(l => `<p>· ${esc(l)}</p>`).join("")}` : ""}

<p style="margin-top:28px"><small>Not a diagnosis, clinical label, legal conclusion, or financial recommendation.
Generated by MindVault on ${new Date().toLocaleDateString()}.</small></p>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
