/**
 * AutomationWorkspace.jsx — Slice 2 Phase 1
 *
 * Key changes from Slice 1:
 * - Session token management: in-memory only (not persisted), shows setup UI if absent
 * - Passes sessionToken (not apiKey) to startRun
 * - Demo mode triggered by !sessionToken (same semantics as !apiKey was)
 * - AUTH_ERROR responses from proxy trigger token invalidation + re-prompt
 * - Security notice updated: proxy active, not browser-direct
 *
 * apiKey prop is still received (App.jsx passes it) but is no longer used
 * for automation agent calls. It remains unused for compatibility.
 */

import { useState, useEffect, useCallback } from "react";
import { startRun, cancelRun, loadAllRuns, approveRun, rejectRun } from "./orchestrator.js";
import { getStepsForRun, getAuditEventsForRun } from "./db.js";
import {
  TASK_TYPE, STATE_LABEL, STATE_COLOR, RISK_TIER_LABEL,
  RISK_TIER_BG, RISK_TIER_COLOR, AGENT_LABEL, TERMINAL_STATES, RUN_STATE,
} from "./contracts.js";

// ── Design tokens ─────────────────────────────────────────────────────────
const D = {
  bg:"#F0EDE5", white:"#FAFAF7", bl:"#1D3557", rd:"#C1121F",
  yl:"#E8B84B", bk:"#0A0A0A", muted:"#9B9589", border:"#E8E4DA",
  shadow:"rgba(0,0,0,0.08)", r:18,
};

// ── Shared primitives ─────────────────────────────────────────────────────
const Spinner = ({ size=14, color=D.bk }) => (
  <div style={{width:size,height:size,border:`2px solid ${color}33`,borderTopColor:color,
    borderRadius:"50%",animation:"spin .7s linear infinite",flexShrink:0}}/>
);
const SLabel = ({ children, color=D.bk, style={} }) => (
  <div style={{fontFamily:"'Unbounded',monospace",fontSize:8,fontWeight:700,
    letterSpacing:".14em",textTransform:"uppercase",color,...style}}>{children}</div>
);
const Card = ({ children, accent, style={} }) => (
  <div style={{background:D.white,borderRadius:D.r,boxShadow:`0 3px 16px ${D.shadow}`,
    overflow:"hidden",...(accent?{borderTop:`4px solid ${accent}`}:{}),...style}}>{children}</div>
);
const AccentStrip = () => (
  <div style={{display:"flex",height:2.5}}>
    <div style={{flex:3.5,background:D.bl}}/><div style={{flex:.8,background:D.rd}}/>
    <div style={{flex:.5,background:D.yl}}/>
  </div>
);

// ── AutomationWorkspace ───────────────────────────────────────────────────
export function AutomationWorkspace({ apiKey }) {
  // ── Session token state ──────────────────────────────────────────────
  // Stored in React state (memory) only. Not persisted to localStorage or IDB.
  // Rationale: the token grants server-side AI call access. Persisting it
  // introduces the same XSS risk as persisting an API key. The user pastes
  // it once per session. Tab close clears it. This is the correct default.
  // A future "remember this device" option could encrypt + persist it, but
  // that requires explicit user consent and is deferred to Phase 2.
  const [sessionToken,  setSessionToken]  = useState("");
  const [tokenInput,    setTokenInput]    = useState("");
  const [tokenError,    setTokenError]    = useState("");  // e.g. "Invalid token"

  // ── Run state ────────────────────────────────────────────────────────
  const [prompt,    setPrompt]    = useState("");
  const [taskType,  setTaskType]  = useState(TASK_TYPE.MIXED);
  const [running,   setRunning]   = useState(false);
  const [run,       setRun]       = useState(null);
  const [history,   setHistory]   = useState([]);
  const [activeTab, setActiveTab] = useState("plan");
  const [steps,     setSteps]     = useState([]);
  const [logs,      setLogs]      = useState([]);
  const [logLoading,setLogLoading]= useState(false);

  const hasSession = !!sessionToken;

  // Load history on mount
  useEffect(() => { loadAllRuns().then(setHistory).catch(() => {}); }, []);

  // Single source of data loading for tabs
  useEffect(() => {
    if (!run) return;
    if (activeTab === "plan") {
      getStepsForRun(run.id)
        .then(s => setSteps(s.sort((a,b) => a.sequence - b.sequence)))
        .catch(() => {});
    }
    if (activeTab === "logs") {
      setLogLoading(true);
      getAuditEventsForRun(run.id)
        .then(evts => setLogs(evts.sort((a,b) => a.createdAt.localeCompare(b.createdAt))))
        .finally(() => setLogLoading(false))
        .catch(() => {});
    }
  }, [activeTab, run]);

  const onRunUpdate = useCallback((updater) => {
    setRun(prev => typeof updater === "function" ? updater(prev) : updater);
  }, []);

  // ── Token management ─────────────────────────────────────────────────
  const handleSaveToken = () => {
    const t = tokenInput.trim();
    if (!t) { setTokenError("Enter an access token."); return; }
    // Memory only — token is not written to localStorage or any persistent store.
    setSessionToken(t);
    setTokenInput("");
    setTokenError("");
  };

  const handleDisconnect = () => {
    // Clear from memory only — nothing to remove from storage.
    setSessionToken("");
    setTokenInput("");
    setTokenError("");
  };

  // Called when the proxy returns AUTH_ERROR (token revoked/changed server-side)
  const handleAuthError = () => {
    // Clear from memory only.
    setSessionToken("");
    setTokenError("Access token rejected by server. Please re-enter.");
  };

  // ── Run management ───────────────────────────────────────────────────
  const refreshHistory = () => loadAllRuns().then(setHistory).catch(() => {});
  const refreshSteps   = (r) => getStepsForRun(r.id)
    .then(s => setSteps(s.sort((a,b) => a.sequence - b.sequence))).catch(() => {});

  const handleCreateRun = async () => {
    if (!prompt.trim() || running) return;
    setRunning(true);
    setRun(null); setSteps([]); setLogs([]); setActiveTab("plan");
    const title = prompt.trim().slice(0, 80) + (prompt.length > 80 ? "…" : "");
    try {
      const finalRun = await startRun({
        title,
        prompt:       prompt.trim(),
        taskType,
        sessionToken: sessionToken || null,  // null → demo mode
        onRunUpdate,
      });
      // Detect auth errors surfaced from the proxy
      if (finalRun.state === "failed" && finalRun.latestError?.includes("AUTH_ERROR")) {
        handleAuthError();
      }
      refreshHistory();
      refreshSteps(finalRun);
    } finally {
      setRunning(false);
    }
  };

  const handleCancel = async () => {
    if (!run) return;
    await cancelRun(run.id, onRunUpdate).catch(() => {});
    setRunning(false);
    refreshHistory();
  };

  const handleApprove = async () => {
    if (!run) return;
    await approveRun(run.id, onRunUpdate).catch(() => {});
    refreshHistory();
  };

  const handleReject = async () => {
    if (!run) return;
    await rejectRun(run.id, onRunUpdate).catch(() => {});
    setRunning(false);
    refreshHistory();
  };

  const loadHistoryEntry = (h) => {
    setRun(h); setActiveTab("plan");
    getStepsForRun(h.id).then(s => setSteps(s.sort((a,b) => a.sequence - b.sequence))).catch(() => {});
  };

  return (
    <div>
      {/* Header */}
      <div style={{background:D.bk,padding:"14px 16px 18px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,right:0,width:44,height:44,background:D.yl}}/>
        <div style={{position:"absolute",top:44,right:0,width:44,height:26,background:D.rd}}/>
        <SLabel color={D.yl} style={{marginBottom:4,position:"relative",zIndex:1}}>AUTOMATION WORKSPACE</SLabel>
        <div style={{fontFamily:"'Unbounded',monospace",fontSize:16,fontWeight:900,
          color:D.white,position:"relative",zIndex:1,lineHeight:1.2}}>
          BUILD WITH<br/>CLAUDE
        </div>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:6,
          position:"relative",zIndex:1,lineHeight:1.6}}>
          Plan, run, review, deploy, and draft release content
        </p>
      </div>
      <AccentStrip/>

      <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>

        {/* ── Connection status / token setup ─────────────────────────── */}
        {hasSession ? (
          /* Connected state */
          <div style={{background:"#f0fdf4",border:`1.5px solid #86efac`,borderRadius:10,
            padding:"10px 12px",display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:"#16a34a",flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:600,color:"#166534"}}>
                Connected via server proxy
              </div>
              <div style={{fontSize:10,color:"#166534",opacity:0.7,marginTop:1}}>
                Anthropic API key is server-side only. Not accessible to the browser.
              </div>
            </div>
            <button onClick={handleDisconnect}
              style={{fontSize:9,color:"#166534",fontFamily:"'Unbounded',monospace",
                fontWeight:700,letterSpacing:".08em",opacity:0.6,flexShrink:0,
                padding:"3px 8px",border:`1px solid #86efac`,borderRadius:5}}>
              DISCONNECT
            </button>
          </div>
        ) : (
          /* Token setup */
          <Card accent={D.yl}>
            <div style={{padding:"14px"}}>
              <SLabel style={{marginBottom:6}}>Automation Access Token</SLabel>
              <p style={{fontSize:11,color:D.muted,lineHeight:1.65,marginBottom:10}}>
                Enter your access token to connect automation to the secure server proxy.
                The proxy holds the Anthropic API key — you don't need to provide it here.
                Without a token, the workspace runs in demo mode with simulated agents.
              </p>
              <div style={{display:"flex",gap:8}}>
                <input type="password" value={tokenInput}
                  onChange={e=>setTokenInput(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&handleSaveToken()}
                  placeholder="Paste your access token…"
                  style={{flex:1,background:D.bg,borderRadius:8,padding:"8px 10px",
                    fontSize:13,border:`1.5px solid ${tokenError?D.rd:D.border}`,
                    fontFamily:"'Plus Jakarta Sans',sans-serif"}}/>
                <button onClick={handleSaveToken}
                  style={{padding:"8px 14px",borderRadius:8,background:D.bk,color:D.yl,
                    fontFamily:"'Unbounded',monospace",fontSize:8,fontWeight:700,
                    letterSpacing:".1em",flexShrink:0}}>
                  CONNECT
                </button>
              </div>
              {tokenError && (
                <p style={{fontSize:11,color:D.rd,marginTop:6,fontWeight:600}}>{tokenError}</p>
              )}
              <p style={{fontSize:10,color:D.muted,marginTop:8,lineHeight:1.55}}>
                No token? You can still use demo mode below — agents return simulated results.
              </p>
            </div>
          </Card>
        )}

        {/* Demo mode notice (only when not connected) */}
        {!hasSession && (
          <div style={{background:"#fef3c7",border:`1.5px solid ${D.yl}`,borderRadius:10,
            padding:"9px 12px",fontSize:10,color:"#92400e",lineHeight:1.65}}>
            <strong>Demo mode active.</strong> Agents return simulated results.
            Connect an access token above for real runs via the server proxy.
          </div>
        )}

        {/* Request input */}
        <Card accent={D.bl}>
          <div style={{padding:"14px"}}>
            <SLabel style={{marginBottom:8}}>New Automation Request</SLabel>
            <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10}}>
              {Object.values(TASK_TYPE).map(t => (
                <button key={t} onClick={()=>setTaskType(t)}
                  style={{padding:"4px 10px",borderRadius:6,fontSize:9,fontWeight:700,
                    fontFamily:"'Unbounded',monospace",letterSpacing:".08em",
                    background:taskType===t?D.bk:"transparent",
                    color:taskType===t?D.yl:D.muted,
                    border:`1.5px solid ${taskType===t?D.bk:D.border}`,transition:"all .15s"}}>
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
            <textarea value={prompt} onChange={e=>setPrompt(e.target.value)}
              placeholder="Describe the feature, fix, deploy, or release work you want Claude to handle"
              rows={5}
              style={{width:"100%",fontSize:13,lineHeight:1.7,color:D.bk,
                background:D.bg,borderRadius:10,padding:"10px 12px",
                border:`1.5px solid ${D.border}`,
                fontFamily:"'Plus Jakarta Sans',sans-serif",boxSizing:"border-box"}}/>
            <p style={{fontSize:10,color:D.muted,marginTop:4,lineHeight:1.5}}>
              {prompt.length}/4000 · Screened for security before any agent runs
              {hasSession ? " · Calls route through server proxy" : " · Demo mode"}
            </p>
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <button onClick={handleCreateRun} disabled={running||!prompt.trim()}
                style={{flex:1,background:running||!prompt.trim()?"#333":D.bk,
                  color:running||!prompt.trim()?"#666":D.yl,
                  borderRadius:10,padding:"12px",fontFamily:"'Unbounded',monospace",
                  fontSize:9,fontWeight:700,letterSpacing:".1em",
                  display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                {running ? <><Spinner size={12} color={D.yl}/>RUNNING…</> : "CREATE RUN →"}
              </button>
              {running && (
                <button onClick={handleCancel}
                  style={{padding:"12px 14px",borderRadius:10,
                    border:`1.5px solid ${D.rd}`,color:D.rd,fontSize:9,
                    fontFamily:"'Unbounded',monospace",fontWeight:700,letterSpacing:".08em"}}>
                  STOP RUN
                </button>
              )}
            </div>
          </div>
        </Card>

        {/* Run status card */}
        {run ? (
          <RunStatusCard run={run} onApprove={handleApprove} onReject={handleReject}/>
        ) : !running && history.length === 0 ? (
          <EmptyState/>
        ) : null}

        {/* Plan / Logs tabs */}
        {run && (
          <Card>
            <div style={{display:"flex",borderBottom:`1px solid ${D.border}`,
              background:"#f7f6f2",padding:"0 6px"}}>
              {["plan","logs"].map(tab => (
                <button key={tab} onClick={()=>setActiveTab(tab)}
                  style={{padding:"10px 14px",fontSize:9,fontWeight:700,
                    fontFamily:"'Unbounded',monospace",letterSpacing:".1em",
                    color:activeTab===tab?D.bk:D.muted,
                    borderBottom:activeTab===tab?`2.5px solid ${D.bk}`:"2.5px solid transparent",
                    background:"transparent",textTransform:"uppercase"}}>
                  {tab}
                </button>
              ))}
              <div style={{marginLeft:"auto",padding:"10px 8px"}}>
                <span style={{fontSize:8,fontFamily:"'Unbounded',monospace",
                  color:D.muted,letterSpacing:".1em"}}>SLICE 1 · PLAN ONLY</span>
              </div>
            </div>
            {activeTab === "plan" && <PlanTab steps={steps} run={run}/>}
            {activeTab === "logs" && <LogsTab logs={logs} loading={logLoading}/>}
          </Card>
        )}

        {/* History */}
        {history.length > 0 && (
          <div>
            <SLabel style={{marginBottom:8,marginTop:4}}>Run History</SLabel>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {history.slice(0, 10).map(h => (
                <button key={h.id} onClick={()=>loadHistoryEntry(h)}
                  style={{background:D.white,borderRadius:10,padding:"10px 12px",
                    border:`1.5px solid ${D.border}`,textAlign:"left",cursor:"pointer",
                    display:"flex",alignItems:"center",gap:10,
                    boxShadow:`0 1px 6px ${D.shadow}`}}>
                  <div style={{width:8,height:8,borderRadius:2,flexShrink:0,
                    background:STATE_COLOR[h.state]||D.muted}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:D.bk,
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {h.summary || h.taskType}
                    </div>
                    <div style={{fontSize:10,color:D.muted,marginTop:1}}>
                      {STATE_LABEL[h.state]||h.state} · {fmtRelative(h.createdAt)}
                    </div>
                  </div>
                  {h.riskTier && h.riskTier !== "unknown" && (
                    <div style={{fontSize:8,fontFamily:"'Unbounded',monospace",fontWeight:700,
                      color:RISK_TIER_COLOR[h.riskTier],background:RISK_TIER_BG[h.riskTier],
                      padding:"2px 7px",borderRadius:4,flexShrink:0}}>
                      {RISK_TIER_LABEL[h.riskTier]}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Slice 2+ notice */}
        <div style={{background:D.white,border:`1.5px solid ${D.border}`,
          borderRadius:10,padding:"12px 14px"}}>
          <SLabel style={{marginBottom:8,color:D.muted}}>Slice 2+ (Not Yet Active)</SLabel>
          {[
            ["🔒","Sandbox execution","Requires isolated server container"],
            ["🐙","GitHub integration","Requires server-side token storage"],
            ["🚀","Deploy agents","Preview, staging, production"],
            ["📢","Marketing drafts","Draft-first with approval gates"],
            ["🔌","MCP connectors","Gateway required — Zero-Trust Phase 2"],
          ].map(([ico,label,note])=>(
            <div key={label} style={{display:"flex",gap:8,padding:"5px 0",
              borderBottom:`1px solid ${D.border}`}}>
              <span style={{flexShrink:0,fontSize:13}}>{ico}</span>
              <div>
                <div style={{fontSize:11,fontWeight:600,color:D.bk}}>{label}</div>
                <div style={{fontSize:10,color:D.muted}}>{note}</div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

// ── RunStatusCard ─────────────────────────────────────────────────────────
function RunStatusCard({ run, onApprove, onReject }) {
  const stateColor  = STATE_COLOR[run.state]  || D.muted;
  const stateLabel  = STATE_LABEL[run.state]  || run.state;
  const riskLabel   = RISK_TIER_LABEL[run.riskTier] || "—";
  const riskColor   = RISK_TIER_COLOR[run.riskTier] || D.muted;
  const riskBg      = RISK_TIER_BG[run.riskTier]    || "transparent";
  const agentLabel  = run.activeAgent ? AGENT_LABEL[run.activeAgent] : null;
  const isRunning   = !TERMINAL_STATES.has(run.state);
  const needsApproval = run.state === RUN_STATE.AWAITING_APPROVAL;

  return (
    <Card accent={stateColor}>
      <div style={{padding:"14px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
          marginBottom:12,gap:10}}>
          <SLabel>Run Status</SLabel>
          {run.riskTier && run.riskTier !== "unknown" && (
            <div style={{fontSize:8,fontFamily:"'Unbounded',monospace",fontWeight:700,
              color:riskColor,background:riskBg,padding:"3px 9px",borderRadius:4}}>
              {riskLabel}
            </div>
          )}
        </div>

        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <div style={{width:10,height:10,borderRadius:2,background:stateColor,flexShrink:0,
            animation:isRunning?"blink 1.4s step-start infinite":undefined}}/>
          <span style={{fontSize:13,fontWeight:700,color:D.bk}}>{stateLabel}</span>
          {agentLabel && <span style={{fontSize:10,color:D.muted,marginLeft:4}}>· {agentLabel}</span>}
        </div>

        {run.summary && (
          <p style={{fontSize:12,color:D.muted,lineHeight:1.65,marginBottom:8}}>{run.summary}</p>
        )}

        {run.latestError && (
          <div style={{background: needsApproval ? "#fef3c7" : "#fee2e2",
            borderRadius:8,padding:"8px 10px",marginBottom:8,fontSize:11,
            color: needsApproval ? "#92400e" : "#991b1b",lineHeight:1.6}}>
            {run.latestError}
          </div>
        )}

        {needsApproval && (
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <button onClick={onApprove}
              style={{flex:1,background:D.bl,color:"#fff",borderRadius:8,padding:"9px",
                fontFamily:"'Unbounded',monospace",fontSize:8,fontWeight:700,letterSpacing:".1em"}}>
              ✓ APPROVE
            </button>
            <button onClick={onReject}
              style={{flex:1,background:"transparent",color:D.rd,borderRadius:8,padding:"9px",
                border:`1.5px solid ${D.rd}`,fontFamily:"'Unbounded',monospace",
                fontSize:8,fontWeight:700,letterSpacing:".1em"}}>
              ✕ REJECT
            </button>
          </div>
        )}

        <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:8}}>
          {run.timestamps?.queuedAt    && <MetaChip label="QUEUED"    value={fmtTime(run.timestamps.queuedAt)}/>}
          {run.timestamps?.startedAt   && <MetaChip label="STARTED"   value={fmtTime(run.timestamps.startedAt)}/>}
          {run.timestamps?.completedAt && <MetaChip label="COMPLETED" value={fmtTime(run.timestamps.completedAt)}/>}
          {run.timestamps?.failedAt    && <MetaChip label="FAILED"    value={fmtTime(run.timestamps.failedAt)}/>}
          {run.timestamps?.cancelledAt && <MetaChip label="CANCELLED" value={fmtTime(run.timestamps.cancelledAt)}/>}
        </div>

        <div style={{marginTop:10,fontSize:9,color:"#ccc",fontFamily:"'Unbounded',monospace",
          letterSpacing:".06em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {run.id}
        </div>
      </div>
    </Card>
  );
}

// ── PlanTab ───────────────────────────────────────────────────────────────
const STEP_STATE_COLOR = {
  pending:"#9B9589", running:"#E8B84B", completed:"#166534", failed:"#C1121F", skipped:"#9B9589",
};
const STEP_STATE_ICON = {
  pending:"○", running:"◉", completed:"✓", failed:"✕", skipped:"—",
};

function PlanTab({ steps, run }) {
  const execSteps    = steps.filter(s => s.sequence < 10);
  const plannedSteps = steps.filter(s => s.sequence >= 10);
  const planOut      = run?.plannerOutput;

  if (!steps.length) {
    return (
      <div style={{padding:"24px 16px",textAlign:"center"}}>
        <div style={{fontSize:13,color:D.muted,lineHeight:1.7}}>
          {run?.state === "planning" || run?.state === "queued"
            ? "Planning in progress…" : "No plan steps yet."}
        </div>
      </div>
    );
  }

  return (
    <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
      {execSteps.length > 0 && (
        <div>
          <SLabel style={{marginBottom:8,color:D.muted}}>Execution Phase</SLabel>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {execSteps.map(step => (
              <div key={step.id}
                style={{display:"flex",gap:10,padding:"8px 10px",borderRadius:8,
                  background:D.bg,border:`1px solid ${D.border}`,alignItems:"center"}}>
                <div style={{width:22,height:22,borderRadius:4,flexShrink:0,
                  background:STEP_STATE_COLOR[step.state]||D.muted,
                  display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <span style={{fontSize:10,color:"#fff",fontWeight:700,lineHeight:1}}>
                    {STEP_STATE_ICON[step.state]||"?"}
                  </span>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,fontWeight:600,color:D.bk,marginBottom:1,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {step.summary || step.kind}
                  </div>
                  <div style={{fontSize:9,color:STEP_STATE_COLOR[step.state]||D.muted,
                    fontFamily:"'Unbounded',monospace",letterSpacing:".06em",fontWeight:700}}>
                    {step.state.toUpperCase()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {planOut && (
        <div style={{background:D.bg,borderRadius:10,padding:"12px 14px",
          border:`1px solid ${D.border}`}}>
          {planOut.objectives?.length > 0 && (
            <div style={{marginBottom:10}}>
              <SLabel style={{marginBottom:6,color:D.muted}}>Objectives</SLabel>
              {planOut.objectives.map((o,i) => (
                <div key={i} style={{display:"flex",gap:6,marginBottom:4,fontSize:12,color:D.bk,lineHeight:1.6}}>
                  <span style={{color:D.bl,flexShrink:0,fontWeight:700}}>{i+1}.</span>{o}
                </div>
              ))}
            </div>
          )}
          {planOut.riskSignals?.length > 0 && (
            <div>
              <SLabel style={{marginBottom:6,color:D.rd}}>Risk Signals</SLabel>
              {planOut.riskSignals.map((r,i) => (
                <div key={i} style={{display:"flex",gap:6,marginBottom:3,fontSize:11,color:"#92400e",lineHeight:1.55}}>
                  <span style={{flexShrink:0}}>⚠</span>{r}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {plannedSteps.length > 0 && (
        <div>
          <SLabel style={{marginBottom:8,color:D.muted}}>Planned Work (Slice 2+)</SLabel>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {plannedSteps.map(step => (
              <div key={step.id}
                style={{display:"flex",gap:10,padding:"8px 10px",borderRadius:8,
                  background:D.bg,border:`1px dashed ${D.border}`,alignItems:"center",opacity:0.7}}>
                <div style={{width:22,height:22,borderRadius:4,flexShrink:0,
                  background:"#e5e7eb",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <span style={{fontFamily:"'Unbounded',monospace",fontSize:8,
                    fontWeight:700,color:D.muted}}>{Math.floor(step.sequence/100)}</span>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,fontWeight:600,color:D.bk,marginBottom:1,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {step.summary || step.kind}
                  </div>
                  <div style={{fontSize:9,color:D.muted}}>
                    {AGENT_LABEL[step.kind] || step.kind} · pending
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p style={{fontSize:10,color:D.muted,marginTop:8,lineHeight:1.55}}>
            These steps execute in Slice 2 once sandbox and GitHub agents are live.
          </p>
        </div>
      )}
    </div>
  );
}

// ── LogsTab ───────────────────────────────────────────────────────────────
function LogsTab({ logs, loading }) {
  if (loading) {
    return (
      <div style={{padding:"24px 16px",display:"flex",justifyContent:"center"}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <div style={{width:12,height:12,border:`2px solid ${D.muted}33`,
            borderTopColor:D.muted,borderRadius:"50%",animation:"spin .7s linear infinite"}}/>
          <span style={{fontSize:11,color:D.muted}}>Loading logs…</span>
        </div>
      </div>
    );
  }
  if (!logs.length) {
    return (
      <div style={{padding:"24px 16px",textAlign:"center"}}>
        <span style={{fontSize:12,color:D.muted}}>No log events yet.</span>
      </div>
    );
  }
  const sc = { info:"#166534", warn:"#92400e", error:D.rd, critical:D.rd };
  return (
    <div style={{padding:"8px 0",maxHeight:320,overflowY:"auto"}}>
      {logs.map(evt => (
        <div key={evt.id}
          style={{display:"flex",gap:8,padding:"6px 14px",
            borderBottom:`1px solid ${D.border}`,alignItems:"flex-start"}}>
          <div style={{width:6,height:6,borderRadius:2,marginTop:4,flexShrink:0,
            background:sc[evt.severity]||D.muted}}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,color:D.bk,lineHeight:1.5,
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {evt.message}
            </div>
            <div style={{fontSize:9,color:D.muted,marginTop:1,fontFamily:"'Unbounded',monospace",
              letterSpacing:".06em"}}>
              {evt.eventType} · {fmtTime(evt.createdAt)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{padding:"32px 16px",textAlign:"center",
      border:`2px dashed ${D.border}`,borderRadius:D.r}}>
      <div style={{fontFamily:"'Unbounded',monospace",fontSize:10,fontWeight:700,
        color:D.bk,marginBottom:8,letterSpacing:".1em"}}>NO AUTOMATION RUNS YET</div>
      <p style={{fontSize:12,color:D.muted,lineHeight:1.7,maxWidth:280,margin:"0 auto"}}>
        Create a run to let Claude plan work, propose changes, validate them,
        and prepare deploy and release drafts.
      </p>
    </div>
  );
}

function MetaChip({ label, value }) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:1}}>
      <span style={{fontSize:7,fontFamily:"'Unbounded',monospace",letterSpacing:".12em",
        fontWeight:700,color:D.muted,textTransform:"uppercase"}}>{label}</span>
      <span style={{fontSize:10,color:D.bk}}>{value}</span>
    </div>
  );
}

function fmtTime(iso) {
  try { return new Date(iso).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"}); }
  catch { return iso; }
}
function fmtRelative(iso) {
  try {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1)  return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h/24)}d ago`;
  } catch { return ""; }
}
