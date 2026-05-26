import { useState, useEffect, useCallback } from "react";
import { dbGetAll } from "../lib/db.js";
import { callClaude } from "../lib/ai.js";
import { today, uuid, getWeekNumber, getWeekStart, getDatesInWeek, fmtDate } from "../lib/utils.js";

// ─── Storage ───────────────────────────────────────────────────
const GOALS_KEY   = "ww_goals";
const REPORT_KEY  = "ww_report_cache";
const loadGoals   = () => { try { return JSON.parse(localStorage.getItem(GOALS_KEY))  || []; } catch { return []; } };
const saveGoals   = (g) => localStorage.setItem(GOALS_KEY, JSON.stringify(g));
const loadReports = () => { try { return JSON.parse(localStorage.getItem(REPORT_KEY)) || {}; } catch { return {}; } };
const saveReports = (r) => localStorage.setItem(REPORT_KEY, JSON.stringify(r));

// ─── Goal types ────────────────────────────────────────────────
const GOAL_TYPES = [
  { id: "checkin",    label: "Check-In Consistency",  unit: "% of days",  desc: "Complete morning check-ins regularly",       icon: "📋" },
  { id: "rework",     label: "Reduce Rework Rate",     unit: "% or fewer", desc: "Lower your rework situation frequency",      icon: "🔁" },
  { id: "resolve",    label: "Situation Resolution",   unit: "% resolved", desc: "Resolve a higher % of logged situations",    icon: "✅" },
  { id: "framework",  label: "Framework Usage",        unit: "sessions",   desc: "Run structured improvement sessions",         icon: "⚙️" },
  { id: "energy",     label: "Sustain Energy Level",   unit: "avg out of 5", desc: "Maintain daily energy above a threshold",  icon: "⚡" },
  { id: "custom",     label: "Custom Goal",            unit: "your metric", desc: "Define your own growth target",             icon: "🎯" },
];

const TIMEFRAMES = [
  { days: 30,  label: "30 DAYS" },
  { days: 60,  label: "60 DAYS" },
  { days: 90,  label: "90 DAYS" },
  { days: 180, label: "6 MONTHS" },
];

// ─── Data computation ──────────────────────────────────────────
function getDateRange(startIso, days) {
  const dates = [];
  const start = new Date(startIso + "T12:00:00");
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    if (iso > today()) break;
    dates.push(iso);
  }
  return dates;
}

function computeGoalProgress(goal, situations, checkins) {
  const dates = getDateRange(goal.startDate, goal.timeframe);
  if (!dates.length) return { value: 0, progress: 0, trend: [] };

  const dateSet = new Set(dates);
  const sits    = situations.filter((s) => dateSet.has(s.date));
  const checks  = checkins.filter((c) => dateSet.has(c.date));
  const bods    = checks.filter((c) => c.type === "bod");
  const eods    = checks.filter((c) => c.type === "eod");

  let value = 0;

  switch (goal.type) {
    case "checkin": {
      const daysWithBOD = new Set(bods.map((b) => b.date)).size;
      value = dates.length > 0 ? Math.round((daysWithBOD / dates.length) * 100) : 0;
      break;
    }
    case "rework": {
      const reworkSits = sits.filter((s) => s.category === "Rework" || s.description?.toLowerCase().includes("rework"));
      value = sits.length > 0 ? Math.round((reworkSits.length / sits.length) * 100) : 0;
      break;
    }
    case "resolve": {
      const resolved = sits.filter((s) => s.status === "resolved");
      value = sits.length > 0 ? Math.round((resolved.length / sits.length) * 100) : 0;
      break;
    }
    case "framework": {
      const sessions = (() => { try { return JSON.parse(localStorage.getItem("ww_fw_sessions")) || []; } catch { return []; } })();
      value = sessions.filter((s) => s.date >= goal.startDate).length;
      break;
    }
    case "energy": {
      const avgE = bods.length
        ? bods.reduce((sum, b) => sum + (b.energyLevel || 3), 0) / bods.length
        : 0;
      value = Math.round(avgE * 10) / 10;
      break;
    }
    case "custom":
      value = goal.currentValue || 0;
      break;
  }

  const progress = goal.type === "rework"
    ? Math.min(100, Math.max(0, Math.round(((goal.target - value) / goal.target) * 100 + 100)))
    : goal.target > 0
      ? Math.min(100, Math.round((value / goal.target) * 100))
      : 0;

  // Weekly trend: split dates into weeks and compute per-week value
  const weekGroups = {};
  dates.forEach((d) => {
    const ws = getWeekStart(d);
    if (!weekGroups[ws]) weekGroups[ws] = [];
    weekGroups[ws].push(d);
  });

  const trend = Object.entries(weekGroups).map(([ws, wDates]) => {
    const wSet    = new Set(wDates);
    const wSits   = situations.filter((s) => wSet.has(s.date));
    const wChecks = checkins.filter((c) => wSet.has(c.date));
    const wBods   = wChecks.filter((c) => c.type === "bod");
    let wVal = 0;
    switch (goal.type) {
      case "checkin":  wVal = wDates.length > 0 ? Math.round((new Set(wBods.map(b=>b.date)).size / wDates.length) * 100) : 0; break;
      case "rework":   { const wr = wSits.filter(s=>s.category==="Rework").length; wVal = wSits.length>0?Math.round((wr/wSits.length)*100):0; break; }
      case "resolve":  wVal = wSits.length>0?Math.round((wSits.filter(s=>s.status==="resolved").length/wSits.length)*100):0; break;
      case "energy":   wVal = wBods.length>0?Math.round((wBods.reduce((s,b)=>s+(b.energyLevel||3),0)/wBods.length)*10)/10:0; break;
      default:         wVal = 0;
    }
    return { week: `WK${getWeekNumber(ws)}`, value: wVal };
  });

  return { value, progress, trend };
}

function computePortfolioMetrics(situations, checkins, days) {
  const dates   = getDateRange(today(), days).reverse().slice(-days);
  const start   = new Date(); start.setDate(start.getDate() - days);
  const startIso = start.toISOString().slice(0, 10);

  const sits   = situations.filter((s) => s.date >= startIso);
  const checks = checkins.filter((c)  => c.date >= startIso);
  const bods   = checks.filter((c) => c.type === "bod");
  const eods   = checks.filter((c) => c.type === "eod");

  const daysActive = new Set([...sits.map(s=>s.date), ...bods.map(b=>b.date)]).size;
  const reworkSits = sits.filter((s) => s.category === "Rework" || s.description?.toLowerCase().includes("rework"));
  const reworkRate = sits.length > 0 ? Math.round((reworkSits.length / sits.length) * 100) : 0;
  const resolveRate= sits.length > 0 ? Math.round((sits.filter(s=>s.status==="resolved").length/sits.length)*100) : 0;
  const avgEnergy  = bods.length  > 0 ? Math.round((bods.reduce((s,b)=>s+(b.energyLevel||3),0)/bods.length)*10)/10 : null;
  const avgRating  = eods.length  > 0 ? Math.round((eods.reduce((s,e)=>s+(e.rating||3),0)/eods.length)*10)/10 : null;
  const checkinPct = days > 0 ? Math.round((new Set(bods.map(b=>b.date)).size / Math.min(days,daysActive||1)) * 100) : 0;

  const catCounts = {};
  sits.forEach((s) => { catCounts[s.category] = (catCounts[s.category]||0)+1; });
  const topCategory = Object.entries(catCounts).sort((a,b)=>b[1]-a[1])[0];

  const fwSessions = (() => { try { return JSON.parse(localStorage.getItem("ww_fw_sessions"))||[]; } catch { return []; } })();
  const fwUsed = fwSessions.filter(s=>s.date>=startIso).length;

  // Weekly trend for situations
  const weeklyData = {};
  sits.forEach((s) => {
    const ws = getWeekStart(s.date);
    if (!weeklyData[ws]) weeklyData[ws] = { total: 0, resolved: 0, rework: 0 };
    weeklyData[ws].total++;
    if (s.status === "resolved") weeklyData[ws].resolved++;
    if (s.category === "Rework") weeklyData[ws].rework++;
  });

  return {
    totalSituations: sits.length,
    resolvedSituations: sits.filter(s=>s.status==="resolved").length,
    openSituations: sits.filter(s=>s.status==="open").length,
    reworkRate, resolveRate, avgEnergy, avgRating,
    checkinPct, daysActive, topCategory,
    fwUsed, weeklyData, startIso,
  };
}

function buildReportContext(goals, metrics, situations, checkins, days) {
  const lines = [`PERFORMANCE REPORT — LAST ${days} DAYS`];
  lines.push(`Period: ${metrics.startIso} to ${today()}`);
  lines.push(`Active days: ${metrics.daysActive}`);
  lines.push(`\nKEY METRICS:`);
  lines.push(`- Total situations logged: ${metrics.totalSituations}`);
  lines.push(`- Resolution rate: ${metrics.resolveRate}%`);
  lines.push(`- Rework rate: ${metrics.reworkRate}%`);
  if (metrics.avgEnergy) lines.push(`- Avg energy level: ${metrics.avgEnergy}/5`);
  if (metrics.avgRating) lines.push(`- Avg day rating: ${metrics.avgRating}/5`);
  lines.push(`- Morning check-in rate: ${metrics.checkinPct}%`);
  lines.push(`- Framework sessions: ${metrics.fwUsed}`);
  if (metrics.topCategory) lines.push(`- Most common situation type: ${metrics.topCategory[0]} (${metrics.topCategory[1]}x)`);

  if (goals.length) {
    lines.push(`\nGROWTH GOALS:`);
    goals.filter(g=>g.status==="active").forEach((g) => {
      lines.push(`- ${g.title}: target ${g.target} ${g.unit} over ${g.timeframe} days`);
    });
  }

  const sits = situations.filter(s=>s.date>=metrics.startIso);
  if (sits.length) {
    lines.push(`\nSITUATION BREAKDOWN:`);
    const catMap = {};
    sits.forEach(s=>{ catMap[s.category]=(catMap[s.category]||0)+1; });
    Object.entries(catMap).sort((a,b)=>b[1]-a[1]).forEach(([cat,cnt])=>{
      lines.push(`- ${cat}: ${cnt} situations`);
    });
  }

  return lines.join("\n");
}

const REPORT_SYSTEM = `You are WorkWrite's performance analytics engine. Based on the user's work data over a period, generate a structured performance report:

**EXECUTIVE SUMMARY**
[3–4 sentences describing overall performance, trajectory, and standout patterns. Be specific and data-driven.]

**STRENGTHS THIS PERIOD**
1. [Specific strength with evidence from the data]
2. [Specific strength with evidence]
3. [Specific strength with evidence]

**IMPROVEMENT AREAS**
1. [Specific area with data-backed reasoning]
2. [Specific area]
3. [Specific area]

**WORKFLOW HEALTH SCORE**
[Score out of 100 with brief justification — consider rework rate, resolution rate, check-in consistency, energy trends]

**30/60/90 DAY OUTLOOK**
[Based on current trajectory, what should the user focus on at each milestone? Be concrete and actionable.]

**TOP 5 RECOMMENDED ACTIONS**
1. [Action with timeframe]
2. [Action with timeframe]
3. [Action with timeframe]
4. [Action with timeframe]
5. [Action with timeframe]

Be direct, specific, and honest. Use the data. Avoid generic advice.`;

// ─── Shared UI ─────────────────────────────────────────────────
function Sheet({ T, onClose, title, children }) {
  return (
    <div style={{ position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.65)",display:"flex",alignItems:"flex-end" }}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:T.surface,borderRadius:"24px 24px 0 0",padding:"0 20px 32px",
        width:"100%",maxHeight:"90dvh",overflowY:"auto",boxShadow:"0 -8px 40px rgba(0,0,0,0.4)",
      }}>
        <div style={{textAlign:"center",padding:"12px 0 16px"}}>
          <div style={{width:36,height:4,borderRadius:2,background:T.border,margin:"0 auto"}}/>
        </div>
        {title && <h2 style={{fontFamily:"'Unbounded',sans-serif",fontSize:14,fontWeight:700,
          color:T.text,margin:"0 0 20px",letterSpacing:1}}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

function Btn({ T, onClick, children, variant="primary", disabled=false, style={} }) {
  const s = {
    primary:{ background:T.accent,color:"#fff" },
    ghost:  { background:"transparent",color:T.muted,border:`1px solid ${T.border}` },
    purple: { background:T.purpleDim,color:T.purple,border:`1px solid ${T.purple}40` },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width:"100%",padding:"14px",borderRadius:12,border:"none",
      fontFamily:"'Unbounded',sans-serif",fontSize:11,letterSpacing:"1px",fontWeight:600,
      cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.4:1,marginTop:8,
      ...s[variant],...style,
    }}>{children}</button>
  );
}

function TrendBar({ T, trend, max, color }) {
  if (!trend || !trend.length) return null;
  const peak = Math.max(...trend.map(t=>t.value), max||1);
  const col  = { accent:T.accent, green:T.green, amber:T.amber, purple:T.purple }[color]||T.accent;
  return (
    <div style={{display:"flex",gap:4,alignItems:"flex-end",height:40,marginTop:8}}>
      {trend.map((t,i) => (
        <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <div style={{width:"100%",background:T.surface2,borderRadius:3,height:32,display:"flex",alignItems:"flex-end"}}>
            <div style={{width:"100%",background:col,borderRadius:3,
              height:`${Math.max(8,(t.value/peak)*100)}%`,opacity:0.85}}/>
          </div>
          <span style={{fontSize:8,color:T.muted,fontFamily:"'Unbounded',sans-serif"}}>{t.week}</span>
        </div>
      ))}
    </div>
  );
}

function ProgressRing({ T, progress, color, size=64 }) {
  const r   = (size-8)/2;
  const circ= 2*Math.PI*r;
  const col = { accent:T.accent,green:T.green,amber:T.amber,purple:T.purple,red:T.red }[color]||T.accent;
  return (
    <svg width={size} height={size} style={{transform:"rotate(-90deg)",flexShrink:0}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.surface2} strokeWidth={6}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={6}
        strokeDasharray={circ} strokeDashoffset={circ*(1-progress/100)}
        strokeLinecap="round" style={{transition:"stroke-dashoffset 0.6s ease"}}/>
    </svg>
  );
}

// ─── Goal Card ─────────────────────────────────────────────────
function GoalCard({ T, goal, progress, value, trend, onEdit, onDelete, onUpdateCustom }) {
  const gt = GOAL_TYPES.find(t=>t.id===goal.type)||GOAL_TYPES[0];
  const isGood = goal.type === "rework" ? value <= goal.target : value >= goal.target;
  const pctColor = progress >= 100 ? "green" : progress >= 60 ? "accent" : "amber";
  const elapsed  = Math.floor((Date.now()-new Date(goal.startDate+"T12:00:00"))/86400000);
  const remaining= Math.max(0, goal.timeframe - elapsed);

  return (
    <div style={{background:T.surface,borderRadius:16,padding:"18px",marginBottom:12,
      border:`1px solid ${T.border}`}}>
      <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
        <ProgressRing T={T} progress={progress} color={pctColor} />
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
            <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:12,fontWeight:700,
              color:T.text,lineHeight:1.3}}>{goal.title}</div>
            <div style={{display:"flex",gap:4,flexShrink:0}}>
              <button onClick={onEdit} style={{background:"none",border:"none",cursor:"pointer",
                color:T.muted,fontSize:12,padding:"2px 4px"}}>Edit</button>
              <button onClick={onDelete} style={{background:"none",border:"none",cursor:"pointer",
                color:T.red,fontSize:12,padding:"2px 4px"}}>✕</button>
            </div>
          </div>
          <div style={{fontSize:12,color:T.muted,marginTop:3}}>
            {gt.icon} {goal.timeframe}-day goal · {remaining}d left
          </div>
          <div style={{display:"flex",gap:8,marginTop:8,alignItems:"center"}}>
            <span style={{fontFamily:"'Unbounded',sans-serif",fontSize:11,fontWeight:700,
              color:T.text}}>{goal.type==="energy"||goal.type==="framework" ? value : `${value}%`}</span>
            <span style={{fontSize:11,color:T.muted}}>of</span>
            <span style={{fontFamily:"'Unbounded',sans-serif",fontSize:11,color:T.accent}}>
              {goal.target}{goal.type==="energy"?" /5":goal.type==="framework"?" sessions":"%"}
            </span>
            <span style={{flex:1}}/>
            <span style={{fontFamily:"'Unbounded',sans-serif",fontSize:11,fontWeight:700,
              color:{green:T.green,accent:T.accent,amber:T.amber}[pctColor]}}>{progress}%</span>
          </div>
          {goal.type==="custom" && (
            <div style={{marginTop:8,display:"flex",gap:6,alignItems:"center"}}>
              <input type="number" placeholder="Update progress"
                style={{flex:1,background:T.surface2,border:`1px solid ${T.border}`,borderRadius:8,
                  padding:"6px 10px",fontSize:12,color:T.text,outline:"none",
                  fontFamily:"'Plus Jakarta Sans',sans-serif"}}
                onBlur={(e)=>{ if(e.target.value) onUpdateCustom(parseFloat(e.target.value)); e.target.value=""; }}
                onFocus={(e)=>{ e.target.style.borderColor=T.accent; }}
              />
              <span style={{fontSize:11,color:T.muted}}>{goal.unit}</span>
            </div>
          )}
          {trend && trend.length > 1 && <TrendBar T={T} trend={trend} color="accent" />}
        </div>
      </div>
    </div>
  );
}

// ─── Add/Edit Goal Modal ───────────────────────────────────────
function GoalModal({ T, onClose, onSave, existing }) {
  const [type,      setType]      = useState(existing?.type      || "checkin");
  const [title,     setTitle]     = useState(existing?.title     || "");
  const [target,    setTarget]    = useState(existing?.target    || "");
  const [timeframe, setTimeframe] = useState(existing?.timeframe || 30);

  const gt = GOAL_TYPES.find(t=>t.id===type)||GOAL_TYPES[0];

  const defaultTitle = () => {
    const map = {
      checkin:   "Complete Morning Check-Ins",
      rework:    "Reduce Rework Rate",
      resolve:   "Improve Situation Resolution",
      framework: "Run Framework Sessions",
      energy:    "Sustain Energy Level",
      custom:    "",
    };
    return map[type]||"";
  };

  const handleTypeChange = (t) => {
    setType(t);
    if (!existing) setTitle(GOAL_TYPES.find(x=>x.id===t)?.label||"");
  };

  const handleSave = () => {
    if (!title.trim() || !target) return;
    onSave({
      id:        existing?.id || uuid(),
      type, title: title.trim(),
      target:    parseFloat(target),
      unit:      gt.unit,
      timeframe: parseInt(timeframe),
      startDate: existing?.startDate || today(),
      status:    "active",
      createdAt: existing?.createdAt || new Date().toISOString(),
    });
  };

  useEffect(() => {
    if (!existing && !title) setTitle(defaultTitle());
  }, [type]);

  return (
    <Sheet T={T} onClose={onClose} title={existing?"EDIT GOAL":"NEW GROWTH GOAL"}>
      <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:10,letterSpacing:"1.5px",
        color:T.muted,marginBottom:8}}>GOAL TYPE</div>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
        {GOAL_TYPES.map(gt=>(
          <button key={gt.id} onClick={()=>handleTypeChange(gt.id)} style={{
            padding:"12px 14px",borderRadius:12,border:"none",cursor:"pointer",textAlign:"left",
            background:type===gt.id?T.accentDim:T.surface2,
            outline:type===gt.id?`1.5px solid ${T.accent}`:"none",
            display:"flex",alignItems:"center",gap:10,
          }}>
            <span style={{fontSize:18}}>{gt.icon}</span>
            <div>
              <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:11,fontWeight:600,
                color:type===gt.id?T.accent:T.text}}>{gt.label}</div>
              <div style={{fontSize:11,color:T.muted,marginTop:2}}>{gt.desc}</div>
            </div>
          </button>
        ))}
      </div>

      <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:10,letterSpacing:"1.5px",
        color:T.muted,marginBottom:8}}>GOAL TITLE</div>
      <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Name this goal"
        style={{width:"100%",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:10,
          padding:"12px 14px",fontSize:14,color:T.text,outline:"none",marginBottom:16,
          fontFamily:"'Plus Jakarta Sans',sans-serif"}}
        onFocus={e=>{e.target.style.borderColor=T.accent;}}
        onBlur={e=>{e.target.style.borderColor=T.border;}}/>

      <div style={{display:"flex",gap:12,marginBottom:16}}>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:10,letterSpacing:"1.5px",
            color:T.muted,marginBottom:8}}>TARGET ({gt.unit.toUpperCase()})</div>
          <input type="number" value={target} onChange={e=>setTarget(e.target.value)}
            placeholder={type==="energy"?"4.0":type==="framework"?"4":"80"}
            style={{width:"100%",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:10,
              padding:"12px 14px",fontSize:14,color:T.text,outline:"none",
              fontFamily:"'Plus Jakarta Sans',sans-serif"}}
            onFocus={e=>{e.target.style.borderColor=T.accent;}}
            onBlur={e=>{e.target.style.borderColor=T.border;}}/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:10,letterSpacing:"1.5px",
            color:T.muted,marginBottom:8}}>TIMEFRAME</div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {TIMEFRAMES.map(tf=>(
              <button key={tf.days} onClick={()=>setTimeframe(tf.days)} style={{
                padding:"10px",borderRadius:10,border:"none",cursor:"pointer",
                background:timeframe===tf.days?T.accentDim:T.surface2,
                color:timeframe===tf.days?T.accent:T.muted,
                fontFamily:"'Unbounded',sans-serif",fontSize:9,letterSpacing:"0.5px",fontWeight:600,
                outline:timeframe===tf.days?`1.5px solid ${T.accent}`:"none",
              }}>{tf.label}</button>
            ))}
          </div>
        </div>
      </div>

      <Btn T={T} onClick={handleSave} disabled={!title.trim()||!target}>
        {existing?"SAVE CHANGES":"SET GOAL"}
      </Btn>
      <Btn T={T} onClick={onClose} variant="ghost">CANCEL</Btn>
    </Sheet>
  );
}

// ─── Performance Report View ───────────────────────────────────
function ReportView({ T, settings, situations, checkins, goals, onBack }) {
  const [days,     setDays]     = useState(30);
  const [report,   setReport]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const reports = loadReports();
  const cacheKey = `report_${days}_${today()}`;

  useEffect(() => {
    setReport(reports[cacheKey] || null);
  }, [days]);

  const metrics = computePortfolioMetrics(situations, checkins, days);

  const generate = async () => {
    if (!settings.apiKey) {
      alert("Add your Anthropic API key in MORE → Settings to generate reports.");
      return;
    }
    setLoading(true);
    try {
      const context = buildReportContext(goals, metrics, situations, checkins, days);
      const result  = await callClaude(
        [{ role:"user", content:context }],
        REPORT_SYSTEM,
        settings.apiKey,
        2000,
      );
      setReport(result);
      const updated = { ...loadReports(), [cacheKey]: result };
      saveReports(updated);
    } catch(err) {
      setReport(`⚠️ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const parseSection = (text, header) => {
    const pattern = new RegExp(`\\*\\*${header}\\*\\*\\s*([\\s\\S]*?)(?=\\*\\*[A-Z]|$)`);
    const match = text?.match(pattern);
    return match ? match[1].trim() : null;
  };

  const extractScore = (text) => {
    const m = text?.match(/(\d{1,3})\s*(?:\/|\s*out of\s*)\s*100/i);
    return m ? parseInt(m[1]) : null;
  };

  const scoreColor = (s) => s >= 80 ? "green" : s >= 60 ? "accent" : s >= 40 ? "amber" : "red";

  return (
    <div style={{padding:"0 16px"}}>
      <div style={{padding:"16px 0 20px",display:"flex",alignItems:"center",gap:12}}>
        <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",
          color:T.accent,fontSize:20,padding:"4px 8px 4px 0"}}>←</button>
        <h2 style={{fontFamily:"'Unbounded',sans-serif",fontSize:16,fontWeight:700,color:T.text,margin:0}}>
          PERFORMANCE REPORT
        </h2>
      </div>

      {/* Timeframe picker */}
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {TIMEFRAMES.map(tf=>(
          <button key={tf.days} onClick={()=>{ setDays(tf.days); setReport(reports[`report_${tf.days}_${today()}`]||null); }}
            style={{flex:1,padding:"10px 4px",borderRadius:10,border:"none",cursor:"pointer",
              background:days===tf.days?T.accentDim:T.surface2,
              color:days===tf.days?T.accent:T.muted,
              fontFamily:"'Unbounded',sans-serif",fontSize:9,letterSpacing:"0.5px",fontWeight:600,
              outline:days===tf.days?`1.5px solid ${T.accent}`:"none"}}>
            {tf.label}
          </button>
        ))}
      </div>

      {/* Metrics summary */}
      <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:10,letterSpacing:"1.5px",
        color:T.muted,marginBottom:10}}>KEY METRICS — LAST {days} DAYS</div>
      <div style={{display:"flex",gap:8,marginBottom:8}}>
        {[
          {label:"SITUATIONS",  value:metrics.totalSituations, color:"accent"},
          {label:"RESOLVED",    value:`${metrics.resolveRate}%`, color:"green"},
          {label:"REWORK RATE", value:`${metrics.reworkRate}%`, color:metrics.reworkRate>30?"amber":"green"},
        ].map(m=>(
          <div key={m.label} style={{flex:1,background:T.surface,borderRadius:14,padding:"14px 10px",
            border:`1px solid ${T.border}`,textAlign:"center"}}>
            <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:18,fontWeight:700,
              color:{accent:T.accent,green:T.green,amber:T.amber}[m.color]||T.accent}}>{m.value}</div>
            <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:8,color:T.muted,
              letterSpacing:"0.5px",marginTop:3,lineHeight:1.3}}>{m.label}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {[
          metrics.avgEnergy!==null && {label:"AVG ENERGY", value:`${metrics.avgEnergy}/5`, color:metrics.avgEnergy>=4?"green":"accent"},
          {label:"CHECK-INS", value:`${metrics.checkinPct}%`, color:metrics.checkinPct>=70?"green":"amber"},
          {label:"FW SESSIONS", value:metrics.fwUsed, color:"purple"},
        ].filter(Boolean).map(m=>(
          <div key={m.label} style={{flex:1,background:T.surface,borderRadius:14,padding:"14px 10px",
            border:`1px solid ${T.border}`,textAlign:"center"}}>
            <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:18,fontWeight:700,
              color:{accent:T.accent,green:T.green,amber:T.amber,purple:T.purple}[m.color]||T.accent}}>{m.value}</div>
            <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:8,color:T.muted,
              letterSpacing:"0.5px",marginTop:3,lineHeight:1.3}}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* AI Report */}
      <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:10,letterSpacing:"1.5px",
        color:T.muted,marginBottom:10}}>AI PERFORMANCE REPORT</div>

      {!report && !loading && (
        <div style={{background:T.surface,borderRadius:16,padding:"24px",border:`1px solid ${T.border}`,
          textAlign:"center",marginBottom:16}}>
          <div style={{fontSize:36,marginBottom:12}}>📈</div>
          <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:11,color:T.text,marginBottom:8}}>
            GENERATE YOUR PERFORMANCE REPORT
          </div>
          <div style={{fontSize:13,color:T.muted,lineHeight:1.6,marginBottom:16}}>
            AI will analyze your last {days} days of work data and generate a detailed report covering strengths, improvement areas, a workflow health score, and a 30/60/90 day outlook.
          </div>
          <button onClick={generate} style={{background:T.accent,color:"#fff",border:"none",borderRadius:12,
            padding:"13px 24px",fontFamily:"'Unbounded',sans-serif",fontSize:11,letterSpacing:"1px",
            fontWeight:600,cursor:"pointer"}}>
            GENERATE REPORT
          </button>
        </div>
      )}

      {loading && (
        <div style={{textAlign:"center",padding:"48px 0",color:T.muted}}>
          <div style={{fontSize:36,marginBottom:12}}>📈</div>
          <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:11,letterSpacing:1,color:T.accent}}>
            GENERATING REPORT...
          </div>
          <div style={{fontSize:13,marginTop:8}}>Analyzing {days} days of work data</div>
        </div>
      )}

      {report && !loading && (() => {
        const score = extractScore(report);
        const sc    = score ? scoreColor(score) : "accent";
        const scoreCol = {green:T.green,accent:T.accent,amber:T.amber,red:T.red}[sc]||T.accent;
        return (
          <div>
            {/* Health score */}
            {score && (
              <div style={{background:`linear-gradient(135deg,${T.surface},${T.surface2})`,
                borderRadius:16,padding:"20px",border:`1px solid ${T.border}`,marginBottom:12,
                display:"flex",alignItems:"center",gap:20}}>
                <div style={{position:"relative",flexShrink:0}}>
                  <ProgressRing T={T} progress={score} color={sc} size={72}/>
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",
                    justifyContent:"center",flexDirection:"column"}}>
                    <span style={{fontFamily:"'Unbounded',sans-serif",fontSize:16,fontWeight:700,color:scoreCol}}>{score}</span>
                    <span style={{fontFamily:"'Unbounded',sans-serif",fontSize:7,color:T.muted}}>/ 100</span>
                  </div>
                </div>
                <div>
                  <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:12,fontWeight:700,color:T.text,marginBottom:4}}>
                    WORKFLOW HEALTH SCORE
                  </div>
                  <div style={{fontSize:12,color:T.muted,lineHeight:1.5}}>
                    {score>=80?"Excellent":score>=60?"Good":score>=40?"Developing":"Needs focus"} — based on {days} days of data
                  </div>
                </div>
              </div>
            )}

            {/* Sections */}
            {[
              {key:"EXECUTIVE SUMMARY",     icon:"📋", color:"accent"},
              {key:"STRENGTHS THIS PERIOD", icon:"💪", color:"green"},
              {key:"IMPROVEMENT AREAS",     icon:"🎯", color:"amber"},
              {key:"30/60/90 DAY OUTLOOK",  icon:"🔭", color:"purple"},
              {key:"TOP 5 RECOMMENDED ACTIONS", icon:"✅", color:"accent"},
            ].map(({key,icon,color})=>{
              const text = parseSection(report, key);
              if (!text) return null;
              const borderMap = {accent:T.accent,green:T.green,amber:T.amber,purple:T.purple};
              return (
                <div key={key} style={{background:T.surface,borderRadius:14,padding:"16px",
                  border:`1px solid ${T.border}`,borderLeft:`3px solid ${borderMap[color]||T.accent}`,
                  marginBottom:10,display:"flex",gap:12}}>
                  <span style={{fontSize:20,flexShrink:0,marginTop:1}}>{icon}</span>
                  <div>
                    <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:11,fontWeight:600,
                      color:T.text,marginBottom:6}}>{key}</div>
                    <div style={{fontSize:13,color:T.muted,lineHeight:1.6,whiteSpace:"pre-line"}}>{text}</div>
                  </div>
                </div>
              );
            })}

            <button onClick={generate} style={{width:"100%",background:"none",border:`1px solid ${T.border}`,
              borderRadius:12,padding:"12px",fontFamily:"'Unbounded',sans-serif",fontSize:10,
              letterSpacing:"1px",color:T.muted,cursor:"pointer",marginTop:4}}>
              ↺ REGENERATE
            </button>
            <div style={{height:16}}/>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Goals List View ───────────────────────────────────────────
function GoalsView({ T, goals, situations, checkins, onSetGoals, settings, onShowReport }) {
  const [modal,    setModal]    = useState(false);
  const [editing,  setEditing]  = useState(null);

  const addGoal = (goal) => {
    const next = [goal, ...goals.filter(g=>g.id!==goal.id)];
    onSetGoals(next);
    setModal(false);
    setEditing(null);
  };

  const deleteGoal = (id) => {
    onSetGoals(goals.filter(g=>g.id!==id));
  };

  const updateCustom = (id, val) => {
    onSetGoals(goals.map(g => g.id===id ? {...g, currentValue:val} : g));
  };

  const active   = goals.filter(g=>g.status==="active");
  const achieved = goals.filter(g=>g.status==="completed");

  return (
    <div style={{padding:"0 16px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 0 16px"}}>
        <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:10,letterSpacing:"1.5px",color:T.muted}}>
          ACTIVE GOALS
        </div>
        <button onClick={()=>{setEditing(null);setModal(true);}} style={{
          background:T.accent,color:"#fff",border:"none",borderRadius:10,padding:"8px 14px",
          fontFamily:"'Unbounded',sans-serif",fontSize:10,letterSpacing:"1px",fontWeight:600,cursor:"pointer",
        }}>+ ADD</button>
      </div>

      {active.length===0 ? (
        <div style={{background:T.surface,borderRadius:16,padding:"32px 20px",border:`1px solid ${T.border}`,
          textAlign:"center",marginBottom:12}}>
          <div style={{fontSize:36,marginBottom:12}}>🎯</div>
          <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:11,color:T.text,letterSpacing:"0.5px",marginBottom:8}}>
            NO ACTIVE GOALS
          </div>
          <div style={{fontSize:13,color:T.muted,lineHeight:1.6,marginBottom:16}}>
            Set growth goals to track your progress over 30, 60, or 90 days.
          </div>
          <button onClick={()=>setModal(true)} style={{background:T.accent,color:"#fff",border:"none",
            borderRadius:10,padding:"11px 20px",fontFamily:"'Unbounded',sans-serif",fontSize:10,
            letterSpacing:"1px",fontWeight:600,cursor:"pointer"}}>
            SET YOUR FIRST GOAL
          </button>
        </div>
      ) : (
        active.map(goal=>{
          const {value, progress, trend} = computeGoalProgress(goal, situations, checkins);
          return (
            <GoalCard key={goal.id} T={T} goal={goal} value={value} progress={progress} trend={trend}
              onEdit={()=>{setEditing(goal);setModal(true);}}
              onDelete={()=>deleteGoal(goal.id)}
              onUpdateCustom={(v)=>updateCustom(goal.id,v)}/>
          );
        })
      )}

      {/* Report CTA */}
      <button onClick={onShowReport} style={{
        width:"100%",background:T.purpleDim,border:`1px solid ${T.purple}40`,borderRadius:14,
        padding:"16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",marginBottom:16,
      }}>
        <span style={{fontSize:28}}>📈</span>
        <div style={{textAlign:"left"}}>
          <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:11,fontWeight:600,
            color:T.purple,letterSpacing:"0.5px"}}>PERFORMANCE REPORT</div>
          <div style={{fontSize:12,color:T.muted,marginTop:2}}>
            AI-generated 30/60/90 day analysis
          </div>
        </div>
        <svg style={{marginLeft:"auto"}} width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke={T.purple} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>

      {achieved.length>0 && (
        <div>
          <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:10,letterSpacing:"1.5px",
            color:T.muted,marginBottom:10}}>ACHIEVED</div>
          {achieved.map(goal=>{
            const {value,progress,trend}=computeGoalProgress(goal,situations,checkins);
            return <GoalCard key={goal.id} T={T} goal={goal} value={value} progress={progress} trend={trend}
              onEdit={()=>{setEditing(goal);setModal(true);}} onDelete={()=>deleteGoal(goal.id)}
              onUpdateCustom={(v)=>updateCustom(goal.id,v)}/>;
          })}
        </div>
      )}

      {modal && (
        <GoalModal T={T} onClose={()=>{setModal(false);setEditing(null);}}
          onSave={addGoal} existing={editing}/>
      )}
    </div>
  );
}

// ─── Weekly Retro View (imported from RetroScreen logic) ────────
import RetroScreen from "./RetroScreen.jsx";

// ─── Main GrowthScreen ─────────────────────────────────────────
export default function GrowthScreen({ T, settings }) {
  const [view,       setView]       = useState("weekly"); // "weekly" | "goals" | "report"
  const [goals,      setGoals]      = useState(() => loadGoals());
  const [situations, setSituations] = useState([]);
  const [checkins,   setCheckins]   = useState([]);

  useEffect(() => {
    Promise.all([dbGetAll("situations"), dbGetAll("checkins")]).then(([sits, checks]) => {
      setSituations(sits);
      setCheckins(checks);
    });
  }, []);

  const handleSetGoals = (next) => {
    setGoals(next);
    saveGoals(next);
  };

  const VIEWS = [
    { id:"weekly", label:"WEEKLY"  },
    { id:"goals",  label:"GOALS"   },
  ];

  if (view === "report") {
    return (
      <ReportView T={T} settings={settings} situations={situations}
        checkins={checkins} goals={goals} onBack={()=>setView("goals")}/>
    );
  }

  return (
    <div>
      {/* Header + view toggle */}
      <div style={{padding:"20px 16px 0"}}>
        <h1 style={{fontFamily:"'Unbounded',sans-serif",fontSize:26,fontWeight:700,
          color:T.text,margin:"0 0 16px",lineHeight:1.1}}>GROWTH</h1>
        <div style={{display:"flex",background:T.surface2,borderRadius:12,padding:4,marginBottom:20,
          border:`1px solid ${T.border}`}}>
          {VIEWS.map(v=>(
            <button key={v.id} onClick={()=>setView(v.id)} style={{
              flex:1,padding:"9px",borderRadius:9,border:"none",cursor:"pointer",
              background:view===v.id?T.surface:"transparent",
              color:view===v.id?T.text:T.muted,
              fontFamily:"'Unbounded',sans-serif",fontSize:10,letterSpacing:"0.8px",fontWeight:600,
              boxShadow:view===v.id?(T.mode==="light"?"0 1px 6px rgba(26,29,78,0.08)":"0 1px 6px rgba(0,0,0,0.3)"):"none",
              transition:"all 0.15s",
            }}>{v.label}</button>
          ))}
        </div>
      </div>

      {view === "weekly" && <RetroScreen T={T} settings={settings} hideHeader />}
      {view === "goals"  && (
        <GoalsView T={T} goals={goals} situations={situations}
          checkins={checkins} onSetGoals={handleSetGoals}
          settings={settings} onShowReport={()=>setView("report")}/>
      )}
    </div>
  );
}
