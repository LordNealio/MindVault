import { useState, useRef, useEffect, useCallback } from "react";
import { saveMindGameSession } from "./saveMindGameSession.js";

const G = {
  bg:"#0A0A0A", surf:"#141414", surf2:"#1C1C1E",
  border:"#2C2C2E", txt:"#FAFAF7", mut:"#9B9589",
  yl:"#E8B84B", rd:"#C1121F", gn:"#16a34a", bl:"#4F6EF7", r:14,
};

const TOTAL_ROUNDS = 5;
const MIN_WAIT_MS = 1500;
const MAX_WAIT_MS = 4500;

// phase: idle | countdown | wait | ready | result | done
export function ReactionGame({ onDone }) {
  const [phase, setPhase] = useState("idle");
  const [round, setRound] = useState(1);
  const [roundTimes, setRoundTimes] = useState([]); // ms per round
  const [falseStarts, setFalseStarts] = useState(0);
  const [lastTime, setLastTime] = useState(null);
  const [falseStart, setFalseStart] = useState(false);
  const [savedSession, setSavedSession] = useState(null);

  const waitTimerRef = useRef(null);
  const readyTimeRef = useRef(null); // Date.now() when "ready" phase started
  const falseStartsRef = useRef(0);
  const roundTimesRef = useRef([]);

  // Cleanup timers on unmount
  useEffect(() => () => clearTimeout(waitTimerRef.current), []);

  // Keep refs in sync
  useEffect(() => { falseStartsRef.current = falseStarts; }, [falseStarts]);
  useEffect(() => { roundTimesRef.current = roundTimes; }, [roundTimes]);

  const startWait = useCallback(() => {
    setPhase("wait");
    setFalseStart(false);
    const delay = MIN_WAIT_MS + Math.random() * (MAX_WAIT_MS - MIN_WAIT_MS);
    waitTimerRef.current = setTimeout(() => {
      readyTimeRef.current = Date.now();
      setPhase("ready");
    }, delay);
  }, []);

  const handleTap = useCallback(() => {
    if (phase === "wait") {
      // False start
      clearTimeout(waitTimerRef.current);
      setFalseStart(true);
      setFalseStarts(f => f + 1);
      setPhase("result");
      return;
    }

    if (phase === "ready") {
      const reactionMs = Date.now() - readyTimeRef.current;
      setLastTime(reactionMs);
      const newTimes = [...roundTimesRef.current, reactionMs];
      setRoundTimes(newTimes);
      roundTimesRef.current = newTimes;
      setPhase("result");
      return;
    }
  }, [phase]);

  const nextRound = useCallback(() => {
    const next = round + 1;
    if (next > TOTAL_ROUNDS) {
      // End game
      const times = roundTimesRef.current;
      const validTimes = times.filter(Boolean);
      const avg = validTimes.length
        ? Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length)
        : 0;
      const best = validTimes.length ? Math.min(...validTimes) : 0;
      const score = Math.max(0, Math.round(1000 - avg / 2)); // score based on speed
      setPhase("done");
      const session = saveMindGameSession({
        gameType: "reaction",
        score,
        averageReactionMs: avg,
        bestReactionMs: best,
        falseStarts: falseStartsRef.current,
        durationSeconds: TOTAL_ROUNDS * 3,
        streak: validTimes.length,
      });
      setSavedSession(session);
    } else {
      setRound(next);
      startWait();
    }
  }, [round, startWait]);

  const reset = () => {
    clearTimeout(waitTimerRef.current);
    setPhase("idle");
    setRound(1);
    setRoundTimes([]);
    setFalseStarts(0);
    setLastTime(null);
    setFalseStart(false);
    falseStartsRef.current = 0;
    roundTimesRef.current = [];
    setSavedSession(null);
  };

  // ── IDLE ──────────────────────────────────────────────────
  if (phase === "idle") return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",
      justifyContent:"center",minHeight:440,gap:24,padding:"32px 20px",background:G.bg}}>
      <div style={{fontSize:56}}>⚡</div>
      <div style={{textAlign:"center"}}>
        <p style={{fontFamily:"'Unbounded',monospace",fontSize:12,fontWeight:700,
          color:G.txt,letterSpacing:".06em",marginBottom:10}}>REACTION SPEED</p>
        <p style={{fontSize:13,color:G.mut,lineHeight:1.65,maxWidth:300,margin:"0 auto 8px"}}>
          Wait for the screen to turn <strong style={{color:G.gn}}>green</strong>, then tap as fast as you can.
        </p>
        <p style={{fontSize:11,color:G.mut,lineHeight:1.5,maxWidth:300,margin:"0 auto"}}>
          {TOTAL_ROUNDS} rounds. Tapping early counts as a false start.
        </p>
      </div>
      <button onClick={startWait} style={{
        background:G.bl, color:G.txt, borderRadius:12, padding:"15px 40px",
        fontFamily:"'Unbounded',monospace",fontSize:11,fontWeight:700,letterSpacing:".12em",
      }}>
        START
      </button>
    </div>
  );

  // ── DONE ──────────────────────────────────────────────────
  if (phase === "done") {
    const validTimes = roundTimesRef.current.filter(Boolean);
    const avg = validTimes.length
      ? Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length)
      : 0;
    const best = validTimes.length ? Math.min(...validTimes) : 0;
    const score = Math.max(0, Math.round(1000 - avg / 2));
    const label = avg < 200 ? "Elite" : avg < 300 ? "Fast" : avg < 450 ? "Average" : "Keep training";

    return (
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",
        justifyContent:"center",minHeight:440,gap:20,padding:"32px 20px",background:G.bg}}>
        <div style={{fontSize:48}}>
          {avg < 250 ? "🏆" : avg < 400 ? "⭐" : "💪"}
        </div>
        <p style={{fontFamily:"'Unbounded',monospace",fontSize:11,fontWeight:700,
          color:G.txt,letterSpacing:".1em"}}>SESSION COMPLETE</p>
        <p style={{fontFamily:"'Unbounded',monospace",fontSize:9,color:G.bl,letterSpacing:".08em"}}>
          {label.toUpperCase()}
        </p>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,width:"100%",maxWidth:320}}>
          {[
            {l:"SCORE",v:score,c:G.yl},
            {l:"AVG TIME",v:`${avg}ms`,c:G.bl},
            {l:"BEST TIME",v:`${best}ms`,c:G.gn},
            {l:"FALSE STARTS",v:falseStarts,c:falseStarts>0?G.rd:G.gn},
          ].map(s=>(
            <div key={s.l} style={{background:G.surf,borderRadius:12,padding:"14px 10px",
              textAlign:"center",border:`1px solid ${G.border}`}}>
              <div style={{fontFamily:"'Unbounded',monospace",fontSize:20,fontWeight:700,
                color:s.c,marginBottom:4}}>{s.v}</div>
              <div style={{fontFamily:"'Unbounded',monospace",fontSize:6.5,
                letterSpacing:".1em",color:G.mut}}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Per-round breakdown */}
        <div style={{width:"100%",maxWidth:320,background:G.surf,
          borderRadius:12,padding:"12px 14px",border:`1px solid ${G.border}`}}>
          <p style={{fontFamily:"'Unbounded',monospace",fontSize:7,
            color:G.mut,letterSpacing:".1em",marginBottom:8}}>ROUND BREAKDOWN</p>
          {Array.from({length:TOTAL_ROUNDS},(_, i)=>{
            const t = roundTimesRef.current[i];
            return (
              <div key={i} style={{display:"flex",justifyContent:"space-between",
                alignItems:"center",padding:"4px 0",
                borderTop: i > 0 ? `1px solid ${G.border}` : "none"}}>
                <span style={{fontFamily:"'Unbounded',monospace",
                  fontSize:8,color:G.mut}}>RD {i+1}</span>
                <span style={{fontFamily:"'Unbounded',monospace",fontSize:9,
                  fontWeight:700,
                  color: !t ? G.rd : t < 250 ? G.gn : t < 400 ? G.yl : G.txt}}>
                  {t ? `${t}ms` : "FALSE START"}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{display:"flex",gap:10,width:"100%",maxWidth:320}}>
          <button onClick={reset} style={{
            flex:1, background:G.bl, color:G.txt, borderRadius:12, padding:"13px",
            fontFamily:"'Unbounded',monospace",fontSize:9,fontWeight:700,letterSpacing:".1em",
          }}>
            PLAY AGAIN
          </button>
          <button onClick={onDone} style={{
            flex:1, background:G.surf, color:G.mut, borderRadius:12, padding:"13px",
            border:`1.5px solid ${G.border}`,
            fontFamily:"'Unbounded',monospace",fontSize:9,fontWeight:700,letterSpacing:".1em",
          }}>
            DONE
          </button>
        </div>
        {savedSession && <p style={{fontSize:10,color:G.mut}}>✓ Session saved</p>}
      </div>
    );
  }

  // ── PLAYING ───────────────────────────────────────────────
  const bgColor = phase === "ready" ? G.gn : phase === "result" && falseStart ? G.rd : G.surf2;
  const mainText =
    phase === "wait" ? "WAIT…" :
    phase === "ready" ? "TAP NOW!" :
    phase === "result" ? (falseStart ? "FALSE START" : `${lastTime}ms`) :
    "";
  const subText =
    phase === "wait" ? "Don't tap yet" :
    phase === "ready" ? "" :
    phase === "result" ? (falseStart ? "Too early! Try again." : lastTime < 200 ? "Lightning fast!" : lastTime < 350 ? "Quick!" : "Not bad!") :
    "";

  return (
    <div style={{display:"flex",flexDirection:"column",
      height:"100%",background:G.bg,userSelect:"none",WebkitUserSelect:"none"}}>

      {/* Progress */}
      <div style={{padding:"10px 16px",background:G.surf,
        borderBottom:`1px solid ${G.border}`,
        display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontFamily:"'Unbounded',monospace",fontSize:8,
          color:G.mut,letterSpacing:".08em"}}>
          ROUND {round} OF {TOTAL_ROUNDS}
        </span>
        <div style={{display:"flex",gap:6}}>
          {Array.from({length:TOTAL_ROUNDS},(_,i)=>(
            <div key={i} style={{
              width:8,height:8,borderRadius:"50%",
              background: i < roundTimesRef.current.length
                ? G.gn
                : i === round - 1 ? G.yl : G.border,
            }}/>
          ))}
        </div>
        {falseStarts > 0 && (
          <span style={{fontFamily:"'Unbounded',monospace",fontSize:8,
            color:G.rd}}>⚠ {falseStarts}</span>
        )}
      </div>

      {/* Main tap area */}
      <button
        onPointerDown={handleTap}
        disabled={phase === "result"}
        style={{
          flex:1, display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", gap:12,
          background: bgColor,
          transition:"background .15s",
          border:"none", cursor:"pointer",
          WebkitTapHighlightColor:"transparent",
          padding:20,
        }}
      >
        <div style={{
          fontFamily:"'Unbounded',monospace", fontSize:28, fontWeight:900,
          color: phase === "ready" ? "#000" : G.txt,
          letterSpacing:".06em", textAlign:"center",
        }}>
          {mainText}
        </div>
        {subText && (
          <div style={{
            fontFamily:"'Unbounded',monospace", fontSize:9,
            color: phase === "ready" ? "rgba(0,0,0,0.6)" : G.mut,
            letterSpacing:".1em",
          }}>
            {subText.toUpperCase()}
          </div>
        )}
      </button>

      {/* Next / done button shown after result */}
      {phase === "result" && (
        <div style={{padding:"16px"}}>
          <button onClick={nextRound} style={{
            width:"100%", background:G.yl, color:"#000",
            borderRadius:12, padding:"14px",
            fontFamily:"'Unbounded',monospace",fontSize:10,fontWeight:700,
            letterSpacing:".12em",
          }}>
            {round >= TOTAL_ROUNDS ? "SEE RESULTS →" : `NEXT ROUND (${round + 1}/${TOTAL_ROUNDS}) →`}
          </button>
        </div>
      )}
    </div>
  );
}
