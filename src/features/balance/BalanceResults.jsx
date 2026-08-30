import { useState, useMemo } from "react";
import {
  C, deriveSummary, buildAIPayload, AI_SYSTEM_PROMPT, ASSET_CATEGORIES,
} from "../../lib/balanceSheet.js";
import { callProxy } from "../../lib/ai.js";
import { D, Button, Card, Callout, TextArea, SectionShell } from "./BalanceUI.jsx";
import { SafetyNotice } from "./BalanceSections.jsx";

const catLabel = (id) => ASSET_CATEGORIES.find(c => c.id === id)?.label || id;

function Stat({ label, value, accent, note }) {
  return (
    <div style={{
      flex: "1 1 130px", background: D.surf, border: `1px solid ${D.border}`,
      borderLeft: `3px solid ${accent}`, borderRadius: 10, padding: 12,
    }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: D.bk, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: D.muted, marginTop: 4, lineHeight: 1.4 }}>{label}</div>
      {note && <div style={{ fontSize: 10, color: D.faint, marginTop: 3 }}>{note}</div>}
    </div>
  );
}

function Block({ title, accent, children, empty }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h3 style={{ fontSize: 12, fontWeight: 800, color: D.bk, marginBottom: 2 }}>{title}</h3>
      <div style={{ height: 2, width: 26, background: accent, borderRadius: 2, marginBottom: 10 }} />
      {children || <p style={{ fontSize: 12, color: D.faint, lineHeight: 1.6 }}>{empty}</p>}
    </div>
  );
}

export function BalanceResults({ sheet, patch, accessToken, onEditSection, onExport, onPrint, onDelete }) {
  const summary = useMemo(() => deriveSummary(sheet), [sheet]);
  const [aiStep, setAiStep] = useState(null);      // null | 'review' | 'working' | 'done'
  const [payload, setPayload] = useState("");
  const [aiError, setAiError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const openAI = () => {
    setPayload(buildAIPayload(sheet, { scrub: true }));
    setAiError("");
    setAiStep("review");
  };

  const runAI = async () => {
    setAiStep("working");
    setAiError("");
    try {
      const text = await callProxy(
        [{ role: "user", content: payload }],
        AI_SYSTEM_PROMPT,
        accessToken,
        1500
      );
      patch({
        aiSummary: text,
        aiConsent: { granted: true, grantedAt: new Date().toISOString(), payloadReviewed: true },
      });
      setAiStep("done");
    } catch (err) {
      setAiError(`Could not reach the assistant (${err.message}). Everything below still works without it.`);
      setAiStep("review");
    }
  };

  return (
    <SectionShell
      title="Your Personal Balance Sheet" accent={C.navy}
      intro="A summary built only from what you wrote. Nothing here is a diagnosis, a clinical label, a legal conclusion, or financial advice."
    >
      {summary.labels.length > 0 && (
        <Callout accent={C.navy} title="Where you stand right now">
          {summary.labels.map(l => (
            <div key={l} style={{ marginBottom: 4 }}>· {l}</div>
          ))}
        </Callout>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
        <Stat label="Assets you can reach now" value={summary.strongAccessible.length} accent={C.green} />
        <Stat label="Urgent liabilities" value={summary.urgentCount} accent={C.red} />
        <Stat label="Average capacity" value={summary.capacityAvg ?? "—"} accent={C.blue} note={summary.capacityAvg ? "out of 5" : "not rated yet"} />
        <Stat label="Open command items" value={summary.immediateActions.length} accent={C.amber} />
      </div>

      <Block title="Strongest accessible assets" accent={C.green}
        empty="No assets rated 4+ for both strength and access yet.">
        {summary.strongAccessible.length > 0 && summary.strongAccessible.map(a => (
          <p key={a.id} style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 6 }}>
            <strong>{a.description || "Untitled"}</strong>
            <span style={{ color: D.muted }}> — {catLabel(a.category)} · strength {a.strength}/5 · access {a.access}/5</span>
          </p>
        ))}
      </Block>

      <Block title="Strong, but hard to access right now" accent={C.blue}
        empty="Nothing flagged as strong-but-out-of-reach.">
        {summary.strongHardToAccess.length > 0 && summary.strongHardToAccess.map(a => (
          <p key={a.id} style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 6 }}>
            <strong>{a.description || "Untitled"}</strong>
            <span style={{ color: D.muted }}> — strength {a.strength}/5 but access only {a.access}/5</span>
          </p>
        ))}
      </Block>

      <Block title="Lowest capacity areas" accent={C.blue}
        empty="No area rated 2 or below.">
        {summary.lowestCapacity.length > 0 && summary.lowestCapacity.map(c => (
          <p key={c.id} style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 6 }}>
            <strong>{c.label}</strong><span style={{ color: D.muted }}> — {c.rating}/5</span>
          </p>
        ))}
      </Block>

      <Block title="Most immediate command-center actions" accent={C.amber}
        empty="Nothing open in the command center.">
        {summary.immediateActions.length > 0 && (
          <ol style={{ paddingLeft: 18, margin: 0 }}>
            {summary.immediateActions.map(i => (
              <li key={i.id} style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 6 }}>
                <strong>{i.issue || "Untitled"}</strong>
                {i.nextAction && <><br /><span style={{ color: D.muted }}>Next: {i.nextAction}</span></>}
                {i.deadline && <span style={{ color: C.red }}> · due {i.deadline}</span>}
              </li>
            ))}
          </ol>
        )}
      </Block>

      <Block title="Personal Equity Statement" accent={C.navy}>
        <div style={{
          background: C.navy, color: "#F5F2EA", borderRadius: 10, padding: 14,
          fontSize: 13, lineHeight: 1.75,
        }}>
          {summary.equityStatement}
        </div>
      </Block>

      <Block title="Top priorities — next 30 days" accent={C.blue}
        empty="No 30-day priorities set yet.">
        {summary.top30.length > 0 && summary.top30.map(g => (
          <p key={g.id} style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 6 }}>
            <strong>{g.priority || "Untitled"}</strong>
            {g.measureOfDone && <><br /><span style={{ color: D.muted }}>Done when: {g.measureOfDone}</span></>}
          </p>
        ))}
      </Block>

      <Block title="Upcoming deadlines" accent={C.red} empty="No dates recorded.">
        {summary.upcoming.length > 0 && summary.upcoming.map((d, i) => (
          <p key={i} style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 5 }}>
            <strong>{d.date}</strong> <span style={{ color: D.muted }}>— {d.what} ({d.from})</span>
          </p>
        ))}
      </Block>

      <Block title="Current focus decisions" accent={C.amber} empty="No commitments triaged yet.">
        {summary.focus.length > 0 && summary.focus.map(f => (
          <p key={f.id} style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 5 }}>
            <strong>{f.decision}</strong> <span style={{ color: D.muted }}>— {f.name || "Untitled"}</span>
          </p>
        ))}
      </Block>

      <Block title="Weekly Close history" accent={C.green} empty="No weekly reviews recorded yet.">
        {summary.weeklyCloses.length > 0 && summary.weeklyCloses.slice(0, 8).map(w => {
          const vals = Object.values(w.ratings || {}).filter(Boolean);
          const mean = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
          return (
            <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: D.muted, width: 84, flexShrink: 0 }}>{w.weekOf}</span>
              <div style={{ flex: 1, height: 8, background: D.border, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${(mean / 5) * 100}%`, height: "100%", background: C.green }} />
              </div>
              <span style={{ fontSize: 11, color: D.bk, width: 52, textAlign: "right" }}>{mean ? mean.toFixed(1) : "—"} / 5</span>
            </div>
          );
        })}
      </Block>

      {/* ── AI assist (optional, consent-gated) ── */}
      <div style={{ borderTop: `1px solid ${D.border}`, paddingTop: 20, marginTop: 8 }}>
        <h3 style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Help Me Organize My Answers</h3>
        <p style={{ fontSize: 12, color: D.muted, lineHeight: 1.65, marginBottom: 12 }}>
          Optional. Everything above works without it. If you use it, your text is sent to an AI
          assistant through this app's secure proxy so it can group themes and turn vague intentions
          into concrete actions. It will not diagnose you or make legal, medical, or financial decisions.
        </p>

        {sheet.aiSummary && aiStep !== "review" && aiStep !== "working" && (
          <div style={{
            background: D.surf, border: `1px solid ${D.border}`, borderLeft: `3px solid ${C.navy}`,
            borderRadius: 10, padding: 14, fontSize: 12.5, lineHeight: 1.75,
            whiteSpace: "pre-wrap", marginBottom: 12,
          }}>
            {sheet.aiSummary}
            <div style={{ marginTop: 10, fontSize: 10, color: D.faint }}>
              An AI reading of your own words — not a professional assessment.
            </div>
          </div>
        )}

        {!accessToken ? (
          <Callout accent={C.navy}>
            AI assist is switched off because no access token is set. Add one under
            <strong> More → Settings</strong> to enable it. Nothing else on this page needs it.
          </Callout>
        ) : aiStep === null ? (
          <Button variant="secondary" full onClick={openAI}>
            {sheet.aiSummary ? "Run it again" : "Review what would be sent"}
          </Button>
        ) : null}

        {(aiStep === "review" || aiStep === "working") && (
          <Card accent={C.navy}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Exactly what will be sent</div>
            <p style={{ fontSize: 11, color: D.muted, lineHeight: 1.6, marginBottom: 10 }}>
              Obvious identifiers have been replaced with placeholders automatically, but please check.
              Delete anything you do not want to leave this device — names, employers, clinicians,
              addresses, claim or account numbers, medical-record details. Edit freely; only this text is sent.
            </p>
            <TextArea label="Payload (editable)" value={payload} onChange={setPayload} rows={12} />
            {aiError && (
              <div style={{ background: "#ffe6e6", border: `1px solid ${C.red}`, color: "#8f1218", borderRadius: 8, padding: 10, fontSize: 11, marginBottom: 10 }}>
                {aiError}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <Button accent={C.navy} full disabled={aiStep === "working" || !payload.trim()} onClick={runAI}>
                {aiStep === "working" ? "Working…" : "I consent — send this text"}
              </Button>
              <Button variant="ghost" onClick={() => setAiStep(null)}>Cancel</Button>
            </div>
          </Card>
        )}

        {aiStep === "done" && (
          <Button variant="ghost" full onClick={() => setAiStep(null)}>Close</Button>
        )}
      </div>

      <SafetyNotice />

      {/* ── Data controls ── */}
      <div style={{ borderTop: `1px solid ${D.border}`, paddingTop: 20, marginTop: 24 }}>
        <h3 style={{ fontSize: 12, fontWeight: 800, marginBottom: 10 }}>Your data</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <Button variant="secondary" small onClick={onEditSection}>Edit answers</Button>
          <Button variant="secondary" small onClick={onExport}>Export (JSON)</Button>
          <Button variant="secondary" small onClick={onPrint}>Print / save as PDF</Button>
          {!confirmDelete
            ? <Button variant="danger" small onClick={() => setConfirmDelete(true)}>Delete everything</Button>
            : (
              <>
                <Button variant="danger" small onClick={onDelete}>Yes, permanently delete</Button>
                <Button variant="ghost" small onClick={() => setConfirmDelete(false)}>Keep my data</Button>
              </>
            )}
        </div>
        {confirmDelete && (
          <p style={{ fontSize: 11, color: C.red, lineHeight: 1.6 }}>
            This erases your whole balance sheet from this device. It cannot be undone.
            Export first if you want a copy.
          </p>
        )}
      </div>
    </SectionShell>
  );
}
