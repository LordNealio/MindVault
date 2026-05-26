import { useState, useEffect, useRef, useCallback } from "react";
import { saveMindGameSession } from "./saveMindGameSession.js";

const G = {
  bg:"#0A0A0A", surf:"#141414", surf2:"#1C1C1E",
  border:"#2C2C2E", txt:"#FAFAF7", mut:"#9B9589",
  yl:"#E8B84B", rd:"#C1121F", gn:"#16a34a", pu:"#8B5CF6", r:14,
};

// 4 pads with distinct colors and symbols
const PADS = [
  { id:0, color:"#E8B84B", activeColor:"#FFD700", label:"★", darkText:true  },
  { id:1, color:"#4F6EF7", activeColor:"#7B97FF", label:"●", darkText:false },
  { id:2, color:"#C1121F", activeColor:"#FF3333", label:"◆", darkText:false },
  { id:3, color:"#16a34a", activeColor:"#22C55E", label:"▲", darkText:false },
];

const SHOW_MS = 600;   // how long each pad is lit
const GAP_MS  = 200;   // gap between pads
const PRE_MS  = 500;   // pause before showing sequence

// phase: idle | showing | input | correct | wrong | done
export function MemoryGame({ onDone }) {
  const [phase, setPhase]       = useState("idle");
  const [sequence, setSequence] = useState([]);
  const [userSeq, setUserSeq]   = useState([]);
  const [activePad, setActivePad] = useState(null);
  const [level, setLevel]       = useState(1);
  const [mistakes, setMistakes] = useState(0);
  const [savedSession, setSavedSession] = useState(null);

  const timersRef   = useRef([]);
  const phaseRef    = useRef("idle");
  const sequenceRef = useRef([]);
  const levelRef    = useRef(1);
  const startRef    = useRef(null);

  // Keep refs in sync
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { sequenceRef.current = sequence; }, [sequence]);
  useEffect(() => { levelRef.current = level; }, [level]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => () => clearTimers(), [clearTimers]);

  const addTimer = useCallback((fn, ms) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  // Show the current sequence to the player
  const showSequence = useCallback((seq) => {
    setPhase("showing");
    phaseRef.current = "showing";
    setActivePad(null);
    setUserSeq([]);

    let delay = PRE_MS;
    seq.forEach((padId, i) => {
      addTimer(() => setActivePad(padId), delay);
      delay += SHOW_MS;
      addTimer(() => setActivePad(null), delay);
      delay += GAP_MS;
    });
    // After sequence, switch to input phase
    addTimer(() => {
      setPhase("input");
      phaseRef.current = "input";
    }, delay + 200);
  }, [addTimer]);

  const startGame = useCallback(() => {
    clearTimers();
    startRef.current = Date.now();
    levelRef.current = 1;
    setLevel(1);
    setMistakes(0);
    setUserSeq([]);
    setSavedSession(null);
    const firstSeq = [Math.floor(Math.random() * 4)];
    setSequence(firstSeq);
    sequenceRef.current = firstSeq;
    showSequence(firstSeq);
  }, [clearTimers, showSequence]);

  const handlePadTap = useCallback((padId) => {
    if (phaseRef.current !== "input") return;

    const newUserSeq = [...userSeq, padId];
    const idx = newUserSeq.length - 1;

    // Flash the tapped pad briefly
    setActivePad(padId);
    addTimer(() => setActivePad(null), 200);

    if (newUserSeq[idx] !== sequenceRef.current[idx]) {
      // Wrong!
      clearTimers();
      setPhase("wrong");
      phaseRef.current = "wrong";

      const seq = sequenceRef.current;
      const lvl = levelRef.current;
      const dur = startRef.current ? Math.round((Date.now() - startRef.current) / 1000) : 0;
      const session = saveMindGameSession({
        gameType: "memory",
        score: lvl - 1,
        mistakes: 1,
        memorySpan: lvl - 1,
        sequenceLength: seq.length,
        durationSeconds: dur,
      });
      setSavedSession(session);
      return;
    }

    setUserSeq(newUserSeq);

    if (newUserSeq.length === sequenceRef.current.length) {
      // Correct full sequence!
      clearTimers();
      setPhase("correct");
      phaseRef.current = "correct";

      addTimer(() => {
        const nextLevel = levelRef.current + 1;
        levelRef.current = nextLevel;
        setLevel(nextLevel);
        setUserSeq([]);
        // Add one new random pad to sequence
        const nextSeq = [...sequenceRef.current, Math.floor(Math.random() * 4)];
        setSequence(nextSeq);
        sequenceRef.current = nextSeq;
        showSequence(nextSeq);
      }, 700);
    }
  }, [userSeq, clearTimers, addTimer, showSequence]);

  // ── IDLE ──────────────────────────────────────────────────
  if (phase === "idle") return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",
      justifyContent:"center",minHeight:440,gap:24,padding:"32px 20px",background:G.bg}}>
      <div style={{fontSize:56}}>🧠</div>
      <div style={{textAlign:"center"}}>
        <p style={{fontFamily:"'Unbounded',monospace",fontSize:12,fontWeight:700,
          color:G.txt,letterSpacing:".06em",marginBottom:10}}>MEMORY SEQUENCE</p>
        <p style={{fontSize:13,color:G.mut,lineHeight:1.65,maxWidth:300,margin:"0 auto 8px"}}>
          Watch the pads light up in sequence, then repeat the pattern back.
          Each round adds one more.
        </p>
        <p style={{fontSize:11,color:G.mut,lineHeight:1.5,maxWidth:300,margin:"0 auto"}}>
          Game ends when you make a mistake.
        </p>
      </div>
      <button onClick={startGame} style={{
        background:G.pu, color:G.txt, borderRadius:12, padding:"15px 40px",
        fontFamily:"'Unbounded',monospace",fontSize:11,fontWeight:700,letterSpacing:".12em",
      }}>
        START
      </button>
    </div>
  );

  // ── DONE (wrong) ──────────────────────────────────────────
  if (phase === "wrong") {
    const span = level - 1;
    return (
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",
        justifyContent:"center",minHeight:440,gap:20,padding:"32px 20px",background:G.bg}}>
        <div style={{fontSize:48}}>{span >= 8 ? "🏆" : span >= 5 ? "⭐" : "💪"}</div>
        <p style={{fontFamily:"'Unbounded',monospace",fontSize:11,fontWeight:700,
          color:G.txt,letterSpacing:".1em"}}>GAME OVER</p>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,width:"100%",maxWidth:300}}>
          {[
            {l:"MEMORY SPAN",v:span,c:G.pu},
            {l:"MAX LENGTH",v:sequence.length,c:G.yl},
          ].map(s=>(
            <div key={s.l} style={{background:G.surf,borderRadius:12,padding:"16px 10px",
              textAlign:"center",border:`1px solid ${G.border}`}}>
              <div style={{fontFamily:"'Unbounded',monospace",fontSize:28,fontWeight:700,
                color:s.c,marginBottom:4}}>{s.v}</div>
              <div style={{fontFamily:"'Unbounded',monospace",fontSize:6.5,
                letterSpacing:".1em",color:G.mut}}>{s.l}</div>
            </div>
          ))}
        </div>

        <div style={{display:"flex",gap:10,width:"100%",maxWidth:300}}>
          <button onClick={startGame} style={{
            flex:1, background:G.pu, color:G.txt, borderRadius:12, padding:"13px",
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
  const statusText =
    phase === "showing" ? "WATCH…" :
    phase === "input"   ? `YOUR TURN — ${userSeq.length}/${sequence.length}` :
    phase === "correct" ? "✓ CORRECT!" :
    "";
  const statusColor =
    phase === "correct" ? G.gn :
    phase === "input"   ? G.yl :
    G.mut;

  return (
    <div style={{display:"flex",flexDirection:"column",
      height:"100%",background:G.bg,userSelect:"none",WebkitUserSelect:"none"}}>

      {/* Header */}
      <div style={{padding:"12px 16px",background:G.surf,
        borderBottom:`1px solid ${G.border}`,
        display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontFamily:"'Unbounded',monospace",fontSize:9,
          fontWeight:700,color:G.yl}}>LEVEL {level}</span>
        <span style={{fontFamily:"'Unbounded',monospace",fontSize:8,
          color:statusColor,letterSpacing:".08em"}}>{statusText}</span>
        <span style={{fontFamily:"'Unbounded',monospace",fontSize:8,
          color:G.mut}}>{sequence.length} LONG</span>
      </div>

      {/* Pads */}
      <div style={{flex:1,display:"flex",alignItems:"center",
        justifyContent:"center",padding:"20px"}}>
        <div style={{
          display:"grid",gridTemplateColumns:"1fr 1fr",
          gap:14,width:"100%",maxWidth:300,
        }}>
          {PADS.map(pad => {
            const isActive = activePad === pad.id;
            const tapIdx = userSeq.indexOf(pad.id);
            return (
              <button
                key={pad.id}
                onPointerDown={() => handlePadTap(pad.id)}
                disabled={phase !== "input"}
                style={{
                  aspectRatio:"1",
                  borderRadius:20,
                  background: isActive ? pad.activeColor : pad.color + "55",
                  border: `3px solid ${isActive ? pad.activeColor : pad.color}`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:36,
                  color: isActive ? (pad.darkText ? "#000" : "#fff") : pad.color,
                  transition:"background .1s, border-color .1s",
                  cursor: phase === "input" ? "pointer" : "default",
                  boxShadow: isActive ? `0 0 24px ${pad.color}66` : "none",
                  WebkitTapHighlightColor:"transparent",
                }}
              >
                {pad.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Progress dots */}
      <div style={{padding:"12px 20px 20px",display:"flex",
        justifyContent:"center",gap:8}}>
        {sequence.map((_,i)=>(
          <div key={i} style={{
            width:8,height:8,borderRadius:"50%",
            background: i < userSeq.length ? G.gn : G.border,
            transition:"background .15s",
          }}/>
        ))}
      </div>
    </div>
  );
}
