import { useState, useCallback, useMemo } from "react";
import { PATTERNS } from "./mindGamesData.js";
import { saveMindGameSession } from "./saveMindGameSession.js";

const G = {
  bg:"#0A0A0A", surf:"#141414", surf2:"#1C1C1E",
  border:"#2C2C2E", txt:"#FAFAF7", mut:"#9B9589",
  yl:"#E8B84B", rd:"#C1121F", gn:"#16a34a", teal:"#22C55E", r:14,
};

const QUESTIONS_PER_GAME = 10;

// Fisher-Yates shuffle (pure, no mutation of original)
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// phase: idle | question | answered | done
export function PatternGame({ onDone }) {
  const [phase, setPhase] = useState("idle");
  const [questions, setQuestions] = useState([]);
  const [qIdx, setQIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [selected, setSelected] = useState(null); // index of chosen answer
  const [savedSession, setSavedSession] = useState(null);
  const startTimeRef = { current: null };

  const startGame = useCallback(() => {
    const qs = shuffle(PATTERNS).slice(0, QUESTIONS_PER_GAME);
    startTimeRef.current = Date.now();
    setQuestions(qs);
    setQIdx(0);
    setScore(0);
    setMistakes(0);
    setSelected(null);
    setSavedSession(null);
    setPhase("question");
  }, []);

  const handleAnswer = useCallback((choiceIdx) => {
    if (phase !== "question") return;
    const q = questions[qIdx];
    const chosen = q.choices[choiceIdx];
    const isCorrect = chosen === q.answer;

    setSelected(choiceIdx);
    if (isCorrect) setScore(s => s + 1);
    else setMistakes(m => m + 1);
    setPhase("answered");
  }, [phase, questions, qIdx]);

  const handleNext = useCallback(() => {
    const nextIdx = qIdx + 1;
    if (nextIdx >= QUESTIONS_PER_GAME) {
      setPhase("done");
      const dur = startTimeRef.current
        ? Math.round((Date.now() - startTimeRef.current) / 1000)
        : 0;
      const finalScore = score + (selected != null && questions[qIdx].choices[selected] === questions[qIdx].answer ? 0 : 0); // score already updated
      const s = score; // captured value
      const accuracy = Math.round((s / QUESTIONS_PER_GAME) * 100);
      const session = saveMindGameSession({
        gameType: "pattern",
        score: s,
        accuracy,
        mistakes,
        durationSeconds: dur,
        difficultyLevel: Math.round(s / 3),
      });
      setSavedSession(session);
    } else {
      setQIdx(nextIdx);
      setSelected(null);
      setPhase("question");
    }
  }, [qIdx, score, mistakes, questions, selected]);

  // ── IDLE ──────────────────────────────────────────────────
  if (phase === "idle") return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",
      justifyContent:"center",minHeight:440,gap:24,padding:"32px 20px",background:G.bg}}>
      <div style={{fontSize:56}}>🔷</div>
      <div style={{textAlign:"center"}}>
        <p style={{fontFamily:"'Unbounded',monospace",fontSize:12,fontWeight:700,
          color:G.txt,letterSpacing:".06em",marginBottom:10}}>PATTERN LOGIC</p>
        <p style={{fontSize:13,color:G.mut,lineHeight:1.65,maxWidth:300,margin:"0 auto 8px"}}>
          Each sequence follows a rule. Figure out the rule.
          Pick what comes next from 4 options.
        </p>
        <p style={{fontSize:11,color:G.mut,lineHeight:1.5,maxWidth:300,margin:"0 auto"}}>
          {QUESTIONS_PER_GAME} questions per round.
        </p>
      </div>
      <button onClick={startGame} style={{
        background:G.teal, color:"#000", borderRadius:12, padding:"15px 40px",
        fontFamily:"'Unbounded',monospace",fontSize:11,fontWeight:700,letterSpacing:".12em",
      }}>
        START
      </button>
    </div>
  );

  // ── DONE ──────────────────────────────────────────────────
  if (phase === "done") {
    const accuracy = Math.round((score / QUESTIONS_PER_GAME) * 100);
    return (
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",
        justifyContent:"center",minHeight:440,gap:20,padding:"32px 20px",background:G.bg}}>
        <div style={{fontSize:48}}>
          {accuracy >= 90 ? "🏆" : accuracy >= 70 ? "⭐" : "💪"}
        </div>
        <p style={{fontFamily:"'Unbounded',monospace",fontSize:11,fontWeight:700,
          color:G.txt,letterSpacing:".1em"}}>SESSION COMPLETE</p>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,
          width:"100%",maxWidth:320}}>
          {[
            {l:"SCORE",v:`${score}/${QUESTIONS_PER_GAME}`,c:G.yl},
            {l:"ACCURACY",v:`${accuracy}%`,c:accuracy>=80?G.gn:accuracy>=60?G.yl:G.rd},
            {l:"CORRECT",v:score,c:G.gn},
            {l:"WRONG",v:mistakes,c:mistakes>0?G.rd:G.gn},
          ].map(s=>(
            <div key={s.l} style={{background:G.surf,borderRadius:12,padding:"14px 10px",
              textAlign:"center",border:`1px solid ${G.border}`}}>
              <div style={{fontFamily:"'Unbounded',monospace",fontSize:22,fontWeight:700,
                color:s.c,marginBottom:4}}>{s.v}</div>
              <div style={{fontFamily:"'Unbounded',monospace",fontSize:6.5,
                letterSpacing:".1em",color:G.mut}}>{s.l}</div>
            </div>
          ))}
        </div>

        <div style={{display:"flex",gap:10,width:"100%",maxWidth:320}}>
          <button onClick={startGame} style={{
            flex:1, background:G.teal, color:"#000", borderRadius:12, padding:"13px",
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

  // ── QUESTION / ANSWERED ───────────────────────────────────
  const q = questions[qIdx];
  if (!q) return null;

  return (
    <div style={{display:"flex",flexDirection:"column",
      height:"100%",background:G.bg,userSelect:"none",WebkitUserSelect:"none"}}>

      {/* Header */}
      <div style={{padding:"12px 16px",background:G.surf,
        borderBottom:`1px solid ${G.border}`,
        display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontFamily:"'Unbounded',monospace",fontSize:8,
          color:G.mut,letterSpacing:".08em"}}>
          {qIdx + 1} / {QUESTIONS_PER_GAME}
        </span>
        {/* Progress bar */}
        <div style={{flex:1,margin:"0 14px",height:4,
          background:G.surf2,borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",background:G.teal,
            width:`${((qIdx) / QUESTIONS_PER_GAME) * 100}%`,
            transition:"width .3s ease",borderRadius:2}}/>
        </div>
        <span style={{fontFamily:"'Unbounded',monospace",fontSize:9,
          fontWeight:700,color:G.yl}}>{score} pts</span>
      </div>

      <div style={{flex:1,display:"flex",flexDirection:"column",
        padding:"20px 16px",gap:24,overflowY:"auto"}}>

        {/* Sequence display */}
        <div style={{background:G.surf,borderRadius:16,padding:"20px 16px",
          border:`1.5px solid ${G.border}`}}>
          <p style={{fontFamily:"'Unbounded',monospace",fontSize:7,
            color:G.mut,letterSpacing:".12em",marginBottom:14}}>WHAT COMES NEXT?</p>
          <div style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:8,
            justifyContent:"center"}}>
            {q.seq.map((n,i) => (
              <div key={i} style={{
                minWidth:44, height:44, borderRadius:10,
                background:G.surf2, border:`1.5px solid ${G.border}`,
                display:"flex",alignItems:"center",justifyContent:"center",
              }}>
                <span style={{fontFamily:"'Unbounded',monospace",fontSize:16,
                  fontWeight:700,color:G.txt}}>{n}</span>
              </div>
            ))}
            {/* The "?" box */}
            <div style={{
              minWidth:44, height:44, borderRadius:10,
              background: phase === "answered" ? G.teal + "33" : G.yl + "22",
              border:`2px solid ${phase === "answered" ? G.teal : G.yl}`,
              display:"flex",alignItems:"center",justifyContent:"center",
            }}>
              <span style={{fontFamily:"'Unbounded',monospace",fontSize:18,
                fontWeight:700, color: phase === "answered" ? G.teal : G.yl}}>
                {phase === "answered" ? q.answer : "?"}
              </span>
            </div>
          </div>
        </div>

        {/* Choices */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {q.choices.map((choice, idx) => {
            const isSelected  = selected === idx;
            const isCorrect   = choice === q.answer;
            const revealed    = phase === "answered";

            let bg = G.surf;
            let border = G.border;
            let textColor = G.txt;
            if (revealed && isCorrect) {
              bg = G.gn + "22"; border = G.gn; textColor = G.gn;
            } else if (revealed && isSelected && !isCorrect) {
              bg = G.rd + "22"; border = G.rd; textColor = G.rd;
            }

            return (
              <button
                key={idx}
                onClick={() => handleAnswer(idx)}
                disabled={phase === "answered"}
                style={{
                  background:bg, border:`2px solid ${border}`,
                  borderRadius:12, padding:"16px 10px",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  cursor: phase === "question" ? "pointer" : "default",
                  transition:"background .15s, border-color .15s",
                  WebkitTapHighlightColor:"transparent",
                }}
              >
                <span style={{fontFamily:"'Unbounded',monospace",fontSize:18,
                  fontWeight:700,color:textColor}}>{choice}</span>
              </button>
            );
          })}
        </div>

        {/* Hint + feedback */}
        {phase === "answered" && (
          <div style={{textAlign:"center"}}>
            <p style={{fontFamily:"'Unbounded',monospace",fontSize:8,
              color:G.mut,letterSpacing:".1em",marginBottom:4}}>
              PATTERN: {q.hint.toUpperCase()}
            </p>
          </div>
        )}
      </div>

      {/* Next button */}
      {phase === "answered" && (
        <div style={{padding:"12px 16px 20px"}}>
          <button onClick={handleNext} style={{
            width:"100%", borderRadius:12, padding:"14px",
            fontFamily:"'Unbounded',monospace",fontSize:10,fontWeight:700,
            letterSpacing:".12em",
            background: questions[qIdx].choices[selected] === q.answer ? G.gn : G.rd,
            color:"#fff",
          }}>
            {questions[qIdx].choices[selected] === q.answer
              ? (qIdx + 1 >= QUESTIONS_PER_GAME ? "FINISH →" : "NEXT →")
              : (qIdx + 1 >= QUESTIONS_PER_GAME ? "FINISH →" : "NEXT →")}
          </button>
        </div>
      )}
    </div>
  );
}
