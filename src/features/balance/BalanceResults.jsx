import { useState, useMemo } from "react";
import {
  C, deriveSummary, buildAIPayload, AI_SYSTEM_PROMPT, ASSET_CATEGORIES,
  WEEKLY_AREAS, weeklySeries, AI_GOVERNANCE_APPROVED, PROTOTYPE_NOTE,
} from "../../lib/balanceSheet.js";
import { decisionSupport } from "../../lib/balanceDecisionSupport.js";
import { ANCHOR_SETS, valueOf } from "../../lib/balanceAnswers.js";
import { callProxy } from "../../lib/ai.js";
import { D, Button, Card, Callout, TextArea, SectionShell, Kicker } from "./BalanceUI.jsx";


const catLabel = (id) => ASSET_CATEGORIES.find(c => c.id === id)?.label || id;
const accessLabel = (a) => {
  const v = valueOf(a.access);
  return v == null ? "not rated" : `${v} — ${ANCHOR_SETS["access-0to4-v1"].labels[v]}`;
};

function Stat({ label, value, accent, note }) {
  return (
    <div style={{
      flex: "1 1 130px", background: D.surf, border: `1px solid ${D.border}`,
      borderLeft: `3px solid ${accent}`, borderRadius: 14, padding: 13,
    }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: D.bk, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: D.muted, marginTop: 4, lineHeight: 1.45 }}>{label}</div>
      {note && <div style={{ fontSize: 10, color: D.faint, marginTop: 3 }}>{note}</div>}
    </div>
  );
}

function Block({ title, accent, children, empty }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <Kicker color={accent} style={{ marginBottom: 8 }}>{title}</Kicker>
      {children || <p style={{ fontSize: 12, color: D.faint, lineHeight: 1.6 }}>{empty}</p>}
    </div>
  );
}

/** Per-item within-person trend. No composite index across different questions. */
function WeeklyTrend({ sheet }) {
  const rows = WEEKLY_AREAS.map(a => ({ area: a, ...weeklySeries(sheet, a.id) }))
    .filter(r => r.series.length > 0);
  if (!rows.length) return <p style={{ fontSize: 12, color: D.faint }}>No weekly reviews recorded yet.</p>;
  return (
    <div>
      {rows.map(({ area, series, max, split }) => (
        <div key={area.id} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: D.bk, marginBottom: 5 }}>{area.label}</div>
          <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 34 }}>
            {series.map((p, i) => (
              <div key={i} title={`${p.weekOf}: ${p.value} of ${max}`}
                style={{ flex: 1, maxWidth: 26, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                <div style={{ height: `${Math.max(6, (p.value / max) * 100)}%`, background: C.green, borderRadius: 3 }} />
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: D.muted, marginTop: 4 }}>
            {series.map(p => `${p.weekOf}: ${p.value}/${max}`).join(" · ")}
          </div>
          {split && (
            <div style={{ fontSize: 10, color: D.faint, marginTop: 2 }}>
              Earlier answers used a different scale and are shown separately in your export.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function BalanceResults({ sheet, patch, accessToken, onEditSection, onExport, onPrint, onDelete }) {
  const summary = useMemo(() => deriveSummary(sheet), [sheet]);
  const prompts = useMemo(() => decisionSupport(sheet), [sheet]);
  const [aiStep, setAiStep] = useState(null);
  const [payload, setPayload] = useState("");
  const [aiError, setAiError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const aiAvailable = AI_GOVERNANCE_APPROVED && !!accessToken;

  const openAI = () => { setPayload(buildAIPayload(sheet, { scrub: true })); setAiError(""); setAiStep("review"); };

  const runAI = async () => {
    setAiStep("working"); setAiError("");
    try {
      const text = await callProxy([{ role: "user", content: payload }], AI_SYSTEM_PROMPT, accessToken, 1500);
      patch({ aiSummary: text, aiConsent: { granted: true, grantedAt: new Date().toISOString(), payloadReviewed: true } });
      setAiStep("done");
    } catch (err) {
      setAiError(`Could not reach the assistant (${err.message}). Everything below still works without it.`);
      setAiStep("review");
    }
  };

  return (
    <SectionShell
      title="Your Personal Balance Sheet" accent={C.navy} kicker="Summary"
      intro="Built only from what you wrote. Nothing here is a diagnosis, a clinical label, a legal conclusion, or financial advice."
    >
      {summary.labels.length > 0 && (
        <Callout accent={C.navy} title="Where you stand right now">
          {summary.labels.map(l => <div key={l} style={{ marginBottom: 4 }}>· {l}</div>)}
        </Callout>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
        <Stat label="Resources you can reach" value={summary.accessible.length} accent={C.green} />
        <Stat label="Marked for today" value={summary.urgentCount} accent={C.red} />
        <Stat label="Average capacity" value={summary.capacityMean ?? "—"} accent={C.blue}
          note={summary.capacityMean != null ? `of ${summary.capacityMax}` : "not rated yet"} />
        <Stat label="Open command items" value={summary.immediateActions.length} accent={C.amber} />
      </div>

      {/* Decision support — supportive prompts, not verdicts */}
      {prompts.length > 0 && (
        <div style={{ marginBottom: 26 }}>
          <Kicker color={C.navy} style={{ marginBottom: 10 }}>Worth your attention</Kicker>
          {prompts.map(p => (
            <div key={p.id} style={{
              background: D.surf, border: `1px solid ${D.border}`, borderLeft: `3px solid ${C.navy}`,
              borderRadius: 14, padding: 14, marginBottom: 10,
            }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: D.bk, marginBottom: 5 }}>{p.title}</div>
              <p style={{ fontSize: 12.5, lineHeight: 1.75, color: D.muted, margin: 0 }}>{p.body}</p>
              {p.items?.length > 0 && (
                <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                  {p.items.slice(0, 4).map((t, i) => <li key={i} style={{ fontSize: 12, color: D.bk, lineHeight: 1.6 }}>{t}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <Block title="Resources and current access" accent={C.green}
        empty="No resources rated as usually or reliably available yet.">
        {summary.accessible.length > 0 && summary.accessible.map(a => (
          <p key={a.id} style={{ fontSize: 12, lineHeight: 1.65, marginBottom: 6 }}>
            <strong>{a.description || "Untitled"}</strong>
            <span style={{ color: D.muted }}> — {catLabel(a.category)} · availability {accessLabel(a)}</span>
          </p>
        ))}
      </Block>

      <Block title="Real, but hard to reach" accent={C.blue} empty="Nothing flagged as hard to reach.">
        {summary.hardToAccess.length > 0 && summary.hardToAccess.map(a => (
          <p key={a.id} style={{ fontSize: 12, lineHeight: 1.65, marginBottom: 6 }}>
            <strong>{a.description || "Untitled"}</strong>
            <span style={{ color: D.muted }}> — availability {accessLabel(a)}</span>
            {a.easierToUse && <><br /><span style={{ color: D.muted }}>Would help: {a.easierToUse}</span></>}
          </p>
        ))}
      </Block>

      <Block title="Drains by interference, urgency, and influence" accent={C.red}
        empty="No drains recorded.">
        {(sheet.liabilities || []).length > 0 && (sheet.liabilities || []).map(l => {
          const i = valueOf(l.interference), u = valueOf(l.urgency), inf = valueOf(l.influence);
          return (
            <p key={l.id} style={{ fontSize: 12, lineHeight: 1.65, marginBottom: 7 }}>
              <strong>{l.description || "Untitled"}</strong>
              <br />
              <span style={{ color: D.muted }}>
                interference {i ?? "—"}/4 · urgency {u ?? "—"}/3 · influence {inf ?? "—"}/3
                {l.response && ` · ${l.response}`}
              </span>
            </p>
          );
        })}
      </Block>

      <Block title="Capacity pattern" accent={C.blue} empty="No capacity items rated yet.">
        {summary.lowestCapacity.length > 0
          ? summary.lowestCapacity.map(c => (
              <p key={c.id} style={{ fontSize: 12, lineHeight: 1.65, marginBottom: 6 }}>
                <strong>{c.label}</strong>
                <span style={{ color: D.muted }}> — {c.rating} of {summary.capacityMax} ({ANCHOR_SETS["capacity-0to4-v1"].labels[c.rating]})</span>
              </p>
            ))
          : summary.capacityMean != null
            ? <p style={{ fontSize: 12, color: D.muted }}>Nothing at the bottom of the scale right now.</p>
            : null}
      </Block>

      <Block title="What you want to protect" accent={C.navy}>
        <div style={{ background: C.navy, color: "#F5F2EA", borderRadius: 14, padding: 14, fontSize: 13, lineHeight: 1.75 }}>
          {summary.equityStatement}
        </div>
      </Block>

      <Block title="Chosen priority" accent={C.navy} empty="No priority chosen yet.">
        {summary.priority?.area && (
          <>
            <p style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.6, marginBottom: 4 }}>{summary.priority.area}</p>
            {summary.priority.whyNow && <p style={{ fontSize: 12, color: D.muted, lineHeight: 1.65 }}>Why now: {summary.priority.whyNow}</p>}
            {summary.priority.costOfNoChange && <p style={{ fontSize: 12, color: D.muted, lineHeight: 1.65 }}>Cost of no change: {summary.priority.costOfNoChange}</p>}
          </>
        )}
      </Block>

      <Block title="Next action, if–then, support, review date" accent={C.blue} empty="No 30-day priorities set yet.">
        {summary.top30.length > 0 && summary.top30.map(g => (
          <div key={g.id} style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.6, margin: 0 }}>{g.priority || "Untitled"}</p>
            {g.firstAction && <p style={{ fontSize: 12, color: D.muted, margin: "3px 0", lineHeight: 1.6 }}>Next: {g.firstAction}{g.whenWhere ? ` — ${g.whenWhere}` : ""}</p>}
            {g.ifThen && <p style={{ fontSize: 12, color: D.muted, margin: "3px 0", lineHeight: 1.6 }}>{g.ifThen}</p>}
            {g.support && <p style={{ fontSize: 12, color: D.muted, margin: "3px 0", lineHeight: 1.6 }}>Support: {g.support}</p>}
            {g.targetDate && <p style={{ fontSize: 12, color: D.muted, margin: "3px 0" }}>Review: {g.targetDate}</p>}
          </div>
        ))}
      </Block>

      <Block title="Upcoming dates" accent={C.red} empty="No dates recorded.">
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

      <Block title="Weekly Close — one line per question" accent={C.green}>
        <WeeklyTrend sheet={sheet} />
      </Block>

      {/* ── AI assist ── */}
      <div style={{ borderTop: `1px solid ${D.border}`, paddingTop: 22, marginTop: 8 }}>
        <Kicker color={C.navy} style={{ marginBottom: 8 }}>Help me organize my answers</Kicker>

        {!AI_GOVERNANCE_APPROVED ? (
          <Callout accent={C.amber} title="Turned off pending review">
            Sending your written answers to an AI service is switched off until this use has a named
            owner, approved purpose, provider terms, and a retention position. Everything on this page
            works without it.
          </Callout>
        ) : !accessToken ? (
          <Callout accent={C.navy}>
            AI assist needs an access token. Add one under <strong>More → Settings</strong>.
          </Callout>
        ) : null}

        {sheet.aiSummary && aiStep !== "review" && aiStep !== "working" && (
          <div style={{
            background: D.surf, border: `1px solid ${D.border}`, borderLeft: `3px solid ${C.navy}`,
            borderRadius: 14, padding: 14, fontSize: 12.5, lineHeight: 1.75,
            whiteSpace: "pre-wrap", marginBottom: 12,
          }}>
            {sheet.aiSummary}
            <div style={{ marginTop: 10, fontSize: 10, color: D.faint }}>
              An AI reading of your own words — not a professional assessment.
            </div>
          </div>
        )}

        {aiAvailable && aiStep === null && (
          <Button variant="secondary" full onClick={openAI}>
            {sheet.aiSummary ? "Run it again" : "Review what would be sent"}
          </Button>
        )}

        {aiAvailable && (aiStep === "review" || aiStep === "working") && (
          <Card accent={C.navy}>
            <Kicker color={C.navy} style={{ marginBottom: 6 }}>Exactly what will be sent</Kicker>
            <p style={{ fontSize: 11.5, color: D.muted, lineHeight: 1.7, marginBottom: 10 }}>
              Obvious identifiers have been replaced with placeholders automatically, but please check.
              Delete anything you do not want to leave this device. Edit freely — only this text is sent.
            </p>
            <TextArea label="Payload (editable)" value={payload} onChange={setPayload} rows={12} />
            {aiError && (
              <div style={{ background: "#ffe6e6", border: `1px solid ${C.red}`, color: "#8f1218", borderRadius: 10, padding: 10, fontSize: 11, marginBottom: 10 }}>
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

        {aiStep === "done" && <Button variant="ghost" full onClick={() => setAiStep(null)}>Close</Button>}
      </div>

      {/* ── Data controls ── */}
      <div style={{ borderTop: `1px solid ${D.border}`, paddingTop: 22, marginTop: 24 }}>
        <Kicker color={D.faint} style={{ marginBottom: 10 }}>Your data</Kicker>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <Button variant="secondary" small onClick={onEditSection}>Edit answers</Button>
          <Button variant="secondary" small onClick={onExport}>Export (JSON)</Button>
          <Button variant="secondary" small onClick={onPrint}>Printable workbook</Button>
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
          <p style={{ fontSize: 11, color: C.red, lineHeight: 1.7 }}>
            This erases your whole balance sheet from this device. It cannot be undone.
            Export first if you want a copy.
          </p>
        )}
        <p style={{ fontSize: 11, color: D.faint, lineHeight: 1.7, marginTop: 12 }}>
          Your export is an ordinary file containing everything you wrote here, including sensitive
          free text. Store it somewhere you would keep a private letter.
        </p>
      </div>

      {/* Help lives in the module shell so it is present on every screen; a
          second copy here would just be duplication. */}
      <div style={{ marginTop: 22 }}>
        <span style={{ fontSize: 10.5, color: D.faint, lineHeight: 1.6 }}>{PROTOTYPE_NOTE}</span>
      </div>
    </SectionShell>
  );
}
