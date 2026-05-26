import { useState, useEffect, useRef, useCallback } from "react";
import { saveMindGameSession, loadMindGameSessions } from "./saveMindGameSession.js";

// ── Design tokens ─────────────────────────────────────────
const G = {
  bg:"#0A0A0A", surf:"#111113", surf2:"#1C1C20",
  border:"#28282E", txt:"#F2F0EB", mut:"#6E6A72",
  yl:"#E8B84B", rd:"#FF5555", gn:"#3DD68C",
  bl:"#5B8AF0", pu:"#9B72F0", coral:"#FF7B6B",
  r:16,
};

// ── Arrow constants ───────────────────────────────────────
const DIRS = ["left","right","up","down"];
const SYM  = { left:"←", right:"→", up:"↑", down:"↓" };
const OPP  = { left:"right", right:"left", up:"down", down:"up" };

// ── Game mode definitions ─────────────────────────────────
const MODES = [
  {
    id:"classic",     label:"CLASSIC",      emoji:"◎",
    color:G.yl,       duration:60,
    skill:"Focus & Inhibition",
    desc:"Match the center arrow. The flankers are noise — filter them out.",
  },
  {
    id:"inverse",     label:"INVERSE",      emoji:"⊗",
    color:G.bl,       duration:60,
    skill:"Inhibition Control",
    desc:"Press the OPPOSITE direction. Trains impulse suppression and executive control.",
  },
  {
    id:"colorswitch", label:"COLOR SWITCH",  emoji:"◈",
    color:G.pu,       duration:60,
    skill:"Cognitive Flexibility",
    desc:"Blue arrow = match it. Red arrow = reverse it. Rules switch mid-game.",
  },
  {
    id:"memory",      label:"MEMORY",        emoji:"□",
    color:G.gn,       duration:null,
    skill:"Working Memory",
    desc:"Watch the arrow sequence. Repeat it back in order. Go as deep as you can.",
  },
  {
    id:"flow",        label:"FLOW",          emoji:"∿",
    color:G.coral,    duration:90,
    skill:"Sustained Attention",
    desc:"A stream of arrows. Stay in the rhythm. Speed increases as you improve.",
  },
];

// ── CSS animation injection (singleton) ──────────────────
let _css = false;
function injectCSS() {
  if (_css || typeof document === "undefined") return;
  _css = true;
  const el = document.createElement("style");
  el.textContent = `
    @keyframes ag-in    { from{opacity:0;transform:scale(.6)} to{opacity:1;transform:scale(1)} }
    @keyframes ag-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.12)} }
    @keyframes ag-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-7px)} 75%{transform:translateX(7px)} }
    @keyframes ag-rise  { from{opacity:0;transform:translateY(0) scale(1.4)} 60%{opacity:1} to{opacity:0;transform:translateY(-32px) scale(.9)} }
    @keyframes ag-blink { 0%,100%{opacity:1} 50%{opacity:.3} }
    @keyframes ag-glow  { from{filter:brightness(1)} to{filter:brightness(1.6)} }
  `;
  document.head.appendChild(el);
}

// ── Haptics ───────────────────────────────────────────────
const vibe = p => { try { navigator.vibrate?.(p); } catch {} };

// ── Trial generators ──────────────────────────────────────
function genFlankerTrial(mode, score) {
  const diff = Math.min(7, Math.floor(score / 4));
  const inconRate = Math.min(0.72, 0.12 + diff * 0.08);
  const center = DIRS[Math.floor(Math.random() * 4)];
  const isIncon = Math.random() < inconRate;
  const flanker = isIncon
    ? DIRS.filter(d => d !== center)[Math.floor(Math.random() * 3)]
    : center;
  const isRed = mode === "colorswitch" && Math.random() < 0.48;
  const arrowColor = isRed ? "red" : "blue";
  let correct = center;
  if (mode === "inverse") correct = OPP[center];
  if (mode === "colorswitch") correct = isRed ? OPP[center] : center;
  return {
    arrows: [SYM[flanker], SYM[flanker], SYM[center], SYM[flanker], SYM[flanker]],
    center, flanker, correct, arrowColor, isIncon,
    key: Date.now() + Math.random(),
  };
}

function genMemorySeq(length) {
  return Array.from({ length }, () => DIRS[Math.floor(Math.random() * 4)]);
}

// ── Swipe detector hook ───────────────────────────────────
function useSwipe(onSwipe, enabled) {
  const t0 = useRef(null);
  const onStart = useCallback(e => {
    const src = e.touches?.[0] || e;
    t0.current = { x: src.clientX, y: src.clientY, ts: Date.now() };
  }, []);
  const onEnd = useCallback(e => {
    if (!t0.current || !enabled) return;
    const src = e.changedTouches?.[0] || e;
    const dx = src.clientX - t0.current.x;
    const dy = src.clientY - t0.current.y;
    const dt = Date.now() - t0.current.ts;
    t0.current = null;
    if (dt > 600 || Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
    const dir = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? "right" : "left")
      : (dy > 0 ? "down" : "up");
    onSwipe(dir);
  }, [onSwipe, enabled]);
  return { onTouchStart: onStart, onTouchEnd: onEnd };
}

// ── D-Pad ─────────────────────────────────────────────────
function DPad({ onPress, disabled, flash }) {
  const BTN_SIZE = 56;
  const GAP = 8;
  const pad = BTN_SIZE * 3 + GAP * 2;

  const btn = (dir) => {
    const isFlash = flash === dir;
    const color = isFlash
      ? (flash === "correct" ? G.gn : G.rd)
      : G.txt;
    return (
      <button
        key={dir}
        onPointerDown={e => { e.preventDefault(); if (!disabled) onPress(dir); }}
        style={{
          width: BTN_SIZE, height: BTN_SIZE,
          borderRadius: 14,
          background: isFlash ? color + "22" : G.surf2,
          border: `2px solid ${isFlash ? color : G.border}`,
          color: isFlash ? color : G.mut,
          fontSize: 24, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
          transition: "background .08s, border-color .08s, color .08s",
          WebkitTapHighlightColor: "transparent",
          touchAction: "none",
          userSelect: "none",
        }}
      >
        {SYM[dir]}
      </button>
    );
  };

  return (
    <div style={{ width: pad, display: "grid",
      gridTemplateColumns: `${BTN_SIZE}px ${BTN_SIZE}px ${BTN_SIZE}px`,
      gridTemplateRows: `${BTN_SIZE}px ${BTN_SIZE}px ${BTN_SIZE}px`,
      gap: GAP, flexShrink: 0 }}>
      {/* Row 1 */}
      <div/>
      {btn("up")}
      <div/>
      {/* Row 2 */}
      {btn("left")}
      <div style={{ width: BTN_SIZE, height: BTN_SIZE, borderRadius: "50%",
        background: G.surf2, border: `2px solid ${G.border}` }}/>
      {btn("right")}
      {/* Row 3 */}
      <div/>
      {btn("down")}
      <div/>
    </div>
  );
}

// ── Arrow flanker display ─────────────────────────────────
function FlankerDisplay({ trial, feedback, animKey }) {
  if (!trial) return null;
  const { arrows, arrowColor, isIncon } = trial;
  const isRed = arrowColor === "red";
  const centerColor = feedback === "correct" ? G.gn
    : feedback === "wrong" ? G.rd
    : isRed ? G.coral : G.yl;
  const flankerColor = feedback ? G.mut
    : isRed ? G.coral + "66" : G.mut;

  return (
    <div key={animKey} style={{
      display: "flex", gap: 10, alignItems: "center",
      animation: "ag-in .22s cubic-bezier(.34,1.56,.64,1) both",
    }}>
      {arrows.map((sym, i) => {
        const isCenter = i === 2;
        return (
          <span key={i} style={{
            fontSize: isCenter ? 58 : 36,
            lineHeight: 1,
            color: isCenter ? centerColor : flankerColor,
            fontFamily: "'Plus Jakarta Sans',system-ui",
            transition: "color .12s",
            animation: feedback === "wrong" && isCenter
              ? "ag-shake .35s ease" : "none",
          }}>
            {sym}
          </span>
        );
      })}
    </div>
  );
}

// ── Single arrow display (flow/memory show) ───────────────
function BigArrow({ dir, color, animKey, dim }) {
  return (
    <div key={animKey} style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "ag-in .18s cubic-bezier(.34,1.56,.64,1) both",
    }}>
      <span style={{
        fontSize: 80, lineHeight: 1,
        color: dim ? G.mut : (color || G.txt),
        fontFamily: "'Plus Jakarta Sans',system-ui",
        transition: "color .12s",
      }}>
        {dir ? SYM[dir] : "·"}
      </span>
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────
function StatsBar({ timeLeft, duration, score, streak, accuracy, modeColor }) {
  const pct = duration ? (timeLeft / duration) * 100 : 0;
  const tc = duration
    ? (timeLeft > duration * 0.4 ? G.gn : timeLeft > duration * 0.2 ? G.yl : G.rd)
    : G.mut;
  return (
    <div style={{ padding: "10px 16px 8px", background: G.surf,
      borderBottom: `1px solid ${G.border}`, flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <div style={{ flex: 1, height: 3, background: G.surf2, borderRadius: 2, overflow: "hidden" }}>
          {duration && (
            <div style={{ height: "100%", background: tc, borderRadius: 2,
              width: `${pct}%`, transition: "width 1s linear" }}/>
          )}
        </div>
        {duration && (
          <span style={{ fontFamily: "'Unbounded',monospace", fontSize: 8,
            fontWeight: 700, color: tc, minWidth: 28, textAlign: "right" }}>
            {timeLeft}s
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <span style={{ fontFamily: "'Unbounded',monospace", fontSize: 11,
          fontWeight: 700, color: modeColor }}>{score}</span>
        <span style={{ fontFamily: "'Unbounded',monospace", fontSize: 8, color: G.mut }}>pts</span>
        {streak >= 3 && (
          <span style={{ fontFamily: "'Unbounded',monospace", fontSize: 8,
            fontWeight: 700, color: G.yl, marginLeft: 4 }}>
            🔥 ×{streak}
          </span>
        )}
        <span style={{ fontFamily: "'Unbounded',monospace", fontSize: 8,
          color: G.mut, marginLeft: "auto" }}>{accuracy}% acc</span>
      </div>
    </div>
  );
}

// ── Rule badge (inverse / colorswitch) ───────────────────
function RuleBadge({ mode, currentColor }) {
  if (mode === "inverse") return (
    <div style={{ display: "flex", alignItems: "center", gap: 6,
      padding: "5px 12px", borderRadius: 20,
      background: G.bl + "18", border: `1px solid ${G.bl}` }}>
      <span style={{ fontFamily: "'Unbounded',monospace", fontSize: 7,
        fontWeight: 700, color: G.bl, letterSpacing: ".1em" }}>PRESS OPPOSITE</span>
    </div>
  );
  if (mode === "colorswitch") {
    const isRed = currentColor === "red";
    const c = isRed ? G.coral : G.bl;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6,
        padding: "5px 12px", borderRadius: 20,
        background: c + "18", border: `1px solid ${c}`,
        animation: "ag-blink .6s ease 2" }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: c }}/>
        <span style={{ fontFamily: "'Unbounded',monospace", fontSize: 7,
          fontWeight: 700, color: c, letterSpacing: ".1em" }}>
          {isRed ? "REVERSE" : "MATCH"}
        </span>
      </div>
    );
  }
  return null;
}

// ── GAME ENGINE ───────────────────────────────────────────
function GameEngine({ mode, onEnd }) {
  injectCSS();

  // ── Shared state ───────────────────────────────────────
  const [phase, setPhase]       = useState("playing"); // playing | done
  const [score, setScore]       = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [total, setTotal]       = useState(0);
  const [streak, setStreak]     = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(mode.duration || 0);
  const [feedback, setFeedback] = useState(null); // null | "correct" | "wrong"
  const [dpadFlash, setDpadFlash] = useState(null);
  const [showRise, setShowRise] = useState(false);

  // ── Flanker modes state ────────────────────────────────
  const [trial, setTrial]       = useState(() =>
    ["classic","inverse","colorswitch"].includes(mode.id)
      ? genFlankerTrial(mode.id, 0)
      : null
  );

  // ── Flow mode state ────────────────────────────────────
  const [flowArrow, setFlowArrow] = useState(
    mode.id === "flow" ? { dir: DIRS[Math.floor(Math.random()*4)], key: 0 } : null
  );
  const [flowWindow, setFlowWindow] = useState(2400);
  const [flowMissed, setFlowMissed] = useState(false);
  const flowWindowRef = useRef(2400);
  const flowCorrectRef = useRef(null); // expected direction

  // ── Memory mode state ──────────────────────────────────
  const [memPhase, setMemPhase] = useState("show"); // show | input | flash
  const [memSeq, setMemSeq]     = useState(() =>
    mode.id === "memory" ? genMemorySeq(2) : []
  );
  const [memShowing, setMemShowing] = useState(null); // dir being shown
  const [memInput, setMemInput]   = useState([]);
  const [memLevel, setMemLevel]   = useState(1);
  const [memFlash, setMemFlash]   = useState(null); // "correct"|"wrong"

  // ── Refs ───────────────────────────────────────────────
  const scoreRef   = useRef(0);
  const streakRef  = useRef(0);
  const bestRef    = useRef(0);
  const mistRef    = useRef(0);
  const totalRef   = useRef(0);
  const phaseRef   = useRef("playing");
  const trialRef   = useRef(trial);
  const feedbackRef = useRef(null);

  const gameTimerRef   = useRef(null);
  const feedTimerRef   = useRef(null);
  const flowTimerRef   = useRef(null);
  const memTimerRef    = useRef([]);
  const startRef       = useRef(Date.now());

  // Sync refs
  useEffect(() => { scoreRef.current  = score;   }, [score]);
  useEffect(() => { streakRef.current = streak;  }, [streak]);
  useEffect(() => { bestRef.current   = bestStreak; }, [bestStreak]);
  useEffect(() => { mistRef.current   = mistakes; }, [mistakes]);
  useEffect(() => { totalRef.current  = total;    }, [total]);
  useEffect(() => { phaseRef.current  = phase;    }, [phase]);
  useEffect(() => { trialRef.current  = trial;    }, [trial]);
  useEffect(() => { feedbackRef.current = feedback; }, [feedback]);
  useEffect(() => { flowWindowRef.current = flowWindow; }, [flowWindow]);

  // ── Cleanup ────────────────────────────────────────────
  useEffect(() => () => {
    clearInterval(gameTimerRef.current);
    clearTimeout(feedTimerRef.current);
    clearTimeout(flowTimerRef.current);
    memTimerRef.current.forEach(clearTimeout);
  }, []);

  // ── End game ───────────────────────────────────────────
  const endGame = useCallback(() => {
    clearInterval(gameTimerRef.current);
    clearTimeout(flowTimerRef.current);
    memTimerRef.current.forEach(clearTimeout);
    phaseRef.current = "done";
    setPhase("done");
    const sc  = scoreRef.current;
    const tot = totalRef.current;
    const mis = mistRef.current;
    const bs  = bestRef.current;
    const acc = tot > 0 ? Math.round((sc / tot) * 100) : 0;
    const dur = Math.round((Date.now() - startRef.current) / 1000);
    saveMindGameSession({
      gameType: "attention",
      mode: mode.id,
      score: sc,
      mistakes: mis,
      accuracy: acc,
      streak: bs,
      durationSeconds: dur,
      difficultyLevel: Math.min(7, Math.floor(sc / 4)),
    });
    onEnd({ score: sc, mistakes: mis, accuracy: acc, bestStreak: bs, duration: dur });
  }, [mode.id, onEnd]);

  // ── Main game timer (flanker + flow) ───────────────────
  useEffect(() => {
    if (!mode.duration || mode.id === "memory") return;
    gameTimerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { endGame(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(gameTimerRef.current);
  }, [mode.duration, mode.id, endGame]);

  // ── Feedback flash helper ──────────────────────────────
  const showFeedback = useCallback((type, dir) => {
    setFeedback(type);
    setDpadFlash(dir);
    if (type === "correct") { vibe([35]); setShowRise(true); }
    else { vibe([80, 40, 80]); }
    clearTimeout(feedTimerRef.current);
    feedTimerRef.current = setTimeout(() => {
      setFeedback(null);
      setDpadFlash(null);
      setShowRise(false);
    }, type === "correct" ? 300 : 450);
  }, []);

  // ── FLOW mode loop ─────────────────────────────────────
  const scheduleFlowNext = useCallback((win) => {
    clearTimeout(flowTimerRef.current);
    const next = { dir: DIRS[Math.floor(Math.random()*4)], key: Date.now() };
    flowCorrectRef.current = next.dir;
    setFlowArrow(next);
    setFlowMissed(false);
    flowTimerRef.current = setTimeout(() => {
      if (phaseRef.current !== "playing") return;
      // Missed
      setMistakes(m => { mistRef.current = m + 1; return m + 1; });
      setTotal(t => { totalRef.current = t + 1; return t + 1; });
      setStreak(0); streakRef.current = 0;
      setFlowMissed(true);
      vibe([60]);
      setTimeout(() => scheduleFlowNext(flowWindowRef.current), 400);
    }, win);
  }, []);

  useEffect(() => {
    if (mode.id !== "flow") return;
    scheduleFlowNext(flowWindowRef.current);
    return () => clearTimeout(flowTimerRef.current);
  }, [mode.id, scheduleFlowNext]);

  // ── MEMORY mode: show sequence ─────────────────────────
  const showMemSeq = useCallback((seq) => {
    setMemPhase("show");
    setMemInput([]);
    setMemShowing(null);
    memTimerRef.current.forEach(clearTimeout);
    memTimerRef.current = [];

    let t = 400;
    seq.forEach((dir) => {
      memTimerRef.current.push(setTimeout(() => setMemShowing(dir), t));
      t += 750;
      memTimerRef.current.push(setTimeout(() => setMemShowing(null), t));
      t += 200;
    });
    memTimerRef.current.push(setTimeout(() => setMemPhase("input"), t + 100));
  }, []);

  useEffect(() => {
    if (mode.id !== "memory") return;
    showMemSeq(memSeq);
  }, []); // eslint-disable-line

  // ── Universal respond handler ──────────────────────────
  const respond = useCallback((dir) => {
    if (phaseRef.current !== "playing") return;

    // ── MEMORY mode input ────────────────────────────────
    if (mode.id === "memory") {
      if (memPhase !== "input") return;
      const newInput = [...memInput, dir];
      const idx = newInput.length - 1;
      const expected = memSeq[idx];

      if (dir !== expected) {
        // Wrong
        vibe([80, 40, 80]);
        setMemFlash("wrong");
        setTotal(t => { totalRef.current = t + 1; return t + 1; });
        setMistakes(m => { mistRef.current = m + 1; return m + 1; });
        setTimeout(() => {
          setMemFlash(null);
          endGame();
        }, 600);
        return;
      }

      setMemInput(newInput);
      setMemFlash("correct");
      vibe([30]);
      setTimeout(() => setMemFlash(null), 200);

      if (newInput.length === memSeq.length) {
        // Completed sequence
        const newScore = scoreRef.current + memSeq.length;
        setScore(newScore); scoreRef.current = newScore;
        setTotal(t => { totalRef.current = t + 1; return t + 1; });
        const newStreak = streakRef.current + 1;
        setStreak(newStreak); streakRef.current = newStreak;
        if (newStreak > bestRef.current) { setBestStreak(newStreak); bestRef.current = newStreak; }

        const nextLevel = memLevel + 1;
        setMemLevel(nextLevel);
        const nextSeq = genMemorySeq(memSeq.length + 1);
        setMemSeq(nextSeq);
        setTimeout(() => {
          setMemPhase("show");
          showMemSeq(nextSeq);
        }, 700);
      }
      return;
    }

    // ── FLOW mode ────────────────────────────────────────
    if (mode.id === "flow") {
      if (!flowCorrectRef.current) return;
      clearTimeout(flowTimerRef.current);
      const isCorrect = dir === flowCorrectRef.current;
      const newScore = scoreRef.current + (isCorrect ? 1 : 0);
      flowCorrectRef.current = null;

      setTotal(t => { totalRef.current = t + 1; return t + 1; });
      if (isCorrect) {
        setScore(newScore); scoreRef.current = newScore;
        const ns = streakRef.current + 1;
        setStreak(ns); streakRef.current = ns;
        if (ns > bestRef.current) { setBestStreak(ns); bestRef.current = ns; }
        // Speed up every 8 correct
        if (newScore % 8 === 0) {
          const w = Math.max(900, flowWindowRef.current - 80);
          setFlowWindow(w); flowWindowRef.current = w;
        }
        showFeedback("correct", dir);
      } else {
        setMistakes(m => { mistRef.current = m + 1; return m + 1; });
        setStreak(0); streakRef.current = 0;
        showFeedback("wrong", dir);
      }
      setTimeout(() => scheduleFlowNext(flowWindowRef.current), 350);
      return;
    }

    // ── FLANKER modes (classic / inverse / colorswitch) ──
    if (feedbackRef.current) return; // still in feedback window
    const t = trialRef.current;
    if (!t) return;

    const isCorrect = dir === t.correct;
    const newScore = scoreRef.current + (isCorrect ? 1 : 0);
    const newTotal = totalRef.current + 1;

    setTotal(newTotal); totalRef.current = newTotal;
    if (isCorrect) {
      setScore(newScore); scoreRef.current = newScore;
      const ns = streakRef.current + 1;
      setStreak(ns); streakRef.current = ns;
      if (ns > bestRef.current) { setBestStreak(ns); bestRef.current = ns; }
    } else {
      setMistakes(m => { mistRef.current = m + 1; return m + 1; });
      setStreak(0); streakRef.current = 0;
    }

    showFeedback(isCorrect ? "correct" : "wrong", dir);
    clearTimeout(feedTimerRef.current);
    feedTimerRef.current = setTimeout(() => {
      if (phaseRef.current !== "playing") return;
      setFeedback(null); setDpadFlash(null); setShowRise(false);
      setTrial(genFlankerTrial(mode.id, newScore));
    }, isCorrect ? 300 : 450);
  }, [mode.id, memPhase, memInput, memSeq, memLevel, endGame, showMemSeq, showFeedback, scheduleFlowNext]);

  // ── Keyboard support ───────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    const map = { ArrowLeft:"left", ArrowRight:"right", ArrowUp:"up", ArrowDown:"down" };
    const handler = e => {
      if (map[e.key]) { e.preventDefault(); respond(map[e.key]); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, respond]);

  // ── Swipe support ──────────────────────────────────────
  const swipe = useSwipe(respond, phase === "playing");

  // ── RENDER ────────────────────────────────────────────
  const accuracy = total > 0 ? Math.round((score / total) * 100) : 100;
  const isFlanker = ["classic","inverse","colorswitch"].includes(mode.id);

  return (
    <div
      style={{ display:"flex", flexDirection:"column", flex:1, minHeight:0,
        background:G.bg, userSelect:"none", WebkitUserSelect:"none", overflow:"hidden" }}
      {...swipe}
    >
      <StatsBar
        timeLeft={timeLeft}
        duration={mode.duration}
        score={score}
        streak={streak}
        accuracy={accuracy}
        modeColor={mode.color}
      />

      {/* Game arena */}
      <div style={{ flex:1, minHeight:0, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center", gap:16, padding:"16px 16px",
        position:"relative", overflow:"hidden" }}>

        {/* Mode rule badge */}
        {isFlanker && <RuleBadge mode={mode.id} currentColor={trial?.arrowColor}/>}

        {/* Memory level badge */}
        {mode.id === "memory" && (
          <div style={{ fontFamily:"'Unbounded',monospace", fontSize:8,
            fontWeight:700, color:mode.color, letterSpacing:".12em" }}>
            {memPhase === "show" ? "WATCH…" : `INPUT ${memInput.length}/${memSeq.length}`}
          </div>
        )}

        {/* Arrow display */}
        {isFlanker && (
          <FlankerDisplay trial={trial} feedback={feedback} animKey={trial?.key}/>
        )}

        {mode.id === "flow" && (
          <BigArrow
            dir={flowArrow?.dir}
            color={flowMissed ? G.rd : mode.color}
            animKey={flowArrow?.key}
            dim={!flowArrow}
          />
        )}

        {mode.id === "memory" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16, alignItems:"center" }}>
            {/* Current showing arrow */}
            <BigArrow
              dir={memShowing}
              color={memPhase === "show" ? mode.color : G.mut}
              animKey={memShowing || "empty"}
              dim={!memShowing && memPhase === "show"}
            />
            {/* Input progress dots */}
            <div style={{ display:"flex", gap:8 }}>
              {memSeq.map((d, i) => {
                const done = i < memInput.length;
                const ok = done && memInput[i] === d;
                return (
                  <div key={i} style={{
                    width: 10, height: 10, borderRadius: "50%",
                    background: done ? (ok ? G.gn : G.rd) : G.surf2,
                    border: `1.5px solid ${done ? (ok ? G.gn : G.rd) : G.border}`,
                    transition: "background .15s",
                  }}/>
                );
              })}
            </div>
          </div>
        )}

        {/* Score rise animation */}
        {showRise && (
          <div style={{ position:"absolute", top:"30%", left:"50%",
            transform:"translateX(-50%)",
            fontFamily:"'Unbounded',monospace", fontSize:14, fontWeight:900,
            color:mode.color, animation:"ag-rise .6s ease both",
            pointerEvents:"none" }}>
            +1
          </div>
        )}

        {/* Feedback overlay */}
        {feedback && isFlanker && (
          <div style={{
            fontFamily:"'Unbounded',monospace", fontSize:22, fontWeight:900,
            color: feedback === "correct" ? G.gn : G.rd,
            animation: feedback === "correct" ? "ag-pulse .3s ease" : "ag-shake .35s ease",
            letterSpacing:".08em",
          }}>
            {feedback === "correct" ? "✓" : "✗"}
          </div>
        )}
      </div>

      {/* D-pad */}
      <div style={{ padding:"12px 16px 20px", display:"flex",
        justifyContent:"center", flexShrink:0 }}>
        <DPad
          onPress={respond}
          disabled={phase !== "playing" || (mode.id === "memory" && memPhase !== "input")}
          flash={dpadFlash || (memFlash === "correct" ? "correct" : memFlash === "wrong" ? "wrong" : null)}
        />
      </div>
    </div>
  );
}

// ── RESULTS SCREEN ────────────────────────────────────────
function ResultsScreen({ mode, result, onReplay, onBack }) {
  const { score, mistakes, accuracy, bestStreak, duration } = result;
  const tier = accuracy >= 90 ? "🏆" : accuracy >= 75 ? "⭐" : "💪";
  const label = accuracy >= 90 ? "EXCELLENT" : accuracy >= 75 ? "STRONG" : "KEEP TRAINING";

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", minHeight:"100%", gap:20,
      padding:"32px 20px", background:G.bg }}>

      <div style={{ fontSize:52, animation:"ag-in .3s ease" }}>{tier}</div>
      <div>
        <p style={{ fontFamily:"'Unbounded',monospace", fontSize:11, fontWeight:700,
          color:G.txt, letterSpacing:".1em", textAlign:"center", marginBottom:4 }}>
          SESSION COMPLETE
        </p>
        <p style={{ fontFamily:"'Unbounded',monospace", fontSize:8,
          color:mode.color, letterSpacing:".12em", textAlign:"center" }}>
          {label}
        </p>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr",
        gap:10, width:"100%", maxWidth:320 }}>
        {[
          { l:"SCORE",       v:score,          c:mode.color },
          { l:"ACCURACY",    v:`${accuracy}%`, c:accuracy>=80?G.gn:accuracy>=60?G.yl:G.rd },
          { l:"BEST STREAK", v:bestStreak,     c:G.yl },
          { l:"MISTAKES",    v:mistakes,       c:mistakes===0?G.gn:G.mut },
        ].map(s => (
          <div key={s.l} style={{ background:G.surf, borderRadius:14, padding:"16px 12px",
            textAlign:"center", border:`1px solid ${G.border}` }}>
            <div style={{ fontFamily:"'Unbounded',monospace", fontSize:24,
              fontWeight:700, color:s.c, marginBottom:4 }}>{s.v}</div>
            <div style={{ fontFamily:"'Unbounded',monospace", fontSize:6,
              letterSpacing:".12em", color:G.mut }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:10, width:"100%", maxWidth:320,
        flexDirection:"column" }}>
        <button onClick={onReplay} style={{
          background:mode.color, color:mode.color === G.yl ? "#000" : G.txt,
          borderRadius:12, padding:"14px",
          fontFamily:"'Unbounded',monospace", fontSize:10, fontWeight:700,
          letterSpacing:".12em", width:"100%",
        }}>
          PLAY AGAIN
        </button>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onBack} style={{
            flex:1, background:G.surf, color:G.mut, borderRadius:12, padding:"12px",
            border:`1.5px solid ${G.border}`,
            fontFamily:"'Unbounded',monospace", fontSize:8, fontWeight:700,
            letterSpacing:".1em",
          }}>
            MODES
          </button>
          <button
            onClick={onBack}
            style={{
              flex:1, background:G.surf2, color:mode.color, borderRadius:12, padding:"12px",
              border:`1.5px solid ${mode.color}44`,
              fontFamily:"'Unbounded',monospace", fontSize:8, fontWeight:700,
              letterSpacing:".1em",
            }}
          >
            START FOCUS →
          </button>
        </div>
      </div>

      <p style={{ fontSize:9, color:G.mut }}>✓ Session saved</p>
    </div>
  );
}

// ── MODE SELECT SCREEN ────────────────────────────────────
function ModeSelectScreen({ onSelect }) {
  injectCSS();

  // Load personal bests per mode
  const allSessions = loadMindGameSessions("attention");
  const pbs = Object.fromEntries(MODES.map(m => {
    const sess = allSessions.filter(s => s.mode === m.id);
    const best = sess.length ? Math.max(...sess.map(s => s.score)) : null;
    return [m.id, best];
  }));

  return (
    <div style={{ background:G.bg, minHeight:"100%", paddingBottom:24 }}>
      {/* Header */}
      <div style={{ background:G.surf, borderBottom:`1px solid ${G.border}`,
        padding:"18px 16px 16px" }}>
        <div style={{ fontFamily:"'Unbounded',monospace", fontSize:8,
          color:G.mut, letterSpacing:".14em", marginBottom:6 }}>
          ATTENTION TRAINING
        </div>
        <div style={{ fontFamily:"'Unbounded',monospace", fontSize:18,
          fontWeight:900, color:G.txt, lineHeight:1.1, marginBottom:6 }}>
          CHOOSE<br/>YOUR MODE
        </div>
        <p style={{ fontSize:11, color:G.mut, lineHeight:1.6 }}>
          Each mode targets a different cognitive skill. Start with Classic and progress from there.
        </p>
      </div>

      <div style={{ padding:"14px 16px", display:"flex",
        flexDirection:"column", gap:10 }}>
        {MODES.map((m, idx) => (
          <button
            key={m.id}
            onClick={() => onSelect(m)}
            style={{
              display:"flex", alignItems:"flex-start", gap:14,
              padding:"14px 16px", borderRadius:16, textAlign:"left",
              background:G.surf, border:`1.5px solid ${G.border}`,
              cursor:"pointer", WebkitTapHighlightColor:"transparent",
              animation:`ag-in ${.15 + idx*.07}s ease both`,
            }}
            onTouchStart={e => { e.currentTarget.style.transform="scale(.98)"; }}
            onTouchEnd={e => { e.currentTarget.style.transform="scale(1)"; }}
          >
            {/* Color dot */}
            <div style={{
              width:46, height:46, borderRadius:12, flexShrink:0,
              background:m.color + "18",
              border:`2px solid ${m.color}`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontFamily:"'Unbounded',monospace", fontSize:18, color:m.color,
            }}>
              {m.emoji}
            </div>

            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center",
                justifyContent:"space-between", marginBottom:2 }}>
                <span style={{ fontFamily:"'Unbounded',monospace", fontSize:9,
                  fontWeight:700, color:G.txt, letterSpacing:".08em" }}>
                  {m.label}
                </span>
                {m.duration && (
                  <span style={{ fontFamily:"'Unbounded',monospace", fontSize:7,
                    color:G.mut }}>{m.duration}s</span>
                )}
              </div>
              <div style={{ fontFamily:"'Unbounded',monospace", fontSize:6.5,
                color:m.color, letterSpacing:".08em", marginBottom:5 }}>
                {m.skill.toUpperCase()}
              </div>
              <p style={{ fontSize:11, color:G.mut, lineHeight:1.5, margin:0 }}>
                {m.desc}
              </p>
              {pbs[m.id] != null && (
                <div style={{ marginTop:7, display:"inline-flex",
                  alignItems:"center", gap:4,
                  background:G.surf2, borderRadius:6, padding:"3px 8px" }}>
                  <span style={{ fontSize:9 }}>🏆</span>
                  <span style={{ fontFamily:"'Unbounded',monospace", fontSize:6.5,
                    fontWeight:700, color:G.txt }}>BEST {pbs[m.id]}</span>
                </div>
              )}
            </div>

            <span style={{ fontSize:16, color:G.mut, alignSelf:"center",
              flexShrink:0 }}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── ROOT COMPONENT ────────────────────────────────────────
export function AttentionGame({ onDone }) {
  const [screen, setScreen] = useState("modes"); // modes | playing | done
  const [activeMode, setActiveMode] = useState(null);
  const [result, setResult] = useState(null);
  const [gameKey, setGameKey] = useState(0); // force remount on replay

  const handleSelect = useCallback((mode) => {
    setActiveMode(mode);
    setScreen("playing");
  }, []);

  const handleGameEnd = useCallback((res) => {
    setResult(res);
    setScreen("done");
  }, []);

  const handleReplay = useCallback(() => {
    setGameKey(k => k + 1);
    setScreen("playing");
  }, []);

  const handleBack = useCallback(() => {
    setScreen("modes");
    setResult(null);
  }, []);

  if (screen === "modes") return <ModeSelectScreen onSelect={handleSelect}/>;

  if (screen === "playing" && activeMode) return (
    <GameEngine key={gameKey} mode={activeMode} onEnd={handleGameEnd}/>
  );

  if (screen === "done" && result && activeMode) return (
    <ResultsScreen mode={activeMode} result={result} onReplay={handleReplay} onBack={handleBack}/>
  );

  return null;
}
