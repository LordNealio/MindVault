import { useState, useEffect } from "react";

// ── Design tokens ─────────────────────────────────────────
const D = {
  bg:"#F0EDE5", surf:"#FAFAF7", bk:"#0A0A0A",
  border:"#E8E4DA", muted:"#9B9589",
};

// ── Phase definitions ─────────────────────────────────────
const PHASES = [
  { label:"INHALE",  color:"#E8B84B", sub:"breathe in slowly"   },
  { label:"HOLD",    color:"#5B8AF0", sub:"hold"                 },
  { label:"EXHALE",  color:"#3DD68C", sub:"breathe out slowly"   },
  { label:"HOLD",    color:"#9B9589", sub:"hold"                 },
];

const BOX = 190;  // square side in px
const DOT = 16;   // dot diameter

// Returns [x, y] of dot center — clockwise from top-left corner
function dotXY(p) {
  const s = BOX;
  if (p < 0.25) return [p * 4 * s, 0];             // top:   L→R  (inhale)
  if (p < 0.5)  return [s, (p - .25) * 4 * s];     // right: T→B  (hold)
  if (p < 0.75) return [s - (p - .5) * 4 * s, s];  // bottom:R→L  (exhale)
  return             [0, s - (p - .75) * 4 * s];    // left:  B→T  (hold)
}

export function BoxBreathing({ onClose }) {
  const [secsPer, setSecsPer] = useState(4);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);    // decimal seconds, 1dp
  const [rounds,  setRounds]  = useState(0);

  const cycleLen    = secsPer * 4;
  const cyc         = elapsed % cycleLen;
  const phaseIdx    = Math.min(3, Math.floor(cyc / secsPer));
  const phaseRem    = Math.max(1, Math.ceil(secsPer - (cyc % secsPer)));
  const progress    = cyc / cycleLen;
  const phase       = PHASES[phaseIdx];
  const [dx, dy]    = dotXY(progress);
  const started     = elapsed > 0;
  const dotColor    = started ? phase.color : D.border;

  // Tick every 100 ms while running
  useEffect(() => {
    if (!running) return;
    const id = setInterval(
      () => setElapsed(e => +(e + 0.1).toFixed(1)),
      100
    );
    return () => clearInterval(id);
  }, [running]);

  // Round counter
  useEffect(() => {
    setRounds(Math.floor(elapsed / cycleLen));
  }, [elapsed, cycleLen]);

  const reset = () => { setRunning(false); setElapsed(0); setRounds(0); };

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:650,
      background:D.bg,
      display:"flex", flexDirection:"column",
    }}>

      {/* ── Header ──────────────────────────────────────── */}
      <div style={{display:"flex",alignItems:"center",
        justifyContent:"space-between",padding:"20px 20px 0"}}>
        <div>
          <div style={{fontFamily:"'Unbounded',monospace",fontSize:9,
            fontWeight:700,letterSpacing:".14em",color:D.muted}}>
            BOX BREATHING
          </div>
          <div style={{fontSize:10,color:D.muted,marginTop:3}}>
            {rounds > 0
              ? `${rounds} round${rounds !== 1 ? "s" : ""} completed`
              : `${secsPer}-${secsPer}-${secsPer}-${secsPer} pattern`}
          </div>
        </div>
        <button onClick={onClose} style={{width:32,height:32,borderRadius:"50%",
          background:"rgba(0,0,0,.07)",border:"none",fontSize:18,
          cursor:"pointer",color:D.muted,display:"flex",
          alignItems:"center",justifyContent:"center",lineHeight:1}}>
          ×
        </button>
      </div>

      {/* ── Main ────────────────────────────────────────── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",
        alignItems:"center",justifyContent:"center",gap:36,padding:24}}>

        {/* Phase label */}
        <div style={{textAlign:"center",minHeight:54}}>
          <div style={{fontFamily:"'Unbounded',monospace",fontSize:26,
            fontWeight:900,letterSpacing:".04em",lineHeight:1,
            color:dotColor,transition:"color .5s ease"}}>
            {running ? phase.label : started ? "PAUSED" : "READY"}
          </div>
          <div style={{fontSize:12,color:D.muted,marginTop:8,lineHeight:1.5}}>
            {running
              ? phase.sub
              : started
              ? "tap resume to continue"
              : "inhale · hold · exhale · hold"}
          </div>
        </div>

        {/* Square */}
        <div style={{position:"relative",width:BOX,height:BOX,flexShrink:0}}>
          {/* Box outline */}
          <div style={{
            position:"absolute",inset:0,borderRadius:14,
            border:`2.5px solid ${started ? dotColor+"55" : D.border}`,
            background:started ? `${dotColor}0D` : "transparent",
            transition:"border-color .5s, background .5s",
          }}/>

          {/* Moving dot */}
          <div style={{
            position:"absolute",
            width:DOT,height:DOT,borderRadius:"50%",
            background:dotColor,
            boxShadow:started ? `0 0 16px ${dotColor}99` : "none",
            left:dx - DOT / 2,
            top:dy  - DOT / 2,
            transition:"left .1s linear, top .1s linear, background .5s, box-shadow .5s",
          }}/>

          {/* Countdown */}
          <div style={{position:"absolute",inset:0,display:"flex",
            alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
            <div style={{fontFamily:"'Unbounded',monospace",fontWeight:900,lineHeight:1,
              fontSize:running ? 60 : 40,
              color:started ? dotColor : D.border,
              transition:"color .5s, font-size .12s"}}>
              {running ? phaseRem : started ? "▶" : secsPer}
            </div>
          </div>
        </div>

        {/* Counts-per-phase selector — only before first start */}
        {!started && (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
            <div style={{fontFamily:"'Unbounded',monospace",fontSize:7,fontWeight:700,
              letterSpacing:".12em",color:D.muted}}>COUNTS PER PHASE</div>
            <div style={{display:"flex",gap:8}}>
              {[3, 4, 5, 6, 8].map(s => (
                <button key={s} onClick={() => setSecsPer(s)} style={{
                  width:38,height:38,borderRadius:10,cursor:"pointer",
                  border:`2px solid ${secsPer === s ? D.bk : D.border}`,
                  background:secsPer === s ? D.bk : "transparent",
                  color:secsPer === s ? "#fff" : D.muted,
                  fontFamily:"'Unbounded',monospace",fontSize:12,fontWeight:700,
                  transition:"all .15s",
                }}>{s}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Controls ────────────────────────────────────── */}
      <div style={{padding:"0 20px 44px",display:"flex",gap:10}}>
        <button onClick={() => setRunning(r => !r)} style={{
          flex:1,padding:"16px",borderRadius:14,border:"none",
          background:D.bk,color:"#fff",cursor:"pointer",
          fontFamily:"'Unbounded',monospace",fontSize:10,
          fontWeight:700,letterSpacing:".08em",
          transition:"opacity .15s",
        }}>
          {running ? "⏸ PAUSE" : started ? "▶ RESUME" : "▶ START"}
        </button>
        {started && (
          <button onClick={reset} style={{
            padding:"16px 20px",borderRadius:14,
            border:`1.5px solid ${D.border}`,background:"transparent",
            fontSize:11,color:D.muted,cursor:"pointer",
          }}>
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
