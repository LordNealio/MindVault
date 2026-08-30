import { useState, useEffect, useRef, useCallback } from "react";
import {
  C, SECTIONS, emptySheet, loadSheet, saveSheet, deleteSheet,
  storageLocation, sectionProgress,
} from "../../lib/balanceSheet.js";
import { trackEvent } from "../../lib/metrics.js";
import { D, HEAD, Button, Card, Callout, TextField, Kicker } from "./BalanceUI.jsx";
import { PrintableWorkbook } from "./PrintableWorkbook.jsx";
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
  const [printOpen, setPrintOpen] = useState(false);
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

  const handlePrint = () => setPrintOpen(true);

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
    <div style={{ padding: "22px 18px 130px", maxWidth: 560, margin: "0 auto" }}>
      <div ref={liveRef} aria-live="polite" role="status"
        style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }} />
      {children}
      {printOpen && (
        <PrintableWorkbook
          sheet={sheet || emptySheet()}
          filled={!!sheet && sheet.completionState !== "not_started"}
          onClose={() => setPrintOpen(false)}
        />
      )}
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
        <header style={{ marginBottom: 20 }}>
          <Kicker color={C.navy} style={{ marginBottom: 8 }}>A life inventory &amp; action toolkit</Kicker>
          <h1 style={{
            fontFamily: HEAD, fontSize: 26, fontWeight: 900, margin: "0 0 10px",
            color: D.bk, lineHeight: 1.15, letterSpacing: "-.02em",
          }}>
            The Personal<br />Balance Sheet
          </h1>
          <p style={{ fontSize: 13.5, lineHeight: 1.75, color: D.muted, margin: 0 }}>
            Take inventory of what is strong, what is draining you, and what needs your attention next.
          </p>
        </header>

        <Callout accent={C.navy}>
          Struggling does not erase your value. But identifying your value is not enough if you
          continue avoiding serious liabilities.
        </Callout>

        {started && (
          <Card accent={C.green}>
            <Kicker color={C.green} style={{ marginBottom: 8 }}>
              {done ? "Completed" : "In progress"}
            </Kicker>
            <div style={{ display: "flex", gap: 3, marginBottom: 10 }}>
              {SECTIONS.map(s => (
                <div key={s.id} style={{
                  flex: 1, height: 5, borderRadius: 3,
                  background: prog[s.id] ? s.accent : D.border,
                }} />
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: D.muted, lineHeight: 1.65 }}>
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
          <Button variant="secondary" full onClick={() => setPrintOpen(true)}>
            Printable Workbook
          </Button>
        </div>

        <div style={{ marginTop: 26 }}>
          <Kicker color={D.faint} style={{ marginBottom: 10 }}>What it covers</Kicker>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {SECTIONS.map((s, i) => (
              <span key={s.id} style={{
                fontSize: 11, fontWeight: 600, padding: "7px 11px", borderRadius: 20,
                background: D.surf, border: `1px solid ${D.border}`,
                color: D.bk, display: "inline-flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: s.accent }} />
                {s.label}
              </span>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 11.5, color: D.faint, lineHeight: 1.8, marginTop: 26 }}>
          Stability before scale · evidence before certainty · completion before expansion ·
          don't suffer in silence.
        </p>
      </>
    );
  }

  // ── Intro ──
  if (view === "intro") {
    return wrap(
      <>
        <Kicker color={C.navy} style={{ marginBottom: 8 }}>Before you start</Kicker>
        <h1 style={{
          fontFamily: HEAD, fontSize: 21, fontWeight: 900, margin: "0 0 14px",
          lineHeight: 1.25, letterSpacing: "-.01em",
        }}>
          How this works
        </h1>
        <p style={{ fontSize: 13.5, lineHeight: 1.85, color: D.bk, marginBottom: 20 }}>
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
          ].map(([t, body], i, arr) => (
            <div key={t} style={{ marginBottom: i === arr.length - 1 ? 0 : 14 }}>
              <Kicker color={C.navy} style={{ marginBottom: 4 }}>{t}</Kicker>
              <div style={{ fontSize: 12.5, color: D.muted, lineHeight: 1.7 }}>{body}</div>
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
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <Kicker color={section.accent}>
              Step {sectionIdx + 1} of {SECTIONS.length}
            </Kicker>
            <span style={{ fontSize: 10, color: D.faint }}>
              {savedAt ? `Saved ${savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Autosaves as you type"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 3 }} role="presentation">
            {SECTIONS.map((s, i) => (
              <div key={s.id} title={s.label} style={{
                flex: 1, height: 5, borderRadius: 3,
                background: i === sectionIdx ? s.accent : prog[s.id] ? `${s.accent}77` : D.border,
                transition: "background .2s",
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
