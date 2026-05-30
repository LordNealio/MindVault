import { useState, useRef, useEffect, useCallback, Component } from "react";
import { AutomationWorkspace } from "./features/automation/AutomationWorkspace.jsx";
import { ThroneTalk } from "./features/throne-talk/ThroneTalk.jsx";
import { Jarvis } from "./features/jarvis/Jarvis.jsx";
import { VaultScreen as JarvisVault } from "./features/jarvis/VaultUpload.jsx";
import { MindGamesWorkspace } from "./features/mindgames/MindGamesWorkspace.jsx";
import { StartMode } from "./features/startmode/StartMode.jsx";
import { BoxBreathing } from "./features/breathe/BoxBreathing.jsx";
import { VideoSlideshow } from "./features/meditation/VideoSlideshow.jsx";
import { MeditationSlideshow } from "./features/meditation/MeditationSlideshow.jsx";
import { PinLock, PinSetup } from "./features/pinlock/PinLock.jsx";
import { OnboardingFlow } from "./features/onboarding/OnboardingFlow.jsx";
import { GuideModal } from "./features/guide/GuideModal.jsx";
import { CustomQuestionsManager, CustomQuestionsSection } from "./features/questions/CustomQuestionsManager.jsx";
import { isSectionVisible } from "./features/questions/customQuestions.js";
import { trackEvent } from "./lib/metrics.js";
import { MetricsScreen } from "./features/MetricsScreen.jsx";

// ── FONTS ─────────────────────────────────────────────────
(() => {
  const l = document.createElement("link"); l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Unbounded:wght@400;700;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap";
  document.head.appendChild(l);
})();

// ── DESIGN TOKENS ─────────────────────────────────────────
const D = {
  bg:"#F0EDE5", white:"#FAFAF7", bl:"#1D3557", rd:"#C1121F",
  yl:"#E8B84B", bk:"#0A0A0A", muted:"#9B9589", border:"#E8E4DA",
  shadow:"rgba(0,0,0,0.08)", r:18,
};

// ── GLOBAL CSS ────────────────────────────────────────────
(() => {
  const s = document.createElement("style");
  s.textContent = `
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html,body{background:${D.bg};font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:${D.bk};-webkit-font-smoothing:antialiased}
    ::-webkit-scrollbar{width:0}
    input,textarea{font-family:inherit;-webkit-appearance:none;outline:none;background:transparent;border:none;color:${D.bk};resize:none;width:100%}
    input::placeholder,textarea::placeholder{color:${D.muted};font-style:italic}
    button{font-family:inherit;cursor:pointer;border:none;background:none;-webkit-tap-highlight-color:transparent}
    button:active{opacity:.75;transform:scale(.97)}
    @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes wave{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}
    @keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
    .fu{animation:fadeUp .4s cubic-bezier(.16,1,.3,1) both}
  `;
  document.head.appendChild(s);
})();

// ── UTILS ─────────────────────────────────────────────────
const toISO   = () => new Date().toISOString().slice(0,10);
const fmtDate = d  => new Date(d+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
const fmtFull = () => new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
const greet   = () => { const h=new Date().getHours(); return h<12?"MORNING":h<17?"AFTERNOON":"EVENING"; };
const nowTime = () => new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});

const calcStreak = entries => {
  if (!entries.length) return 0;
  const dates = new Set(entries.map(e => e.date));
  let s=0, d=new Date();
  if (!dates.has(toISO())) d.setDate(d.getDate()-1);
  while (dates.has(d.toISOString().slice(0,10))) { s++; d.setDate(d.getDate()-1); }
  return s;
};

// ── MEMORY CONTEXT BUILDER ────────────────────────────────
// Compact formatter — turns raw entries into a token-efficient
// text block Claude can read as "memory" for any AI call.
function buildMemoryContext(entries, max=21) {
  const recent = [...entries]
    .sort((a,b)=>b.date.localeCompare(a.date))
    .slice(0,max);
  if (!recent.length) return "";
  return recent.map(e=>{
    const p=[];
    if (e.morning?.identity)    p.push(`identity:${e.morning.identity}`);
    if (e.morning?.thankfulFor) p.push(`grateful:${e.morning.thankfulFor}`);
    if (e.morning?.journal)     p.push(`morning:${e.morning.journal.slice(0,120)}`);
    if (e.morning?.loveAction)  p.push(`love:${e.morning.loveAction}`);
    const goals=(e.evening?.goals||[]).filter(g=>g.t).map(g=>g.t);
    if (goals.length)           p.push(`goals:${goals.join(";")}`);
    if (e.evening?.feel1)       p.push(`felt:${e.evening.feel1}`);
    if (e.evening?.feel2)       p.push(`also:${e.evening.feel2}`);
    if (e.evening?.learned)     p.push(`learned:${e.evening.learned}`);
    if (e.evening?.memory)      p.push(`memory:${e.evening.memory}`);
    if (e.evening?.growthQ)     p.push(`growth:${e.evening.growthQ}`);
    return p.length ? `${e.date}: ${p.join(" | ")}` : null;
  }).filter(Boolean).join("\n");
}

const calcLongestStreak = entries => {
  if (!entries.length) return 0;
  const sorted = [...entries].map(e => e.date).sort();
  let longest=1, current=1;
  for (let i=1; i<sorted.length; i++) {
    const diff = Math.round(
      (new Date(sorted[i]+"T12:00:00") - new Date(sorted[i-1]+"T12:00:00")) / 86400000
    );
    if (diff===1) { current++; if (current>longest) longest=current; }
    else if (diff>1) current=1;
  }
  return longest;
};

// ── Streak milestones ─────────────────────────────────────
const MILESTONES    = [3,7,14,21,30,60,90,100,365];
const MS_ACK_KEY    = "mv_milestone_ack";
const MS_MSGS = {
  3:  { emoji:"🌱", text:"3-Day Streak!",   sub:"The seed has been planted." },
  7:  { emoji:"🔥", text:"7-Day Streak!",   sub:"One full week of showing up." },
  14: { emoji:"⚡", text:"2-Week Streak!",  sub:"You're building something real." },
  21: { emoji:"💪", text:"21 Days!",        sub:"That's a habit now." },
  30: { emoji:"🏆", text:"30-Day Streak!",  sub:"One month. Unbroken." },
  60: { emoji:"🎯", text:"60-Day Streak!",  sub:"Two months of discipline." },
  90: { emoji:"🌟", text:"90 Days!",        sub:"Three months. You're a different person." },
  100:{ emoji:"💎", text:"100-Day Streak!", sub:"1 in 1000 do what you've done." },
  365:{ emoji:"👑", text:"365 Days!",       sub:"A full year. Legendary." },
};
const getNewMilestone = streak => {
  const acked = LS.get(MS_ACK_KEY) || 0;
  return [...MILESTONES].reverse().find(m => streak >= m && m > acked) || null;
};

// ── AI HOME INSIGHTS (cached) ─────────────────────────────
const INSIGHTS_CACHE_KEY = "mv_ai_insights_cache";

async function generateHomeInsights(apiKey, entries) {
  if (!apiKey || entries.length < 3) return null;
  const today  = toISO();
  const cached = LS.get(INSIGHTS_CACHE_KEY);
  if (cached?.date===today && cached?.count===entries.length && cached?.insights?.length)
    return cached.insights;

  const ctx = buildMemoryContext(entries, 21);
  if (!ctx) return null;

  const raw = await aiCall(
    apiKey,
    [{ role:"user", content:`My recent journal entries:\n\n${ctx}\n\nFind 2 patterns.` }],
    `You are a personal growth AI reading someone's journal entries.
Find exactly 2 specific, honest patterns in their data.
- Reference actual words, themes, or names they wrote — not generic advice.
- Each insight is 1-2 plain sentences.
- Be warm but direct. No bullet characters.
Return ONLY valid JSON: {"insights":["...","..."]}`,
    320
  );
  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g,"").trim());
    const result = Array.isArray(parsed.insights) ? parsed.insights.slice(0,2) : null;
    if (result?.length) LS.set(INSIGHTS_CACHE_KEY,{date:today,count:entries.length,insights:result});
    return result;
  } catch { return null; }
}

// ── LOCALSTORAGE — settings only ──────────────────────────
const LS = {
  get: k   => { try{const v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch{return null;} },
  set: (k,v)=> { try{localStorage.setItem(k,JSON.stringify(v));}catch{} },
  del: k   => { try{localStorage.removeItem(k);}catch{} },
};

// ── INDEXEDDB STORAGE LAYER ───────────────────────────────
const IDB_NAME    = "mindvault_v1";
const IDB_VERSION = 1;
const S = { entries:"entries", manifest:"backupManifest" };
let _db = null;

const openDB = () => new Promise((res, rej) => {
  if (_db) { res(_db); return; }
  const req = indexedDB.open(IDB_NAME, IDB_VERSION);
  req.onupgradeneeded = e => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains(S.entries))  db.createObjectStore(S.entries,  { keyPath:"date" });
    if (!db.objectStoreNames.contains(S.manifest)) db.createObjectStore(S.manifest, { keyPath:"id"   });
  };
  req.onsuccess = e => { _db = e.target.result; res(_db); };
  req.onerror   = e => rej(e.target.error);
});

const idb = {
  async get(store, key) {
    const db = await openDB();
    return new Promise((res,rej) => {
      const req = db.transaction(store,"readonly").objectStore(store).get(key);
      req.onsuccess = () => res(req.result || null);
      req.onerror   = () => rej(req.error);
    });
  },
  async set(store, value) {
    const db = await openDB();
    return new Promise((res,rej) => {
      const req = db.transaction(store,"readwrite").objectStore(store).put(value);
      req.onsuccess = () => res(req.result);
      req.onerror   = () => rej(req.error);
    });
  },
  async getAll(store) {
    const db = await openDB();
    return new Promise((res,rej) => {
      const req = db.transaction(store,"readonly").objectStore(store).getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror   = () => rej(req.error);
    });
  },
  async del(store, key) {
    const db = await openDB();
    return new Promise((res,rej) => {
      const req = db.transaction(store,"readwrite").objectStore(store).delete(key);
      req.onsuccess = () => res();
      req.onerror   = () => rej(req.error);
    });
  },
};

// ── ONE-TIME MIGRATION: localStorage → IndexedDB ──────────
const migrateFromLS = async () => {
  if (LS.get("mv3_idb_migrated")) return 0;
  const oldKeys = Object.keys(localStorage).filter(k => /^mv3_\d{4}-\d{2}-\d{2}$/.test(k));
  let moved = 0;
  for (const k of oldKeys) {
    const entry = LS.get(k);
    if (entry?.date) { await idb.set(S.entries, entry); moved++; }
  }
  LS.set("mv3_idb_migrated", true);
  if (moved > 0) oldKeys.forEach(k => LS.del(k));
  return moved;
};

// ── BACKUP MANIFEST ───────────────────────────────────────
const SCHEMA_VER = "1.0";
const getManifest = () => idb.get(S.manifest, "main");

const updateManifest = async (entries, didExport=false) => {
  const prev = await getManifest();
  await idb.set(S.manifest, {
    id:"main", schemaVersion:SCHEMA_VER, totalEntries:entries.length,
    latestEntryDate:entries[0]?.date||null,
    lastExportAt:didExport?new Date().toISOString():(prev?.lastExportAt||null),
    entriesAtLastReminder:didExport?entries.length:(prev?.entriesAtLastReminder??entries.length),
    updatedAt:new Date().toISOString(),
  });
};

const shouldRemindBackup = async entries => {
  const m = await getManifest();
  if (!m) return false;
  return (entries.length - (m.entriesAtLastReminder ?? m.totalEntries)) >= 10;
};

const snoozeReminder = async entries => {
  const m = await getManifest();
  if (!m) return;
  await idb.set(S.manifest, { ...m, entriesAtLastReminder: entries.length });
};

// ── VERSIONED EXPORT ──────────────────────────────────────
const doExport = async entries => {
  const vaultData = LS.get("j_vault") || [];
  const ttData = {};
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("tt_")) {
      try { ttData[key.slice(3)] = JSON.parse(localStorage.getItem(key)); } catch {}
    }
  }
  const payload = {
    version:SCHEMA_VER, exportedAt:new Date().toISOString(), appName:"MindVault AI",
    payload:{ entryCount:entries.length, entries, vault:vaultData, throneTalk:ttData },
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `mindvault-backup-${toISO()}.json`;
  a.click();
  await updateManifest(entries, true);
};

// ── IMPORT / RESTORE ──────────────────────────────────────
const doImport = (file, mode) => new Promise((res, rej) => {
  const reader = new FileReader();
  reader.onerror = () => rej("Could not read the file. Please try again.");
  reader.onload  = async e => {
    let parsed;
    try { parsed = JSON.parse(e.target.result); }
    catch { rej("Invalid file — could not parse JSON."); return; }
    if (!parsed.version || !parsed.payload?.entries) {
      rej("This doesn't look like a MindVault backup file."); return;
    }
    if (!Array.isArray(parsed.payload.entries)) {
      rej("Backup file is corrupt — entries is not an array."); return;
    }
    const incoming = parsed.payload.entries.filter(e => e?.date);
    if (!incoming.length) { rej("No valid entries found in this backup."); return; }
    try {
      if (mode === "replace") {
        const existing = await idb.getAll(S.entries);
        for (const e of existing) await idb.del(S.entries, e.date);
      }
      for (const entry of incoming) await idb.set(S.entries, entry);
      if (parsed.payload.vault) LS.set("j_vault", parsed.payload.vault);
      if (parsed.payload.throneTalk) {
        for (const [k, v] of Object.entries(parsed.payload.throneTalk)) {
          try { localStorage.setItem("tt_" + k, JSON.stringify(v)); } catch {}
        }
      }
      res(incoming.length);
    } catch(err) { rej(`Import failed: ${err.message || err}`); }
  };
  reader.readAsText(file);
});

// ── PHOTO COMPRESSION ─────────────────────────────────────
const compressPhoto = file => new Promise((res,rej) => {
  const img=new Image(), url=URL.createObjectURL(file);
  img.onload = () => {
    const MAX=900, c=document.createElement("canvas");
    let w=img.width, h=img.height;
    if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}
    c.width=w; c.height=h;
    c.getContext("2d").drawImage(img,0,0,w,h);
    URL.revokeObjectURL(url);
    res({dataUrl:c.toDataURL("image/jpeg",.72),type:"image/jpeg"});
  };
  img.onerror=rej; img.src=url;
});

const readPhoto = async file => {
  const c = await compressPhoto(file);
  return {...c, base64:c.dataUrl.split(",")[1], name:file.name};
};

// ── DEFAULT SHAPES ────────────────────────────────────────
const newMorning = () => ({
  startTime:"",idMode:"am",identity:"",
  thankfulFor:"",thankfulBecause:"",
  exercise:false,water:false,meditation:false,nutrition:false,
  journal:"",loveAction:"",
  visSee:"",visHear:"",visSmell:"",visTaste:"",visFeel:"",visInside:"",
  photos:[],customAnswers:{},
});
const newEvening = () => ({
  goals:[{t:"",et:"",done:false},{t:"",et:"",done:false},{t:"",et:"",done:false},{t:"",et:"",done:false}],
  feel1:"",feel2:"",learned:"",appreciate:"",ideas:"",memory:"",growthQ:"",
  noFood:false,meds:0,bedTime:false,breathe:false,photos:[],customAnswers:{},
});

// ── AI SERVICE ────────────────────────────────────────────
const MODEL = "claude-sonnet-4-6";

async function aiCall(apiKey, messages, system, maxTokens=900) {
  const r = await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "x-api-key":apiKey,
      "anthropic-version":"2023-06-01",
      "anthropic-dangerous-direct-browser-access":"true",
    },
    body:JSON.stringify({model:MODEL,max_tokens:maxTokens,system,messages}),
  });
  const d = await r.json();
  if(d.error) throw new Error(d.error.message);
  return d.content.map(b=>b.text||"").join("");
}

async function analyzeEntry(apiKey, text, memCtx="") {
  if(!apiKey){await new Promise(r=>setTimeout(r,600)); return {tone:"reflective",themes:["growth"]};}
  const mem = memCtx
    ? `\n\nUSER'S RECENT HISTORY:\n${memCtx}\n\nNote recurring themes or patterns when relevant.`
    : "";
  const raw = await aiCall(apiKey,[{role:"user",content:text}],
    `Analyze this journal entry. Return ONLY valid JSON: {"tone":string,"themes":string[]}${mem}`);
  try{return JSON.parse(raw.replace(/```json|```/g,"").trim());}
  catch{return {tone:"neutral",themes:[]};}
}

async function extractFromPhotos(apiKey, photos) {
  if(!apiKey){
    await new Promise(r=>setTimeout(r,2000));
    return {demo:true,startTime:"7:00 AM",identity:"free",thankfulFor:"my dreams",
      thankfulBecause:"they give me perspective and inspiration",
      journal:"Just do it. Be who you want. Be free.",
      loveAction:"Be love",feel1:"expressive",feel2:"grateful",
      learned:"Surrendering to the now while giving all to the present.",
      appreciate:"Zi and all she does",memory:"Zi wearing the blue dress — so beautiful.",
      growthQ:"What would it look like to fully trust the process?"};
  }
  const content = [
    ...photos.map(p=>({type:"image",source:{type:"base64",media_type:p.type,data:p.base64}})),
    {type:"text",text:`Extract all handwritten text from this journal template into JSON with keys:
startTime, identity (after "I AM"/"I FEEL"), thankfulFor, thankfulBecause, journal, loveAction,
visSee, visHear, visSmell, visTaste, visFeel, visInside,
goals (array of {t,et}), feel1, feel2, learned, appreciate, ideas, memory, growthQ,
noFood(bool), meds(number), bedTime(bool), breathe(bool).
Return ONLY valid JSON. Null for blank fields.`}
  ];
  const raw = await aiCall(apiKey,[{role:"user",content}],
    `Expert OCR for handwritten journals. Return only valid JSON.`,1400);
  try{return JSON.parse(raw.replace(/```json|```/g,"").trim());}
  catch{return null;}
}

async function cleanTranscript(apiKey, text) {
  if(!apiKey||!text.trim()) return text;
  return (await aiCall(apiKey,
    [{role:"user",content:`Clean this voice transcript — fix punctuation, remove fillers (um,uh,like):\n\n${text}`}],
    `Clean voice transcripts. Return only the cleaned text.`,500)).trim()||text;
}

// ── PRIMITIVES ────────────────────────────────────────────
const Spinner = ({size=16,color=D.bk}) => (
  <div style={{width:size,height:size,border:`2px solid ${color}33`,borderTopColor:color,
    borderRadius:"50%",animation:"spin .7s linear infinite",flexShrink:0}}/>
);

const AccentStrip = () => (
  <div style={{display:"flex",height:2.5}}>
    <div style={{flex:3.5,background:D.bl}}/><div style={{flex:.8,background:D.rd}}/><div style={{flex:.5,background:D.yl}}/>
  </div>
);

const Card = ({children,accent,style={}}) => (
  <div style={{background:D.white,borderRadius:D.r,boxShadow:`0 3px 16px ${D.shadow}`,
    overflow:"hidden",...(accent?{borderTop:`4px solid ${accent}`}:{}),...style}}>
    {children}
  </div>
);

const SLabel = ({children,color=D.bk,style={}}) => (
  <div style={{fontFamily:"'Unbounded',monospace",fontSize:8,fontWeight:700,
    letterSpacing:".14em",textTransform:"uppercase",color,...style}}>
    {children}
  </div>
);

const Field = ({value,onChange,placeholder,rows=1,style={}}) => {
  const Tag = rows>1?"textarea":"input";
  return <Tag value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    rows={rows>1?rows:undefined}
    style={{fontSize:14,lineHeight:1.65,width:"100%",
      borderBottom:rows===1?`1px solid ${D.border}`:"none",
      paddingBottom:rows===1?3:0,...style}}/>;
};

const CheckItem = ({label,checked,onChange}) => (
  <label style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer"}}>
    <div onClick={()=>onChange(!checked)} style={{width:18,height:18,border:`2px solid ${checked?D.bk:D.border}`,
      borderRadius:4,flexShrink:0,background:checked?D.bk:"transparent",
      display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}>
      {checked&&<span style={{color:"#fff",fontSize:10,fontWeight:700,lineHeight:1}}>✓</span>}
    </div>
    {label&&<span style={{fontSize:12,fontWeight:500}}>{label}</span>}
  </label>
);

// ── MILESTONE BANNER ──────────────────────────────────────
function MilestoneBanner({ streak, onDismiss }) {
  const m = getNewMilestone(streak);
  if (!m) return null;
  const { emoji, text, sub } = MS_MSGS[m];
  return (
    <div style={{
      background:`linear-gradient(135deg,${D.bk} 0%,#1a1a2e 100%)`,
      borderRadius:16,padding:"16px 18px",
      display:"flex",alignItems:"center",gap:14,
      boxShadow:"0 8px 30px rgba(0,0,0,0.3)",
      border:`1px solid ${D.yl}44`,position:"relative",
      animation:"fadeUp .5s cubic-bezier(.16,1,.3,1) both",
    }}>
      <div style={{fontSize:38,flexShrink:0,lineHeight:1}}>{emoji}</div>
      <div style={{flex:1}}>
        <div style={{fontFamily:"'Unbounded',monospace",fontSize:14,fontWeight:900,
          color:D.yl,letterSpacing:".04em",marginBottom:3}}>{text}</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,.6)",lineHeight:1.5}}>{sub}</div>
      </div>
      <button onClick={onDismiss}
        style={{position:"absolute",top:10,right:12,
          fontSize:18,color:"rgba(255,255,255,.35)",lineHeight:1,
          cursor:"pointer",fontWeight:300}}>×</button>
    </div>
  );
}

// ── AI INSIGHTS CARD ──────────────────────────────────────
function AIInsightsCard({ apiKey, entries, streak }) {
  const [insights, setInsights] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [ready,    setReady]    = useState(false);

  useEffect(()=>{
    if (ready) return;
    setReady(true);
    if (entries.length < 3) return;

    if (!apiKey) {
      // Static fallback when no API key
      const s=[];
      if (streak>=3)                        s.push(`🔥 ${streak}-day streak — keep going.`);
      const te=entries[0];
      if (te?.morning?.identity)            s.push(`Today: I AM ${te.morning.identity}`);
      if (te?.evening?.memory)              s.push(`Last memory: "${te.evening.memory.slice(0,55)}${te.evening.memory.length>55?"…":""}"`);
      if (s.length) setInsights(s);
      return;
    }

    setLoading(true);
    generateHomeInsights(apiKey, entries)
      .then(ins => { if (ins?.length) setInsights(ins); })
      .catch(()=>{
        // Silent fail — no error shown for background insight generation
        const te=entries[0];
        const s=[];
        if (streak>=3)           s.push(`🔥 ${streak}-day streak — keep going.`);
        if (te?.morning?.identity) s.push(`Today: I AM ${te.morning.identity}`);
        if (s.length) setInsights(s);
      })
      .finally(()=>setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[entries.length, apiKey]);

  if (entries.length < 3) return null;

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        <SLabel>INSIGHTS</SLabel>
        {loading && <Spinner size={10} color={D.muted}/>}
      </div>
      {loading && !insights && (
        <Card style={{borderLeft:`3px solid ${D.yl}`}}>
          <div style={{padding:"10px 14px"}}>
            <p style={{fontSize:12,color:D.muted,fontStyle:"italic"}}>Reading your patterns…</p>
          </div>
        </Card>
      )}
      {insights?.map((ins,i)=>(
        <Card key={i} style={{marginBottom:8,borderLeft:`3px solid ${[D.yl,D.bl][i%2]}`}}>
          <div style={{padding:"10px 14px"}}>
            <p style={{fontSize:13,lineHeight:1.65,color:"#444"}}>{ins}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── STREAK CALENDAR ───────────────────────────────────────
function StreakCalendar({ entries, longestStreak }) {
  const [open, setOpen] = useState(false);

  // Build date→status map
  const eMap = {};
  entries.forEach(e => {
    eMap[e.date] = {
      m: !!(e.morning?.identity || e.morning?.journal),
      ev: !!(e.evening?.feel1 || e.evening?.learned),
    };
  });

  // 5-week grid starting from the Sunday 4 full weeks before this Sunday
  const todayMs = new Date(); todayMs.setHours(12,0,0,0);
  const todayISO = todayMs.toISOString().slice(0,10);
  const gridStart = new Date(todayMs);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay() - 28); // 5 Sundays back

  const cells = Array.from({length:35},(_,i)=>{
    const d = new Date(gridStart); d.setDate(d.getDate()+i);
    const iso = d.toISOString().slice(0,10);
    return { iso, future: iso>todayISO, today: iso===todayISO, st: eMap[iso] };
  });

  const col = ({future,st}) => {
    if (future) return "#E8E4DA";
    if (!st) return "#E8E4DA";
    if (st.m && st.ev) return D.rd;
    if (st.m) return D.yl;
    if (st.ev) return D.bl;
    return "#E8E4DA";
  };

  const DOW = ["S","M","T","W","T","F","S"];

  return (
    <div style={{background:D.white,borderRadius:D.r,boxShadow:`0 3px 16px rgba(0,0,0,0.08)`}}>
      {/* Tappable header */}
      <button
        type="button"
        onClick={()=>setOpen(o=>!o)}
        style={{width:"100%",display:"flex",alignItems:"center",
          justifyContent:"space-between",padding:"14px 16px",
          background:"none",border:"none",cursor:"pointer",textAlign:"left",
          borderRadius:D.r}}>
        <SLabel>JOURNAL CALENDAR</SLabel>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{textAlign:"right"}}>
            <div style={{fontFamily:"'Unbounded',monospace",fontSize:8,color:D.muted,letterSpacing:".06em"}}>BEST</div>
            <div style={{fontFamily:"'Unbounded',monospace",fontSize:13,fontWeight:900,color:D.bl}}>{longestStreak}</div>
          </div>
          <span style={{fontSize:12,color:D.muted,lineHeight:1,
            display:"inline-block",
            transform:open?"rotate(180deg)":"rotate(0deg)",
            transition:"transform .2s"}}>▾</span>
        </div>
      </button>

      {/* Collapsible body */}
      {open&&(
        <div style={{padding:"0 16px 14px",borderTop:`1px solid ${D.border}`}}>
          {/* Day-of-week headers */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginTop:12,marginBottom:3}}>
            {DOW.map((d,i)=>(
              <div key={i} style={{fontFamily:"'Unbounded',monospace",fontSize:6,fontWeight:700,
                color:D.muted,textAlign:"center",paddingBottom:1}}>{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
            {cells.map((cell,i)=>(
              <div key={i} style={{
                aspectRatio:"1/1",borderRadius:3,
                background:col(cell),
                opacity:cell.future?0.25:1,
                outline:cell.today?`2px solid ${D.bk}`:"none",
                outlineOffset:1,
              }}/>
            ))}
          </div>

          {/* Legend */}
          <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:10}}>
            {[{c:D.rd,l:"Both"},{c:D.yl,l:"Morning"},{c:D.bl,l:"Evening"},{c:"#E8E4DA",l:"None"}].map(({c,l})=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:8,height:8,borderRadius:2,background:c,
                  border:l==="None"?`1px solid ${D.border}`:"none",flexShrink:0}}/>
                <span style={{fontSize:9,color:D.muted}}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── PHOTO UPLOAD — iOS PWA FIX ────────────────────────────
// Dynamically creates inputs to avoid iOS standalone white-screen bug
function PhotoUpload({photos,setPhotos,compact=false}) {
  const [err,setErr]=useState("");
  const sz=compact?60:76;

  const add = async files => {
    setErr("");
    const arr=Array.from(files).filter(f=>f.type.startsWith("image/"));
    if(!arr.length) return;
    try{
      const done=await Promise.all(arr.map(readPhoto));
      // Use direct value (not functional updater) so this works both as a
      // plain useState setter (Vault/Scan) and as a pass-through prop callback
      // (Morning/Evening), where functional updaters are not supported.
      setPhotos([...photos,...done]);
    }catch{setErr("Couldn't read image — try again.");}
  };

  const openPicker = (useCapture) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (useCapture) input.capture = "environment";
    else input.multiple = true;
    input.style.cssText = "position:fixed;top:-9999px;opacity:0;";
    document.body.appendChild(input);
    input.onchange = e => {
      add(e.target.files);
      setTimeout(() => document.body.removeChild(input), 500);
    };
    setTimeout(() => input.click(), 50);
  };

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <button onClick={()=>openPicker(true)}
          style={{flex:1,background:D.bg,border:`1.5px solid ${D.border}`,borderRadius:10,
            padding:"9px 6px",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          <span style={{fontSize:15}}>📷</span>Camera
        </button>
        <button onClick={()=>openPicker(false)}
          style={{flex:1,background:D.bg,border:`1.5px solid ${D.border}`,borderRadius:10,
            padding:"9px 6px",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          <span style={{fontSize:15}}>🖼</span>Library
        </button>
      </div>
      {err&&<p style={{fontSize:11,color:D.rd,marginBottom:6}}>{err}</p>}
      {photos.length>0&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {photos.map((p,i)=>(
            <div key={i} style={{position:"relative",width:sz,height:sz,borderRadius:10,overflow:"hidden",flexShrink:0}}>
              <img src={p.dataUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              <button onClick={()=>setPhotos(photos.filter((_,j)=>j!==i))}
                style={{position:"absolute",top:3,right:3,width:20,height:20,borderRadius:"50%",
                  background:"rgba(0,0,0,0.6)",color:"#fff",fontSize:12,
                  display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── VOICE RECORDER ────────────────────────────────────────
function VoiceRecorder({onTranscript,apiKey}) {
  const [st,setSt]=useState("idle");
  const [live,setLive]=useState("");
  const [msg,setMsg]=useState("");
  const recRef=useRef(null);
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;

  const start = async () => {
    if(!SR||!window.isSecureContext){
      setSt("unsupported");
      setMsg(!window.isSecureContext?"Voice needs HTTPS.":"Voice requires Chrome or Safari.");
      return;
    }
    setSt("asking");
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      stream.getTracks().forEach(t=>t.stop());
    }catch(e){
      setSt("error");
      setMsg(e.name==="NotAllowedError"?"Microphone access denied. Allow it in settings then retry.":`Mic error: ${e.message}`);
      return;
    }
    const r=new SR();
    r.continuous=true; r.interimResults=true; r.lang="en-US";
    r.onresult=e=>{
      let t="";
      for(let i=0;i<e.results.length;i++) t+=e.results[i][0].transcript+(e.results[i].isFinal?" ":"");
      setLive(t);
    };
    r.onerror=e=>{
      const m={"not-allowed":"Mic permission denied.","no-speech":"No speech — try again.","network":"Network error."};
      setSt("error"); setMsg(m[e.error]||`Error: ${e.error}`);
    };
    r.start(); recRef.current=r; setSt("recording"); setLive("");
  };

  const stop = async () => {
    recRef.current?.stop(); setSt("processing");
    await new Promise(r=>setTimeout(r,400));
    const cleaned=await cleanTranscript(apiKey,live).catch(()=>live);
    onTranscript(cleaned); setSt("done");
  };

  const reset=()=>{setSt("idle");setLive("");setMsg("");};

  if(st==="done") return(
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0"}}>
      <div style={{width:8,height:8,borderRadius:"50%",background:"#16a34a",flexShrink:0}}/>
      <span style={{fontSize:12,fontWeight:600,color:"#16a34a"}}>Transcribed</span>
      <button onClick={reset} style={{marginLeft:"auto",fontSize:11,fontWeight:600,textDecoration:"underline",color:D.muted}}>re-record</button>
    </div>
  );
  if(st==="error"||st==="unsupported") return(
    <div style={{padding:"10px 12px",background:"#fff5f5",borderRadius:10,border:`1.5px solid ${D.rd}`}}>
      <p style={{fontSize:12,color:D.rd,lineHeight:1.6,marginBottom:8}}>{msg}</p>
      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        {st==="error"&&<button onClick={reset} style={{fontSize:11,fontWeight:700,textDecoration:"underline"}}>Retry</button>}
        <span style={{fontSize:11,color:D.muted}}>Type your answer in the field above</span>
      </div>
    </div>
  );
  return(
    <div>
      {(st==="recording"||st==="processing")&&(
        <div style={{background:D.bg,borderRadius:10,padding:"10px 12px",marginBottom:8,minHeight:54}}>
          {st==="recording"&&(
            <div style={{display:"flex",gap:3,alignItems:"flex-end",height:22,marginBottom:6}}>
              {[1,1.7,.6,1.4,.5,1.8,.9,1.2,.7,1.5].map((h,i)=>(
                <div key={i} style={{width:3,borderRadius:1,background:D.rd,height:22*h,
                  transformOrigin:"bottom",animation:`wave .8s ease ${i*.08}s infinite`,flexShrink:0}}/>
              ))}
              <span style={{fontSize:9,color:D.rd,marginLeft:6,alignSelf:"center",
                fontFamily:"'Unbounded',monospace",letterSpacing:".08em",animation:"blink 1s step-start infinite"}}>● REC</span>
            </div>
          )}
          {st==="processing"&&<div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}><Spinner size={13}/><span style={{fontSize:11,color:D.muted}}>Processing…</span></div>}
          <p style={{fontSize:13,lineHeight:1.6,color:D.bk,minHeight:16}}>
            {live||<em style={{color:D.muted}}>Speak now…</em>}
          </p>
        </div>
      )}
      {(st==="idle"||st==="asking")?
        <button onClick={start} disabled={st==="asking"}
          style={{width:"100%",background:D.bk,color:D.yl,borderRadius:12,padding:"12px",
            fontFamily:"'Unbounded',monospace",fontSize:9,letterSpacing:".12em",fontWeight:700,
            display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          {st==="asking"?<><Spinner size={14} color={D.yl}/>Requesting mic…</>:
            <><span style={{width:10,height:10,borderRadius:"50%",background:D.rd,display:"inline-block",flexShrink:0}}/>RECORD VOICE NOTE</>}
        </button>
      :st==="recording"?
        <button onClick={stop}
          style={{width:"100%",background:D.rd,color:"#fff",borderRadius:12,padding:"12px",
            fontFamily:"'Unbounded',monospace",fontSize:9,letterSpacing:".12em",fontWeight:700,
            display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <span style={{width:10,height:10,background:"#fff",borderRadius:2,display:"inline-block",flexShrink:0}}/>STOP
        </button>
      :null}
    </div>
  );
}

// ── MORNING TEMPLATE ──────────────────────────────────────
function MorningTemplate({data,onChange}) {
  const set=(k,v)=>onChange({...data,[k]:v});
  const vis=(id)=>isSectionVisible("morning",id);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {/* identity — required, always shown */}
      <Card accent={D.yl}>
        <div style={{padding:"12px 14px"}}>
          <div style={{display:"flex",gap:12,marginBottom:12}}>
            <div style={{flex:"0 0 80px"}}>
              <SLabel style={{marginBottom:5,color:D.muted}}>STARTED AT</SLabel>
              <Field value={data.startTime} onChange={v=>set("startTime",v)} placeholder={nowTime()} style={{fontSize:16,fontWeight:700}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{display:"flex",gap:4,marginBottom:5}}>
                {[{k:"am",l:"I AM"},{k:"feel",l:"I FEEL"}].map(o=>(
                  <button key={o.k} onClick={()=>set("idMode",o.k)}
                    style={{padding:"3px 8px",borderRadius:6,border:`1.5px solid ${data.idMode===o.k?D.bk:D.border}`,
                      fontFamily:"'Unbounded',monospace",fontSize:7,fontWeight:700,
                      background:data.idMode===o.k?D.bk:"transparent",
                      color:data.idMode===o.k?D.yl:D.muted}}>
                    {o.l}
                  </button>
                ))}
              </div>
              <Field value={data.identity} onChange={v=>set("identity",v)} placeholder="free…"
                style={{fontSize:24,fontWeight:800,fontFamily:"'Unbounded',monospace",letterSpacing:".02em"}}/>
            </div>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:"8px 18px",paddingTop:10,borderTop:`1px solid ${D.border}`}}>
            {[["exercise","Exercise"],["water","H₂O"],["meditation","Meditate"],["nutrition","Nutrition"]].map(([k,l])=>(
              <CheckItem key={k} label={l} checked={data[k]} onChange={v=>set(k,v)}/>
            ))}
          </div>
        </div>
      </Card>

      {vis("gratitude")&&<Card accent={D.bl}>
        <div style={{padding:"12px 14px"}}>
          <SLabel color={D.bl} style={{marginBottom:8}}>I am thankful for</SLabel>
          <Field value={data.thankfulFor} onChange={v=>set("thankfulFor",v)} placeholder="my dreams, Zi, this moment…" style={{marginBottom:10}}/>
          <SLabel color={D.muted} style={{marginBottom:5,fontSize:7}}>BECAUSE</SLabel>
          <Field value={data.thankfulBecause} onChange={v=>set("thankfulBecause",v)} placeholder="they give me perspective…" rows={2}/>
        </div>
      </Card>}

      {vis("journal")&&<Card>
        <div style={{padding:"12px 14px"}}>
          <SLabel style={{marginBottom:8}}>Journal</SLabel>
          <Field value={data.journal} onChange={v=>set("journal",v)} placeholder="Write freely — what's alive in you today?" rows={5}/>
        </div>
      </Card>}

      {vis("loveAction")&&<Card accent={D.rd}>
        <div style={{padding:"12px 14px"}}>
          <SLabel color={D.rd} style={{marginBottom:8}}>One thing I could do to show love</SLabel>
          <Field value={data.loveAction} onChange={v=>set("loveAction",v)} placeholder="Be love…" rows={2}/>
        </div>
      </Card>}

      {vis("visualize")&&<Card>
        <div style={{padding:"12px 14px"}}>
          <SLabel style={{marginBottom:3}}>Visualize — imagine everything going amazing</SLabel>
          <p style={{fontSize:11,color:D.muted,marginBottom:12,lineHeight:1.5}}>Take a moment to focus on what you…</p>
          <div style={{display:"flex",flexDirection:"column",gap:9}}>
            {[["visSee","👁","SEE"],["visHear","👂","HEAR"],["visSmell","👃","SMELL"],
              ["visTaste","👅","TASTE"],["visFeel","🤲","FEEL"],["visInside","❤️","INSIDE"]].map(([k,icon,l])=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:14,width:20,textAlign:"center",flexShrink:0}}>{icon}</span>
                <span style={{fontFamily:"'Unbounded',monospace",fontSize:7,color:D.muted,width:36,flexShrink:0}}>{l}</span>
                <Field value={data[k]} onChange={v=>set(k,v)} placeholder="…" style={{fontSize:13}}/>
              </div>
            ))}
          </div>
        </div>
      </Card>}

      {vis("photos")&&<Card>
        <div style={{padding:"12px 14px"}}>
          <SLabel style={{marginBottom:10}}>Morning photos</SLabel>
          <PhotoUpload photos={data.photos||[]} setPhotos={v=>set("photos",v)}/>
        </div>
      </Card>}

      {/* ── Custom Questions ── */}
      <CustomQuestionsSection
        timeOfDay="morning"
        answers={data.customAnswers||{}}
        onChange={v=>set("customAnswers",v)}
      />
    </div>
  );
}

// ── EVENING TEMPLATE ──────────────────────────────────────
function EveningTemplate({data,onChange}) {
  const set=(k,v)=>onChange({...data,[k]:v});
  const setGoal=(i,f,v)=>{const g=[...data.goals];g[i]={...g[i],[f]:v};onChange({...data,goals:g});};
  const vis=(id)=>isSectionVisible("evening",id);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <Card accent={D.bk}>
        <div style={{padding:"12px 14px"}}>
          <div style={{display:"flex",alignItems:"center",marginBottom:12}}>
            <SLabel style={{flex:1}}>Next day goals</SLabel>
            <SLabel color={D.yl} style={{width:52,textAlign:"center",fontSize:6}}>EST. TIME</SLabel>
            <SLabel color={D.muted} style={{width:30,textAlign:"center",fontSize:6}}>DONE</SLabel>
          </div>
          {data.goals.map((g,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:i<3?10:0}}>
              <span style={{fontFamily:"'Unbounded',monospace",fontSize:11,fontWeight:700,color:D.yl,width:16,flexShrink:0}}>{i+1}</span>
              <Field value={g.t} onChange={v=>setGoal(i,"t",v)}
                placeholder={["Main focus","Second priority","Quick win","Bonus"][i]} style={{flex:1,fontSize:13}}/>
              <Field value={g.et} onChange={v=>setGoal(i,"et",v)} placeholder="1h"
                style={{width:42,textAlign:"center",fontSize:12,flexShrink:0}}/>
              <CheckItem label="" checked={g.done} onChange={v=>setGoal(i,"done",v)}/>
            </div>
          ))}
        </div>
      </Card>

      {vis("feelings")&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Card accent={D.yl}>
          <div style={{padding:"12px 12px"}}>
            <SLabel style={{marginBottom:8}}>Feelings</SLabel>
            <Field value={data.feel1} onChange={v=>set("feel1",v)} placeholder="Primary…" style={{marginBottom:8,fontSize:13}}/>
            <Field value={data.feel2} onChange={v=>set("feel2",v)} placeholder="Secondary…" style={{fontSize:13}}/>
          </div>
        </Card>
        <Card accent={D.bl}>
          <div style={{padding:"12px 12px"}}>
            <SLabel color={D.bl} style={{marginBottom:8}}>I learned</SLabel>
            <Field value={data.learned} onChange={v=>set("learned",v)} placeholder="Today I realized…" rows={4} style={{fontSize:13}}/>
          </div>
        </Card>
      </div>}

      {vis("appreciate")&&<Card>
        <div style={{padding:"12px 14px"}}>
          <SLabel style={{marginBottom:6}}>I appreciate</SLabel>
          <Field value={data.appreciate} onChange={v=>set("appreciate",v)} placeholder="Zi and all she does…" style={{marginBottom:12}}/>
          <SLabel style={{marginBottom:6}}>Growth question</SLabel>
          <Field value={data.growthQ} onChange={v=>set("growthQ",v)}
            placeholder="What question, if answered, would move my life forward?" rows={2}/>
        </div>
      </Card>}

      {vis("capture")&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Card accent={D.yl}>
          <div style={{padding:"12px 12px"}}>
            <SLabel color={D.yl} style={{marginBottom:8}}>✦ Ideas / coincidence</SLabel>
            <Field value={data.ideas} onChange={v=>set("ideas",v)} placeholder="that thing I noticed…" rows={3} style={{fontSize:13}}/>
          </div>
        </Card>
        <Card accent={D.rd}>
          <div style={{padding:"12px 12px"}}>
            <SLabel color={D.rd} style={{marginBottom:8}}>Memory log</SLabel>
            <Field value={data.memory} onChange={v=>set("memory",v)} placeholder="one thing to remember…" rows={3} style={{fontSize:13}}/>
          </div>
        </Card>
      </div>}

      {vis("checklist")&&<Card>
        <div style={{background:D.bk,borderRadius:D.r,padding:"14px"}}>
          <SLabel color={D.yl} style={{marginBottom:12}}>Night checklist</SLabel>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 12px"}}>
            {[["noFood","No food 3hrs before bed"],["bedTime","Bed on time"],["breathe","Breathing exercise"]].map(([k,l])=>(
              <label key={k} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}} onClick={()=>set(k,!data[k])}>
                <div style={{width:18,height:18,border:`2px solid ${data[k]?"#fff":"#444"}`,borderRadius:4,flexShrink:0,
                  background:data[k]?"#fff":"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {data[k]&&<span style={{color:D.bk,fontSize:10,fontWeight:700}}>✓</span>}
                </div>
                <span style={{fontSize:11,fontWeight:500,color:data[k]?"#fff":"#666"}}>{l}</span>
              </label>
            ))}
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:11,fontWeight:500,color:"#888"}}>Meditations</span>
              <div style={{display:"flex",gap:3}}>
                {[0,1,2,3].map(n=>(
                  <button key={n} onClick={()=>set("meds",n)}
                    style={{width:24,height:24,borderRadius:6,border:`2px solid ${data.meds>=n?"#fff":"#333"}`,
                      background:data.meds>=n?"#fff":"transparent",color:data.meds>=n?D.bk:"#444",
                      fontFamily:"'Unbounded',monospace",fontSize:9,fontWeight:700,
                      display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>}

      {vis("photos")&&<Card>
        <div style={{padding:"12px 14px"}}>
          <SLabel style={{marginBottom:10}}>Evening photos</SLabel>
          <PhotoUpload photos={data.photos||[]} setPhotos={v=>set("photos",v)}/>
        </div>
      </Card>}

      {/* ── Custom Questions ── */}
      <CustomQuestionsSection
        timeOfDay="evening"
        answers={data.customAnswers||{}}
        onChange={v=>set("customAnswers",v)}
      />
    </div>
  );
}

// ── GUIDED WALKTHROUGH ────────────────────────────────────
const PROMPTS_M = [
  {k:"startTime",label:"Start Time",  q:"What time are you starting today?",                         ph:"7:15 AM",           rows:1},
  {k:"identity", label:"I AM",        q:"Complete this sentence: I am…",                             ph:"free, present…",    rows:1},
  {k:"thankfulFor",label:"Gratitude", q:"I am thankful for…",                                        ph:"my dreams, Zi…",    rows:1},
  {k:"thankfulBecause",label:"Because",q:"Because…",                                                 ph:"they remind me…",   rows:2},
  {k:"journal",  label:"Journal",     q:"What's alive in you this morning? Speak or write freely.",  ph:"whatever comes…",   rows:4},
  {k:"loveAction",label:"Show Love",  q:"One thing I could do to show love to myself or others:",   ph:"Be love…",          rows:2},
  {k:"visSee",   label:"Visualize",   q:"Imagine everything going amazing. What do you SEE?",       ph:"light, faces…",     rows:1},
  {k:"visFeel",  label:"Visualize",   q:"What do you FEEL physically in that moment?",              ph:"warm, expansive…",  rows:1},
  {k:"visInside",label:"Visualize",   q:"What do you feel in your HEART?",                          ph:"peace, fire, love…",rows:1},
];
const PROMPTS_E = [
  {k:"feel1",    label:"Feelings",   q:"What was your strongest feeling today?",                    ph:"expressive, tense…",rows:1},
  {k:"feel2",    label:"Feelings",   q:"And a second strong feeling?",                              ph:"grateful, curious…",rows:1},
  {k:"learned",  label:"Growth",     q:"I learned or realized today…",                              ph:"surrendering to…",  rows:3},
  {k:"appreciate",label:"Appreciate",q:"I appreciate…",                                             ph:"Zi and all she…",   rows:1},
  {k:"ideas",    label:"Capture",    q:"Any random ideas, coincidences, or confusing things today?",ph:"that thing I noticed…",rows:2},
  {k:"memory",   label:"Memory",     q:"One thing I want to remember from today:",                  ph:"how it felt when…", rows:1},
  {k:"growthQ",  label:"Growth Q",   q:"What question, if answered, would move your life forward?", ph:"What would happen…",rows:2},
];

function GuidedWalkthrough({section,data,onChange,onDone,onExit,apiKey}) {
  const prompts=section==="morning"?PROMPTS_M:PROMPTS_E;
  const saved=LS.get(`mv3_g_${data.date}_${section}`);
  const [step,setStep]=useState(saved?.step||0);
  const [ans,setAns]=useState(saved?.ans||{});
  const [tts,setTts]=useState(false);
  const cur=prompts[step], isLast=step===prompts.length-1;
  const val=ans[cur.k]??data[cur.k]??"";
  const accent=section==="morning"?D.yl:D.bl;

  useEffect(()=>{LS.set(`mv3_g_${data.date}_${section}`,{step,ans});},[step,ans]);
  const setVal=v=>setAns(a=>({...a,[cur.k]:v}));

  const readAloud=()=>{
    if(!window.speechSynthesis) return;
    const u=new SpeechSynthesisUtterance(cur.q);
    u.rate=.9; window.speechSynthesis.speak(u);
    setTts(true); u.onend=()=>setTts(false);
  };

  const advance=()=>{
    const updated={...data,[cur.k]:val};
    onChange(updated);
    if(isLast){LS.set(`mv3_g_${data.date}_${section}`,null);onDone(updated);}
    else setStep(s=>s+1);
  };

  return(
    <div style={{background:D.white,display:"flex",flexDirection:"column",minHeight:"100%"}}>
      <div style={{background:D.bk,padding:"14px 16px",flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <SLabel color={accent}>{section.toUpperCase()} WALKTHROUGH</SLabel>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <SLabel color="#444">{step+1} OF {prompts.length}</SLabel>
            <button onClick={()=>{onChange({...data,[cur.k]:val});onExit&&onExit();}}
              style={{fontFamily:"'Unbounded',monospace",fontSize:7,fontWeight:700,
                color:"#888",letterSpacing:".08em",border:"1px solid #333",borderRadius:6,padding:"3px 8px"}}>
              SAVE & RETURN
            </button>
          </div>
        </div>
        <div style={{height:4,background:"#1a1a1a",borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",background:accent,borderRadius:2,transition:"width .4s ease",
            width:`${((step+1)/prompts.length)*100}%`}}/>
        </div>
      </div>

      <div style={{flex:1,padding:"20px 16px",display:"flex",flexDirection:"column",gap:14,overflowY:"auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <div style={{width:7,height:7,background:accent,borderRadius:2,flexShrink:0}}/>
          <SLabel color={D.muted}>{cur.label}</SLabel>
        </div>
        <div>
          <div style={{fontFamily:"'Unbounded',monospace",fontSize:16,fontWeight:700,lineHeight:1.35,color:D.bk,marginBottom:6}}>{cur.q}</div>
          <button onClick={readAloud} disabled={tts} style={{fontSize:11,color:D.muted,display:"flex",alignItems:"center",gap:4}}>
            {tts?"🔊 Reading…":"🔉 Read aloud"}
          </button>
        </div>
        <Card>
          <div style={{padding:"10px 12px"}}>
            <SLabel style={{marginBottom:8,fontSize:7,color:D.muted}}>YOUR ANSWER</SLabel>
            {cur.rows>1
              ?<textarea value={val} onChange={e=>setVal(e.target.value)} placeholder={cur.ph} rows={cur.rows} style={{fontSize:14,lineHeight:1.7,width:"100%"}}/>
              :<input value={val} onChange={e=>setVal(e.target.value)} placeholder={cur.ph} style={{fontSize:16,fontWeight:500,borderBottom:`1px solid ${D.border}`,paddingBottom:4}}/>
            }
          </div>
        </Card>
        <Card>
          <div style={{padding:"10px 12px"}}>
            <SLabel style={{marginBottom:8,fontSize:7,color:D.muted}}>OR SPEAK YOUR ANSWER</SLabel>
            <VoiceRecorder apiKey={apiKey} onTranscript={t=>setVal(val?(val.trim()+" "+t).trim():t)}/>
          </div>
        </Card>
      </div>

      <div style={{padding:"12px 16px",borderTop:`1px solid ${D.border}`,background:D.white,flexShrink:0}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 2.5fr 1fr",gap:6}}>
          <button onClick={()=>{if(step>0)setStep(s=>s-1);}}
            style={{padding:"11px",border:`1.5px solid ${step===0?D.border:D.bk}`,borderRadius:10,
              fontFamily:"'Unbounded',monospace",fontSize:8,fontWeight:700,
              color:step===0?"#ccc":D.bk,background:"transparent",opacity:step===0?.5:1}}>
            ← BACK
          </button>
          <button onClick={advance}
            style={{padding:"11px",background:D.bk,color:D.yl,borderRadius:10,
              fontFamily:"'Unbounded',monospace",fontSize:9,fontWeight:700,letterSpacing:".1em"}}>
            {isLast?"COMPLETE ✓":"NEXT →"}
          </button>
          <button onClick={()=>isLast?onDone(data):setStep(s=>s+1)}
            style={{padding:"11px",border:`1.5px solid ${D.border}`,borderRadius:10,
              fontFamily:"'Unbounded',monospace",fontSize:8,fontWeight:700,color:D.muted,background:D.bg}}>
            SKIP
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SCAN FLOW ─────────────────────────────────────────────
function ScanFlow({section,date,onComplete,apiKey}) {
  const [photos,setPhotos]=useState([]);
  const [st,setSt]=useState("upload");
  const [extracted,setExtracted]=useState(null);
  const [err,setErr]=useState("");
  const isMorning=section==="morning";

  const scan=async()=>{
    if(!photos.length) return;
    setSt("scanning"); setErr("");
    try{
      const data=await extractFromPhotos(apiKey,photos);
      if(data){setExtracted(data);setSt("review");}
      else{setErr("Couldn't extract data. Try a clearer photo.");setSt("upload");}
    }catch(e){setErr(e.message);setSt("upload");}
  };

  const mapped = extracted ? (isMorning ? {
    ...newMorning(),...extracted,photos,
  } : {
    ...newEvening(),
    feel1:extracted.feel1||"",feel2:extracted.feel2||"",
    learned:extracted.learned||"",appreciate:extracted.appreciate||"",
    ideas:extracted.ideas||"",memory:extracted.memory||"",
    growthQ:extracted.growthQ||"",
    goals:([...(extracted.goals||[]),{t:"",et:""},{t:"",et:""},{t:"",et:""},{t:"",et:""}]).slice(0,4).map(g=>({...g,done:false})),
    photos,
  }) : null;

  if(st==="upload") return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card accent={D.yl}>
        <div style={{padding:"14px"}}>
          <SLabel style={{marginBottom:6}}>Photograph your journal page</SLabel>
          <p style={{fontSize:12,color:D.muted,lineHeight:1.65,marginBottom:14}}>
            Take a clear, well-lit photo of your completed journal page. Claude Vision will read your handwriting and fill in all fields automatically.
          </p>
          <PhotoUpload photos={photos} setPhotos={setPhotos}/>
          {err&&<p style={{fontSize:11,color:D.rd,marginTop:10}}>{err}</p>}
          {!apiKey&&<p style={{fontSize:11,color:D.muted,marginTop:10,fontStyle:"italic",lineHeight:1.6}}>
            Demo mode active — sample data will be used. Add your API key in Settings for real handwriting extraction.
          </p>}
        </div>
      </Card>
      {photos.length>0&&(
        <button onClick={scan} style={{width:"100%",background:D.bk,color:D.yl,borderRadius:12,padding:"14px",
          fontFamily:"'Unbounded',monospace",fontSize:10,fontWeight:700,letterSpacing:".12em",
          display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          ✦ EXTRACT WITH AI
        </button>
      )}
    </div>
  );

  if(st==="scanning") return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      minHeight:300,gap:16,background:D.white,borderRadius:D.r,padding:24}}>
      <Spinner size={36}/>
      <div style={{textAlign:"center"}}>
        <SLabel style={{marginBottom:6}}>Reading your handwriting…</SLabel>
        <p style={{fontSize:12,color:D.muted}}>Claude Vision is analyzing your journal page</p>
      </div>
    </div>
  );

  if(st==="review"&&mapped) return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {extracted.demo&&(
        <div style={{background:"#fffbe6",borderRadius:10,padding:"10px 12px",border:`1.5px solid ${D.yl}`,display:"flex",gap:8,alignItems:"flex-start"}}>
          <span style={{fontSize:16,flexShrink:0}}>ℹ️</span>
          <p style={{fontSize:11,color:"#856404",lineHeight:1.6}}>Demo data shown. Add your Anthropic API key in Settings to enable real handwriting extraction.</p>
        </div>
      )}
      <div style={{background:D.white,borderRadius:10,padding:"10px 12px",display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:"#16a34a",flexShrink:0}}/>
        <span style={{fontSize:13,fontWeight:600,color:"#16a34a"}}>Extracted — review and edit below</span>
      </div>
      {isMorning?<MorningTemplate data={mapped} onChange={()=>{}}/>:<EveningTemplate data={mapped} onChange={()=>{}}/>}
      <button onClick={()=>onComplete(mapped)} style={{width:"100%",background:D.bk,color:D.yl,borderRadius:12,padding:"14px",
        fontFamily:"'Unbounded',monospace",fontSize:10,fontWeight:700,letterSpacing:".12em",
        display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        SAVE TO VAULT →
      </button>
    </div>
  );

  return null;
}

// ── VAULT ─────────────────────────────────────────────────
function VaultScreen({entries}) {
  const [q,setQ]=useState("");
  const [sel,setSel]=useState(null);

  const filtered=entries.filter(e=>{
    if(!q) return true;
    const txt=[e.morning?.identity,e.morning?.journal,e.evening?.feel1,e.evening?.learned,e.evening?.memory].join(" ").toLowerCase();
    return txt.includes(q.toLowerCase());
  });

  if(sel){
    const {morning:m,evening:ev,date}=sel;
    return(
      <div className="fu">
        <div style={{background:D.bk,padding:"14px 16px",display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>setSel(null)}
            style={{width:34,height:34,borderRadius:"50%",background:"#1a1a1a",color:D.yl,
              fontFamily:"'Unbounded',monospace",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>←</button>
          <div style={{flex:1}}>
            {m?.identity&&<div style={{fontFamily:"'Unbounded',monospace",fontSize:14,fontWeight:900,color:D.white}}>I AM {m.identity}</div>}
            <div style={{fontSize:11,color:"#555",marginTop:1}}>{fmtDate(date)}</div>
          </div>
        </div>
        <AccentStrip/>
        <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
          {[...(m?.photos||[]),...(ev?.photos||[])].length>0&&(
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {[...(m?.photos||[]),...(ev?.photos||[])].map((p,i)=>(
                <img key={i} src={p.dataUrl} alt="" style={{height:100,borderRadius:10,objectFit:"cover",border:`1.5px solid ${D.border}`}}/>
              ))}
            </div>
          )}
          {m?.journal&&<Card><div style={{padding:"12px 14px"}}><SLabel style={{marginBottom:8}}>Journal</SLabel><p style={{fontSize:14,lineHeight:1.8,color:"#444",whiteSpace:"pre-wrap"}}>{m.journal}</p></div></Card>}
          {ev?.learned&&<Card accent={D.bl}><div style={{padding:"12px 14px"}}><SLabel color={D.bl} style={{marginBottom:8}}>I Learned</SLabel><p style={{fontSize:14,lineHeight:1.75,color:"#444"}}>{ev.learned}</p></div></Card>}
          {ev?.memory&&<Card accent={D.rd}><div style={{padding:"12px 14px"}}><SLabel color={D.rd} style={{marginBottom:8}}>Memory Log</SLabel><p style={{fontSize:14,lineHeight:1.75,color:"#444"}}>{ev.memory}</p></div></Card>}
          {ev?.growthQ&&<Card><div style={{padding:"12px 14px"}}><SLabel style={{marginBottom:8}}>Growth Question</SLabel><p style={{fontSize:14,color:"#444",lineHeight:1.65,fontStyle:"italic"}}>"{ev.growthQ}"</p></div></Card>}
        </div>
      </div>
    );
  }

  return(
    <div className="fu">
      <div style={{background:D.bk,padding:"14px 16px 16px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,right:0,width:44,height:44,background:D.yl}}/>
        <div style={{position:"absolute",top:44,right:0,width:44,height:26,background:D.rd}}/>
        <div style={{position:"relative",zIndex:1}}>
          <SLabel color={D.yl} style={{marginBottom:4}}>VAULT</SLabel>
          <div style={{fontFamily:"'Unbounded',monospace",fontSize:22,fontWeight:900,color:D.white,marginBottom:14}}>
            {entries.length} {entries.length===1?"ENTRY":"ENTRIES"}
          </div>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search your journal…"
            style={{width:"100%",background:"transparent",border:"1.5px solid rgba(255,255,255,0.15)",
              borderRadius:10,padding:"10px 12px",color:D.white,fontSize:13}}/>
        </div>
      </div>
      <AccentStrip/>
      <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
        {filtered.length===0?(
          <div style={{textAlign:"center",padding:"56px 0",color:D.muted}}>
            <div style={{fontSize:32,marginBottom:10}}>◫</div>
            <SLabel color={D.muted}>{entries.length?"No results":"No entries yet"}</SLabel>
            <p style={{fontSize:12,marginTop:6,lineHeight:1.6}}>
              {entries.length?"Try a different search.":"Start your first entry by tapping TODAY."}
            </p>
          </div>
        ):filtered.map((e,i)=>(
          <div key={e.date} className="fu" onClick={()=>setSel(e)}
            style={{background:D.white,borderRadius:D.r,boxShadow:`0 3px 16px ${D.shadow}`,
              overflow:"hidden",cursor:"pointer",animationDelay:`${i*.04}s`,
              borderTop:`4px solid ${e.morning?.identity?D.yl:D.bl}`}}>
            <div style={{padding:"12px 14px 10px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                <div style={{fontFamily:"'Unbounded',monospace",fontSize:11,fontWeight:700,flex:1,paddingRight:8,lineHeight:1.3}}>
                  {e.morning?.identity?`I AM ${e.morning.identity}`:e.evening?.feel1||"Entry"}
                </div>
                <span style={{fontSize:10,color:D.muted,flexShrink:0}}>{fmtDate(e.date)}</span>
              </div>
              <p style={{fontSize:12,color:D.muted,lineHeight:1.55}}>
                {((e.morning?.journal||e.evening?.learned||"—").slice(0,96))}{(e.morning?.journal||e.evening?.learned||"").length>96?"…":""}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── JOURNAL HISTORY ───────────────────────────────────────
function EntryField({label, value}) {
  if(!value) return null;
  return(
    <div style={{marginBottom:12}}>
      <div style={{fontFamily:"'Unbounded',monospace",fontSize:7,fontWeight:700,color:D.muted,letterSpacing:".12em",marginBottom:4}}>{label}</div>
      <p style={{fontSize:13,lineHeight:1.75,color:D.bk,whiteSpace:"pre-wrap"}}>{value}</p>
    </div>
  );
}

function EntryDetailScreen({entry, onBack}) {
  const m = entry.morning||{};
  const e = entry.evening||{};
  const hasMorn = !!(m.identity||m.journal||m.thankfulFor);
  const hasEven = !!(e.feel1||e.learned||e.memory);
  const dateStr = new Date(entry.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
  return(
    <div style={{background:D.bg,minHeight:"100%",paddingBottom:20}}>
      <div style={{background:D.bk,padding:"14px 16px 20px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,right:0,width:40,height:40,background:D.yl}}/>
        <div style={{position:"absolute",top:40,right:0,width:40,height:24,background:D.rd}}/>
        <button onClick={onBack} style={{fontFamily:"'Unbounded',monospace",fontSize:9,color:D.yl,letterSpacing:".1em",
          fontWeight:700,marginBottom:12,display:"flex",alignItems:"center",gap:6,position:"relative",zIndex:1}}>
          ← BACK
        </button>
        <SLabel color={D.yl} style={{marginBottom:4,position:"relative",zIndex:1}}>JOURNAL ENTRY</SLabel>
        <div style={{fontFamily:"'Unbounded',monospace",fontSize:15,fontWeight:900,color:D.white,lineHeight:1.3,position:"relative",zIndex:1}}>{dateStr.toUpperCase()}</div>
        {hasMorn&&(
          <div style={{display:"flex",gap:6,marginTop:12,flexWrap:"wrap",position:"relative",zIndex:1}}>
            {m.exercise&&<span style={{padding:"2px 8px",borderRadius:10,background:"#16a34a22",color:"#16a34a",fontSize:9,fontFamily:"'Unbounded',monospace",fontWeight:700}}>EXERCISE</span>}
            {m.water&&<span style={{padding:"2px 8px",borderRadius:10,background:"#0ea5e922",color:"#0ea5e9",fontSize:9,fontFamily:"'Unbounded',monospace",fontWeight:700}}>WATER</span>}
            {m.meditation&&<span style={{padding:"2px 8px",borderRadius:10,background:"#a855f722",color:"#a855f7",fontSize:9,fontFamily:"'Unbounded',monospace",fontWeight:700}}>MEDITATION</span>}
            {m.nutrition&&<span style={{padding:"2px 8px",borderRadius:10,background:"#f59e0b22",color:"#f59e0b",fontSize:9,fontFamily:"'Unbounded',monospace",fontWeight:700}}>NUTRITION</span>}
          </div>
        )}
      </div>
      <AccentStrip/>
      <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
        {hasMorn&&(
          <Card>
            <div style={{background:D.yl,padding:"8px 14px",display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:14}}>☀</span>
              <span style={{fontFamily:"'Unbounded',monospace",fontSize:8,fontWeight:700,color:"#000",letterSpacing:".1em"}}>MORNING</span>
            </div>
            <div style={{padding:"14px 16px"}}>
              <EntryField label="I AM" value={m.identity||null}/>
              <EntryField label="GRATEFUL FOR" value={m.thankfulFor&&m.thankfulBecause?`${m.thankfulFor} — ${m.thankfulBecause}`:m.thankfulFor||m.thankfulBecause}/>
              <EntryField label="LOVE ACTION" value={m.loveAction}/>
              <EntryField label="JOURNAL" value={m.journal}/>
              {(m.visSee||m.visHear||m.visFeel)&&(
                <EntryField label="VISION" value={[m.visSee&&`See: ${m.visSee}`,m.visHear&&`Hear: ${m.visHear}`,m.visFeel&&`Feel: ${m.visFeel}`].filter(Boolean).join(" · ")}/>
              )}
            </div>
          </Card>
        )}
        {hasEven&&(
          <Card>
            <div style={{background:D.bl,padding:"8px 14px",display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:14}}>🌙</span>
              <span style={{fontFamily:"'Unbounded',monospace",fontSize:8,fontWeight:700,color:"#fff",letterSpacing:".1em"}}>EVENING</span>
            </div>
            <div style={{padding:"14px 16px"}}>
              <EntryField label="FEELING" value={[e.feel1,e.feel2].filter(Boolean).join(" · ")}/>
              <EntryField label="LEARNED" value={e.learned}/>
              <EntryField label="MEMORY" value={e.memory}/>
              <EntryField label="APPRECIATED" value={e.appreciate}/>
              <EntryField label="RANDOM IDEAS" value={e.ideas}/>
              {(e.goals||[]).filter(g=>g.t).length>0&&(
                <div style={{marginBottom:12}}>
                  <div style={{fontFamily:"'Unbounded',monospace",fontSize:7,fontWeight:700,color:D.muted,letterSpacing:".12em",marginBottom:6}}>GOALS</div>
                  {e.goals.filter(g=>g.t).map((g,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                      <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${g.done?D.bl:D.border}`,
                        background:g.done?D.bl:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {g.done&&<span style={{fontSize:9,color:"#fff"}}>✓</span>}
                      </div>
                      <span style={{fontSize:12,color:g.done?D.muted:D.bk,textDecoration:g.done?"line-through":"none"}}>{g.t}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}
        {(entry.tone||entry.themes?.length>0)&&(
          <Card style={{borderLeft:`3px solid ${D.yl}`}}>
            <div style={{padding:"12px 14px"}}>
              <SLabel color={D.yl} style={{marginBottom:8}}>AI REFLECTION</SLabel>
              {entry.tone&&<p style={{fontSize:12,color:D.muted,marginBottom:4}}>Tone: <span style={{color:D.bk,fontWeight:600}}>{entry.tone}</span></p>}
              {entry.themes?.length>0&&(
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>
                  {entry.themes.map(t=>(
                    <span key={t} style={{padding:"2px 8px",borderRadius:10,background:D.bg,border:`1px solid ${D.border}`,fontSize:10,color:D.muted}}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}
        {!hasMorn&&!hasEven&&(
          <div style={{textAlign:"center",padding:"32px 16px",color:D.muted,fontSize:12}}>No content recorded for this day.</div>
        )}
      </div>
    </div>
  );
}

function JournalHistoryScreen({entries, onBack}) {
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");

  if(selected) return <EntryDetailScreen entry={selected} onBack={()=>setSelected(null)}/>;

  const withContent = entries.filter(e=>
    e.morning?.identity||e.morning?.journal||
    e.evening?.feel1||e.evening?.learned||e.evening?.memory
  );

  const filtered = search.trim()
    ? withContent.filter(e=>{
        const q=search.toLowerCase();
        return (
          e.date.includes(q)||
          e.morning?.identity?.toLowerCase().includes(q)||
          e.morning?.journal?.toLowerCase().includes(q)||
          e.evening?.feel1?.toLowerCase().includes(q)||
          e.evening?.memory?.toLowerCase().includes(q)
        );
      })
    : withContent;

  const groups = {};
  for(const e of filtered){ const mo=e.date.slice(0,7); if(!groups[mo])groups[mo]=[]; groups[mo].push(e); }
  const months = Object.keys(groups).sort().reverse();
  const fmtMonth = m => { const [y,mo]=m.split("-"); return new Date(+y,+mo-1,1).toLocaleDateString("en-US",{month:"long",year:"numeric"}).toUpperCase(); };

  return(
    <div style={{background:D.bg,minHeight:"100%",paddingBottom:20}}>
      <div style={{background:D.bk,padding:"14px 16px 20px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,right:0,width:50,height:50,background:D.rd}}/>
        <div style={{position:"absolute",bottom:0,left:0,width:36,height:36,background:D.bl}}/>
        <button onClick={onBack} style={{fontFamily:"'Unbounded',monospace",fontSize:9,color:D.yl,letterSpacing:".1em",
          fontWeight:700,marginBottom:12,display:"flex",alignItems:"center",gap:6,position:"relative",zIndex:1}}>
          ← HOME
        </button>
        <SLabel color={D.yl} style={{marginBottom:4,position:"relative",zIndex:1}}>JOURNAL</SLabel>
        <div style={{fontFamily:"'Unbounded',monospace",fontSize:24,fontWeight:900,color:D.white,lineHeight:1.1,position:"relative",zIndex:1}}>
          {withContent.length}<br/><span style={{fontSize:12,fontWeight:400,color:"#555"}}>ENTRIES</span>
        </div>
      </div>
      <AccentStrip/>

      <div style={{padding:"12px 16px 0"}}>
        <div style={{background:D.white,borderRadius:12,border:`1.5px solid ${D.border}`,padding:"9px 14px",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:14,color:D.muted}}>⌕</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search entries…" style={{flex:1,fontSize:13,color:D.bk}}/>
          {search&&<button onClick={()=>setSearch("")} style={{color:D.muted,fontSize:16,lineHeight:1}}>×</button>}
        </div>
      </div>

      <div style={{padding:"8px 16px"}}>
        {months.length===0&&(
          <div style={{textAlign:"center",padding:"48px 16px",color:D.muted,fontSize:13}}>
            {search?"No entries match your search.":"No entries yet. Start journaling from the Home tab."}
          </div>
        )}
        {months.map(mo=>(
          <div key={mo}>
            <SLabel color={D.muted} style={{marginTop:16,marginBottom:8}}>{fmtMonth(mo)}</SLabel>
            {groups[mo].map(entry=>{
              const m=entry.morning||{}, ev=entry.evening||{};
              const hasMorn=!!(m.identity||m.journal);
              const hasEven=!!(ev.feel1||ev.learned);
              const d=new Date(entry.date+"T12:00:00");
              const dayNum=d.getDate();
              const dayName=d.toLocaleDateString("en-US",{weekday:"short"}).toUpperCase();
              const preview=m.identity?`I AM ${m.identity}`:(m.journal?.slice(0,60))||(ev.feel1?`Feeling ${ev.feel1}`:"");
              return(
                <button key={entry.date} onClick={()=>setSelected(entry)}
                  style={{width:"100%",background:D.white,borderRadius:16,marginBottom:8,
                    padding:"12px 14px",display:"flex",alignItems:"center",gap:12,
                    boxShadow:`0 2px 10px ${D.shadow}`,textAlign:"left",
                    borderLeft:`4px solid ${hasMorn?D.yl:hasEven?D.bl:D.border}`}}>
                  <div style={{flexShrink:0,textAlign:"center",width:36}}>
                    <div style={{fontFamily:"'Unbounded',monospace",fontSize:18,fontWeight:900,color:D.bk,lineHeight:1}}>{dayNum}</div>
                    <div style={{fontFamily:"'Unbounded',monospace",fontSize:7,color:D.muted,letterSpacing:".08em"}}>{dayName}</div>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:12,fontWeight:600,color:D.bk,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{preview||"Entry"}</p>
                    <div style={{display:"flex",gap:6}}>
                      {hasMorn&&<span style={{fontSize:9,color:D.yl,fontFamily:"'Unbounded',monospace",fontWeight:700}}>☀ AM</span>}
                      {hasEven&&<span style={{fontSize:9,color:D.bl,fontFamily:"'Unbounded',monospace",fontWeight:700}}>🌙 PM</span>}
                    </div>
                  </div>
                  <span style={{fontSize:18,color:"#ccc",flexShrink:0}}>›</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── HOME ──────────────────────────────────────────────────
function HomeScreen({entries,goal,onNavigate,onOpenHistory,onUpdateEntry,apiKey,onOpenGuide}) {
  const streak=calcStreak(entries);
  const longestStreak=calcLongestStreak(entries);
  const today=toISO();
  const te=entries.find(e=>e.date===today);
  const hasMorn=!!(te?.morning?.identity||te?.morning?.journal);
  const hasEven=!!(te?.evening?.feel1||te?.evening?.learned);
  const pct=Math.min(100,Math.round((entries.length/goal)*100));
  const [pendingComplete,setPendingComplete]=useState(null);
  const [startModeOpen,setStartModeOpen]=useState(false);
  const [breatheOpen,setBreatheOpen]=useState(false);
  const [milestoneKey,setMilestoneKey]=useState(0); // bump to hide banner after dismiss

  const dismissMilestone=()=>{
    const m=getNewMilestone(streak);
    if(m) LS.set(MS_ACK_KEY, m);
    setMilestoneKey(k=>k+1);
  };


  // ── Task carryover: scan ALL entries for evening goals ──
  const activeTasks=[], completedToday=[];
  entries.forEach(entry=>{
    (entry.evening?.goals||[]).forEach((g,idx)=>{
      if(!g.t) return;
      const task={...g,entryDate:entry.date,goalIdx:idx};
      if(g.done){
        if(g.completedAt?.startsWith(today)) completedToday.push(task);
      } else {
        activeTasks.push(task);
      }
    });
  });

  const completeTask=(task,note)=>{
    const entry=entries.find(e=>e.date===task.entryDate);
    if(!entry) return;
    const goals=(entry.evening?.goals||[]).map((g,i)=>
      i===task.goalIdx?{...g,done:true,completedAt:new Date().toISOString(),
        ...(note?.trim()?{note:note.trim()}:{})}:g
    );
    onUpdateEntry(task.entryDate,"evening",{...entry.evening,goals});
    setPendingComplete(null);
  };

  const startComplete=(task)=>{
    setPendingComplete({task,note:""});
  };

  return(
    <div className="fu">
      <div style={{background:D.bk,padding:"16px 16px 20px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,right:0,width:56,height:56,background:D.rd}}/>
        <div style={{position:"absolute",top:0,right:56,width:28,height:28,background:D.yl}}/>
        <div style={{position:"absolute",bottom:0,left:0,width:40,height:40,background:D.bl}}/>
        <button onClick={onOpenGuide} style={{position:"absolute",top:16,right:16,zIndex:2,
          width:32,height:32,borderRadius:"50%",background:"rgba(255,255,255,0.15)",
          border:"none",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",
          justifyContent:"center",transition:"all .2s",color:"#fff"}}>
          ?
        </button>
        <div style={{position:"relative",zIndex:1}}>
          <SLabel color={D.yl} style={{marginBottom:6}}>MINDVAULT AI</SLabel>
          <div style={{fontFamily:"'Unbounded',monospace",fontSize:26,fontWeight:900,color:D.white,lineHeight:1.05,marginBottom:4}}>
            GOOD<br/>{greet()}
          </div>
          <div style={{fontSize:11,color:"#555",marginBottom:18}}>{fmtFull()}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {[{v:streak,l:"STREAK",c:D.rd},{v:entries.length,l:"DAYS LOGGED",c:D.yl,dark:true},{v:`${pct}%`,l:`OF ${goal} DAYS`,c:D.bl}].map(s=>(
              <div key={s.l} style={{background:s.c,borderRadius:14,padding:"11px 8px",textAlign:"center",boxShadow:`0 4px 14px ${s.c}55`}}>
                <div style={{fontFamily:"'Unbounded',monospace",fontSize:20,fontWeight:900,color:s.dark?"#000":"#fff"}}>{s.v}</div>
                <div style={{fontFamily:"'Unbounded',monospace",fontSize:5.5,letterSpacing:".06em",marginTop:3,color:s.dark?"rgba(0,0,0,0.5)":"rgba(255,255,255,0.6)"}}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <AccentStrip/>

      <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:14}}>
        {/* ── Milestone banner ───────────────────────────── */}
        <MilestoneBanner key={milestoneKey} streak={streak} onDismiss={dismissMilestone}/>

        <div>
          <SLabel style={{marginBottom:10}}>TODAY</SLabel>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            {[{s:"morning",l:"Morning",icon:"☀️",done:hasMorn,c:D.yl},
              {s:"evening",l:"Evening",icon:"🌙",done:hasEven,c:D.bl}].map(t=>(
              <button key={t.s} onClick={()=>onNavigate("template",t.s)}
                style={{background:t.done?t.c:D.white,borderRadius:20,padding:"24px 18px",
                  boxShadow:`0 4px 18px ${D.shadow}`,textAlign:"left",
                  border:`4px solid ${t.done?t.c:D.border}`,transition:"all .18s",cursor:"pointer"}}>
                <div style={{fontSize:36,marginBottom:10}}>{t.icon}</div>
                <div style={{fontFamily:"'Unbounded',monospace",fontSize:13,fontWeight:700,
                  color:t.done?(t.c===D.yl?"#000":D.white):D.bk,marginBottom:4}}>{t.l.toUpperCase()}</div>
                <div style={{fontSize:12,color:t.done?(t.c===D.yl?"rgba(0,0,0,0.55)":"rgba(255,255,255,0.65)"):D.muted}}>
                  {t.done?"Done ✓":"Tap to begin →"}
                </div>
              </button>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[{mode:"scan",icon:"📷",l:"SCAN PAGE",sub:"Photo → AI fill"},
              {mode:"guided",icon:"🎙",l:"GUIDED",sub:"Voice walkthrough"}].map(b=>(
              <button key={b.mode} onClick={()=>onNavigate(b.mode,"morning")}
                style={{background:D.white,borderRadius:12,padding:"10px 12px",
                  boxShadow:`0 2px 10px ${D.shadow}`,display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                <span style={{fontSize:16}}>{b.icon}</span>
                <div style={{textAlign:"left"}}>
                  <div style={{fontFamily:"'Unbounded',monospace",fontSize:7,fontWeight:700,marginBottom:1}}>{b.l}</div>
                  <div style={{fontSize:9,color:D.muted}}>{b.sub}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── START MODE button ───────────────────────── */}
        <button
          onClick={()=>setStartModeOpen(true)}
          style={{
            width:"100%",padding:"15px 20px",borderRadius:16,
            background:D.bk,border:"none",cursor:"pointer",
            display:"flex",alignItems:"center",gap:14,
            boxShadow:"0 4px 20px rgba(0,0,0,0.18)",
            transition:"opacity .15s",
          }}>
          <div style={{width:38,height:38,borderRadius:10,flexShrink:0,
            background:D.yl,display:"flex",alignItems:"center",
            justifyContent:"center",fontSize:18}}>⚡</div>
          <div style={{textAlign:"left",flex:1}}>
            <div style={{fontFamily:"'Unbounded',monospace",fontSize:11,
              fontWeight:900,color:D.yl,letterSpacing:".06em"}}>
              I'M STUCK
            </div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.55)",marginTop:2}}>
              Get one next action →
            </div>
          </div>
        </button>

        {/* ── BOX BREATHING button ────────────────────── */}
        <button
          onClick={()=>setBreatheOpen(true)}
          style={{
            width:"100%",padding:"12px 20px",borderRadius:14,
            background:D.white,border:`1.5px solid ${D.border}`,
            cursor:"pointer",display:"flex",alignItems:"center",gap:12,
            boxShadow:`0 2px 10px ${D.shadow}`,transition:"opacity .15s",
          }}>
          <div style={{width:34,height:34,borderRadius:9,flexShrink:0,
            background:"#5B8AF018",border:`1.5px solid #5B8AF055`,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>
            □
          </div>
          <div style={{textAlign:"left",flex:1}}>
            <div style={{fontFamily:"'Unbounded',monospace",fontSize:10,
              fontWeight:700,color:D.bk,letterSpacing:".06em"}}>BOX BREATHING</div>
            <div style={{fontSize:10,color:D.muted,marginTop:1}}>
              4-4-4-4 guided timer
            </div>
          </div>
          <span style={{fontSize:14,color:D.muted}}>›</span>
        </button>

        {/* ── TODAY'S FOCUS ───────────────────────────── */}
        <div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <SLabel>TODAY'S FOCUS</SLabel>
            {activeTasks.length>0&&(
              <span style={{fontFamily:"'Unbounded',monospace",fontSize:7,fontWeight:700,
                color:D.yl,background:D.bk,borderRadius:20,padding:"3px 9px"}}>
                {activeTasks.length} ACTIVE
              </span>
            )}
          </div>

          {activeTasks.length===0&&completedToday.length===0?(
            <Card style={{borderStyle:"dashed",borderColor:D.border,boxShadow:"none"}}>
              <div style={{padding:"16px 18px",textAlign:"center"}}>
                <p style={{fontSize:12,color:D.muted,lineHeight:1.65}}>
                  No active tasks. Set <strong>Next Day Goals</strong> in tonight's Evening entry and they'll appear here tomorrow.
                </p>
              </div>
            </Card>
          ):(
            <Card>
              {activeTasks.map((task,i)=>{
                const isPending=pendingComplete?.task.entryDate===task.entryDate&&
                  pendingComplete?.task.goalIdx===task.goalIdx;
                return(
                  <div key={`${task.entryDate}-${task.goalIdx}`}
                    style={{borderBottom:i<activeTasks.length-1?`1px solid ${D.border}`:"none"}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:12,padding:"12px 16px"}}>
                      {/* Checkbox */}
                      <button
                        onClick={()=>isPending?setPendingComplete(null):startComplete(task)}
                        style={{width:24,height:24,borderRadius:"50%",flexShrink:0,marginTop:1,
                          border:`2px solid ${isPending?"#16a34a":D.bk}`,
                          background:isPending?"#dcfce7":"transparent",
                          display:"flex",alignItems:"center",justifyContent:"center",
                          cursor:"pointer",transition:"all .15s",fontSize:12,color:"#16a34a"}}>
                        {isPending?"✓":""}
                      </button>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:isPending?D.muted:D.bk,
                          lineHeight:1.4,textDecoration:isPending?"line-through":"none"}}>
                          {task.t}
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginTop:3}}>
                          {task.et&&(
                            <span style={{fontFamily:"'Unbounded',monospace",fontSize:7,
                              color:D.yl,fontWeight:700,background:D.bk,
                              borderRadius:4,padding:"2px 6px"}}>
                              {task.et}
                            </span>
                          )}
                          {task.entryDate!==today&&(
                            <span style={{fontSize:9,color:D.muted}}>
                              from {new Date(task.entryDate+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Inline comment prompt */}
                    {isPending&&(
                      <div style={{padding:"0 16px 14px 52px"}}>
                        <textarea
                          autoFocus
                          value={pendingComplete.note}
                          onChange={e=>setPendingComplete(p=>({...p,note:e.target.value}))}
                          placeholder="Add a quick note (optional)…"
                          rows={2}
                          style={{width:"100%",boxSizing:"border-box",
                            fontSize:12,lineHeight:1.5,
                            padding:"8px 10px",borderRadius:8,
                            border:`1.5px solid #86efac`,background:"#f0fdf4",
                            color:D.bk,resize:"none",outline:"none",
                            fontFamily:"inherit"}}
                        />
                        <div style={{display:"flex",gap:8,marginTop:8}}>
                          <button
                            onClick={()=>completeTask(task,pendingComplete.note)}
                            style={{flex:1,padding:"9px 0",borderRadius:8,border:"none",
                              background:"#16a34a",color:"#fff",fontSize:12,fontWeight:700,
                              cursor:"pointer"}}>
                            Mark Complete
                          </button>
                          <button
                            onClick={()=>setPendingComplete(null)}
                            style={{padding:"9px 14px",borderRadius:8,
                              border:`1px solid ${D.border}`,background:"transparent",
                              fontSize:12,color:D.muted,cursor:"pointer"}}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          )}

          {/* ── Completed Today ── always visible when tasks exist */}
          {completedToday.length>0&&(
            <div style={{marginTop:12}}>
              {/* Section header */}
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <div style={{width:18,height:18,borderRadius:"50%",background:"#16a34a",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  color:"#fff",fontSize:10,fontWeight:700,flexShrink:0}}>✓</div>
                <SLabel style={{color:"#16a34a"}}>
                  COMPLETED TODAY ({completedToday.length})
                </SLabel>
              </div>
              <Card style={{borderColor:"#bbf7d0",background:"#f0fdf4"}}>
                {completedToday.map((task,i)=>(
                  <div key={`done-${task.entryDate}-${task.goalIdx}`}
                    style={{padding:"12px 16px",
                      borderBottom:i<completedToday.length-1?`1px solid #dcfce7`:"none"}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                      <div style={{width:22,height:22,borderRadius:"50%",flexShrink:0,marginTop:1,
                        background:"#16a34a",display:"flex",alignItems:"center",
                        justifyContent:"center",color:"#fff",fontSize:11,fontWeight:700}}>
                        ✓
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,color:"#15803d",fontWeight:600,
                          textDecoration:"line-through",lineHeight:1.4,opacity:.75}}>
                          {task.t}
                        </div>
                        {task.note&&(
                          <div style={{fontSize:11,color:"#16a34a",marginTop:5,
                            lineHeight:1.55,fontStyle:"italic",
                            background:"#dcfce7",borderRadius:6,padding:"5px 8px"}}>
                            "{task.note}"
                          </div>
                        )}
                        {task.completedAt&&(
                          <div style={{fontSize:9,color:"#86efac",marginTop:4,
                            fontFamily:"'Unbounded',monospace",letterSpacing:".04em"}}>
                            {new Date(task.completedAt).toLocaleTimeString("en-US",
                              {hour:"2-digit",minute:"2-digit"})}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          )}
        </div>

        <Card>
          <div style={{padding:"12px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <SLabel>Journey Progress</SLabel>
              <span style={{fontFamily:"'Unbounded',monospace",fontSize:9,fontWeight:700,color:D.yl}}>{entries.length} / {goal}</span>
            </div>
            <div style={{height:8,background:D.bg,borderRadius:4,overflow:"hidden",marginBottom:5}}>
              <div style={{height:"100%",background:`linear-gradient(90deg,${D.bl},${D.yl})`,width:`${pct}%`,borderRadius:4,transition:"width .7s ease"}}/>
            </div>
            <p style={{fontSize:11,color:D.muted,lineHeight:1.5}}>
              {pct>=100?"🎉 Goal reached! Set a new one in Settings.":`${goal-entries.length} ${goal-entries.length===1?"day":"days"} remaining to reach your ${goal}-day goal`}
            </p>
          </div>
        </Card>

        <StreakCalendar entries={entries} longestStreak={longestStreak}/>

        <button onClick={onOpenHistory}
          style={{width:"100%",background:D.bk,borderRadius:16,padding:"16px 18px",
            display:"flex",alignItems:"center",justifyContent:"space-between",
            boxShadow:`0 4px 18px rgba(0,0,0,.15)`}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:22}}>📖</span>
            <div style={{textAlign:"left"}}>
              <div style={{fontFamily:"'Unbounded',monospace",fontSize:10,fontWeight:700,color:D.yl,letterSpacing:".08em"}}>JOURNAL HISTORY</div>
              <div style={{fontSize:11,color:"#666",marginTop:2}}>{entries.length} {entries.length===1?"entry":"entries"} · tap to browse</div>
            </div>
          </div>
          <span style={{fontSize:20,color:"#444"}}>›</span>
        </button>

        <div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <SLabel>MEDITATIONS</SLabel>
            <div style={{flex:1,height:1,background:D.border}}/>
          </div>

          {/* Meditation I */}
          <Card style={{marginBottom:10,padding:0,overflow:"hidden"}}>
            <div style={{padding:"10px 12px 8px",display:"flex",alignItems:"center",gap:8,borderBottom:`1px solid ${D.border}`}}>
              <span style={{fontSize:14}}>🧘</span>
              <span style={{fontFamily:"'Unbounded',monospace",fontSize:8,fontWeight:700,letterSpacing:".1em",color:D.muted}}>Meditation I</span>
            </div>
            <div style={{position:"relative",paddingBottom:"56.25%",height:0,background:D.bk}}>
              <iframe src={`https://www.youtube.com/embed/oeQfRtiY-ZM?rel=0&modestbranding=1`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen title="Meditation I"
                style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",border:"none"}}/>
            </div>
          </Card>

          {/* Meditation II Slideshow */}
          <Card style={{marginBottom:10,padding:"10px 12px",overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,paddingBottom:8,borderBottom:`1px solid ${D.border}`}}>
              <span style={{fontSize:14}}>🧘</span>
              <span style={{fontFamily:"'Unbounded',monospace",fontSize:8,fontWeight:700,letterSpacing:".1em",color:D.muted}}>Meditation II</span>
            </div>
            <MeditationSlideshow />
          </Card>

          <VideoSlideshow defaultIndex={1} inline={true} />
        </div>
      </div>

      {/* ── Start Mode overlay ───────────────────────── */}
      {startModeOpen&&(
        <div style={{position:"fixed",inset:0,zIndex:500,
          background:"rgba(240,237,229,0.97)",
          display:"flex",flexDirection:"column",
          maxWidth:480,margin:"0 auto"}}>
          {/* Header bar */}
          <div style={{flexShrink:0,background:D.bk,padding:"14px 16px",
            display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:16}}>⚡</span>
              <div style={{fontFamily:"'Unbounded',monospace",fontSize:9,
                fontWeight:700,color:D.yl,letterSpacing:".12em"}}>
                START MODE
              </div>
            </div>
            <button onClick={()=>setStartModeOpen(false)}
              style={{width:32,height:32,borderRadius:"50%",
                background:"rgba(255,255,255,.1)",border:"none",
                color:"rgba(255,255,255,.6)",fontSize:16,cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center"}}>
              ✕
            </button>
          </div>
          {/* Content */}
          <div style={{flex:1,minHeight:0,overflowY:"auto"}}>
            <StartMode
              apiKey={apiKey}
              memoryContext={buildMemoryContext(entries)}
              onClose={()=>setStartModeOpen(false)}
            />
          </div>
        </div>
      )}

      {/* ── Box Breathing overlay ────────────────────── */}
      {breatheOpen&&(
        <BoxBreathing onClose={()=>setBreatheOpen(false)}/>
      )}
    </div>
  );
}

// ── BACKUP REMINDER ───────────────────────────────────────
function BackupReminder({entries, onExport, onDismiss}) {
  return (
    <div style={{position:"fixed",bottom:92,left:"50%",transform:"translateX(-50%)",
      width:"calc(100% - 32px)",maxWidth:448,zIndex:300,
      background:D.bk,borderRadius:16,padding:"14px 16px",
      boxShadow:"0 8px 32px rgba(0,0,0,0.35)",
      border:`2px solid ${D.yl}`,display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
        <div>
          <div style={{fontFamily:"'Unbounded',monospace",fontSize:9,color:D.yl,letterSpacing:".12em",marginBottom:4}}>BACKUP REMINDER</div>
          <p style={{fontSize:12,color:"#ccc",lineHeight:1.6}}>You've added 10 new entries since your last export. Export your vault to keep a backup file you own.</p>
        </div>
        <button onClick={onDismiss} style={{color:"#555",fontSize:18,lineHeight:1,flexShrink:0,paddingTop:2}}>×</button>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={onExport} style={{flex:1,background:D.yl,color:"#000",borderRadius:10,padding:"10px",
          fontFamily:"'Unbounded',monospace",fontSize:8,fontWeight:700,letterSpacing:".1em"}}>↓ EXPORT NOW</button>
        <button onClick={onDismiss} style={{padding:"10px 14px",borderRadius:10,border:`1px solid #333`,color:"#666",
          fontFamily:"'Unbounded',monospace",fontSize:8,fontWeight:700}}>LATER</button>
      </div>
    </div>
  );
}

// ── API KEY CARD ──────────────────────────────────────────
function ApiKeyCard({ dKey, setDKey }) {
  const [status, setStatus] = useState(null); // null | "testing" | "ok" | "error"
  const [errMsg, setErrMsg] = useState("");

  const test = async () => {
    if (!dKey.trim()) { setStatus("error"); setErrMsg("Enter a key first."); return; }
    setStatus("testing");
    setErrMsg("");
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": dKey.trim(),
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: MODEL, max_tokens: 10,
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      const d = await r.json();
      if (d.error) { setStatus("error"); setErrMsg(d.error.message); }
      else setStatus("ok");
    } catch (e) {
      setStatus("error");
      setErrMsg(e.message || "Network error — check your connection.");
    }
  };

  return (
    <Card accent={D.yl}>
      <div style={{padding:"14px"}}>
        <SLabel style={{marginBottom:4}}>Anthropic API Key</SLabel>
        <p style={{fontSize:11,color:D.muted,lineHeight:1.65,marginBottom:10}}>
          Unlocks AI features — photo scan, voice transcript cleanup, Start Mode, and entry analysis. Without a key the app runs in demo mode.
        </p>
        <input type="password" value={dKey} onChange={e=>{setDKey(e.target.value);setStatus(null);}}
          placeholder="sk-ant-…"
          style={{background:D.bg,borderRadius:10,padding:"10px 12px",fontSize:14,
            border:`1.5px solid ${status==="ok"?"#16a34a":status==="error"?D.rd:D.border}`,
            width:"100%",letterSpacing:dKey?".06em":0,marginBottom:8}}/>

        {/* Status feedback */}
        {status==="ok" && (
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,
            padding:"8px 10px",borderRadius:8,background:"#f0fdf4"}}>
            <span style={{fontSize:13}}>✅</span>
            <span style={{fontSize:12,color:"#15803d",fontWeight:600}}>Key is valid — AI features are active.</span>
          </div>
        )}
        {status==="error" && (
          <div style={{display:"flex",alignItems:"flex-start",gap:6,marginBottom:8,
            padding:"8px 10px",borderRadius:8,background:"#fff5f5"}}>
            <span style={{fontSize:13,flexShrink:0}}>❌</span>
            <span style={{fontSize:11,color:D.rd,lineHeight:1.55}}>{errMsg||"Invalid key."}</span>
          </div>
        )}

        <button type="button" onClick={test} disabled={status==="testing"}
          style={{width:"100%",padding:"9px",borderRadius:8,cursor:"pointer",
            border:`1.5px solid ${D.border}`,background:"transparent",
            fontSize:12,fontWeight:600,color:status==="testing"?D.muted:D.bk,
            display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:8}}>
          {status==="testing"
            ? <><Spinner size={11}/> Testing…</>
            : "Test Connection"}
        </button>

        <a href="https://console.anthropic.com" target="_blank" rel="noreferrer"
          style={{fontSize:11,color:D.bl,display:"block"}}>
          Get a key at console.anthropic.com →
        </a>
      </div>
    </Card>
  );
}

// ── SETTINGS ──────────────────────────────────────────────
function SettingsScreen({apiKey,setApiKey,goal,setGoal,entries,onExport,accessToken,setAccessToken,pinSetupComplete,onDisablePin,onOpenGuide,onResetOnboarding,onOpenMetrics}) {
  const [dKey,setDKey]=useState(apiKey);
  const [dGoal,setDGoal]=useState(String(goal));
  const [dToken,setDToken]=useState(accessToken);
  const [saved,setSaved]=useState(false);
  const [importing,setImporting]=useState(false);
  const [showQManager,setShowQManager]=useState(false);
  const [importMsg,setImportMsg]=useState(null);
  const [showImportChoice,setShowImportChoice]=useState(false);
  const [pendingFile,setPendingFile]=useState(null);
  const [showPinConfirm,setShowPinConfirm]=useState(false);
  const importRef=useRef(null);

  const save=()=>{
    setApiKey(dKey);
    setAccessToken(dToken);
    const g=parseInt(dGoal)||90;
    setGoal(g);
    LS.set("mv3_settings",{apiKey:dKey,goal:g,accessToken:dToken});
    setSaved(true); setTimeout(()=>setSaved(false),2000);
  };

  const pickImportFile = e => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPendingFile(f);
    setShowImportChoice(true);
    e.target.value="";
  };

  const runImport = async mode => {
    setShowImportChoice(false);
    setImporting(true); setImportMsg(null);
    try {
      const count = await doImport(pendingFile, mode);
      const refreshed = await idb.getAll(S.entries);
      const sorted = refreshed.sort((a,b)=>b.date.localeCompare(a.date));
      window.dispatchEvent(new CustomEvent("mv_reload_entries", {detail:sorted}));
      setImportMsg({ok:true, text:`✓ Imported ${count} ${count===1?"entry":"entries"} successfully.`});
    } catch(err) {
      setImportMsg({ok:false, text:`⚠ ${err}`});
    } finally {
      setImporting(false); setPendingFile(null);
    }
  };

  return(
    <div>
      <div style={{background:D.bk,padding:"14px 16px 18px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,right:0,width:44,height:44,background:D.yl}}/>
        <div style={{position:"absolute",top:44,right:0,width:44,height:26,background:D.rd}}/>
        <SLabel color={D.yl} style={{marginBottom:4,position:"relative",zIndex:1}}>SETTINGS</SLabel>
        <div style={{fontFamily:"'Unbounded',monospace",fontSize:22,fontWeight:900,color:D.white,position:"relative",zIndex:1}}>MINDVAULT AI</div>
      </div>
      <AccentStrip/>
      <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>

        <div style={{background:D.bl,borderRadius:12,padding:"12px 14px",display:"flex",gap:10,alignItems:"flex-start"}}>
          <span style={{fontSize:18,flexShrink:0}}>🔒</span>
          <p style={{fontSize:11,color:"rgba(255,255,255,0.8)",lineHeight:1.7}}>
            Your journal stays on your device by default. MindVault stores entries locally using IndexedDB for privacy and speed.
          </p>
        </div>

        {/* ── Custom Questions ── */}
        <button onClick={()=>setShowQManager(true)}
          style={{width:"100%",background:D.bk,borderRadius:14,padding:"14px 16px",
            display:"flex",alignItems:"center",gap:14,cursor:"pointer",border:"none",
            boxShadow:"0 4px 18px rgba(0,0,0,.14)"}}>
          <div style={{width:38,height:38,borderRadius:10,flexShrink:0,
            background:"#9B72F0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>
            ✦
          </div>
          <div style={{textAlign:"left",flex:1}}>
            <div style={{fontFamily:"'Unbounded',monospace",fontSize:10,fontWeight:900,
              color:"#9B72F0",letterSpacing:".06em"}}>CUSTOM QUESTIONS</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.55)",marginTop:2}}>
              Customize your daily journal prompts →
            </div>
          </div>
        </button>

        {/* Manager overlay */}
        {showQManager&&(
          <div style={{position:"fixed",inset:0,zIndex:500,
            background:D.bg,display:"flex",flexDirection:"column",
            maxWidth:480,margin:"0 auto"}}>
            <CustomQuestionsManager onClose={()=>setShowQManager(false)}/>
          </div>
        )}

        <ApiKeyCard dKey={dKey} setDKey={setDKey}/>

        {/* PIN Lock Management */}
        <Card>
          <div style={{padding:"14px"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <span style={{fontSize:20,flexShrink:0}}>🔐</span>
              <div style={{flex:1}}>
                <SLabel style={{marginBottom:2}}>PIN Lock</SLabel>
                <p style={{fontSize:11,color:D.muted,marginTop:2}}>
                  {pinSetupComplete?"Enabled — app locked on startup":"Not enabled"}
                </p>
              </div>
            </div>
            {pinSetupComplete&&(
              <button onClick={()=>setShowPinConfirm(true)}
                style={{width:"100%",background:D.rd,color:"#fff",borderRadius:10,
                  padding:"11px",fontFamily:"'Unbounded',monospace",fontSize:9,fontWeight:700,
                  letterSpacing:".1em",cursor:"pointer"}}>
                DISABLE PIN LOCK
              </button>
            )}
            {!pinSetupComplete&&(
              <p style={{fontSize:11,color:D.muted,fontStyle:"italic",textAlign:"center",padding:"10px"}}>
                PIN lock will activate on next app load.
              </p>
            )}
          </div>
        </Card>

        {/* Disable PIN Confirmation Modal */}
        {showPinConfirm&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:400,
            display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{background:D.white,borderRadius:18,padding:20,maxWidth:340,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>
              <div style={{fontSize:28,marginBottom:12,textAlign:"center"}}>🔓</div>
              <SLabel style={{marginBottom:8,textAlign:"center",display:"block"}}>Disable PIN Lock?</SLabel>
              <p style={{fontSize:12,color:D.muted,lineHeight:1.7,marginBottom:16,textAlign:"center"}}>
                Your journal will be unprotected. You can re-enable it anytime.
              </p>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <button onClick={()=>{onDisablePin();setShowPinConfirm(false);}}
                  style={{background:D.rd,color:"#fff",borderRadius:10,padding:"12px",
                    fontFamily:"'Unbounded',monospace",fontSize:8,fontWeight:700,letterSpacing:".1em"}}>
                  YES, DISABLE PIN
                </button>
                <button onClick={()=>setShowPinConfirm(false)}
                  style={{color:D.muted,padding:"10px",fontSize:12,fontWeight:600}}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MindWrite Guide ── */}
        <button onClick={onOpenGuide}
          style={{width:"100%",background:D.bk,borderRadius:14,padding:"14px 16px",
            display:"flex",alignItems:"center",gap:14,cursor:"pointer",border:"none",
            boxShadow:"0 4px 18px rgba(0,0,0,.14)"}}>
          <div style={{width:38,height:38,borderRadius:10,flexShrink:0,
            background:"#E8B84B",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>
            ?
          </div>
          <div style={{textAlign:"left",flex:1}}>
            <div style={{fontFamily:"'Unbounded',monospace",fontSize:10,fontWeight:900,
              color:"#E8B84B",letterSpacing:".06em"}}>MINDWRITE GUIDE</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.55)",marginTop:2}}>
              Philosophy, tools, and practices →
            </div>
          </div>
        </button>

        {/* ── View Onboarding Again ── */}
        <button onClick={onResetOnboarding}
          style={{width:"100%",background:D.bk,borderRadius:14,padding:"14px 16px",
            display:"flex",alignItems:"center",gap:14,cursor:"pointer",border:"none",
            boxShadow:"0 4px 18px rgba(0,0,0,.14)"}}>
          <div style={{width:38,height:38,borderRadius:10,flexShrink:0,
            background:"#3DD68C",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>
            🌱
          </div>
          <div style={{textAlign:"left",flex:1}}>
            <div style={{fontFamily:"'Unbounded',monospace",fontSize:10,fontWeight:900,
              color:"#3DD68C",letterSpacing:".06em"}}>VIEW ONBOARDING</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.55)",marginTop:2}}>
              See the welcome flow again →
            </div>
          </div>
        </button>

        {/* ── Metrics Dashboard ── */}
        <button onClick={onOpenMetrics}
          style={{width:"100%",background:D.bk,borderRadius:14,padding:"14px 16px",
            display:"flex",alignItems:"center",gap:14,cursor:"pointer",border:"none",
            boxShadow:"0 4px 18px rgba(0,0,0,.14)"}}>
          <div style={{width:38,height:38,borderRadius:10,flexShrink:0,
            background:"#5B8AF0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>
            📊
          </div>
          <div style={{textAlign:"left",flex:1}}>
            <div style={{fontFamily:"'Unbounded',monospace",fontSize:10,fontWeight:900,
              color:"#5B8AF0",letterSpacing:".06em"}}>METRICS</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.55)",marginTop:2}}>
              View usage analytics (Ctrl+Shift+M) →
            </div>
          </div>
        </button>

        <Card>
          <div style={{padding:"14px"}}>
            <SLabel style={{marginBottom:4}}>Orpheus Access Token</SLabel>
            <p style={{fontSize:11,color:D.muted,lineHeight:1.65,marginBottom:10}}>
              Required for Orpheus AI modes. Set via Vercel env var <code style={{fontFamily:"monospace",fontSize:10}}>AUTOMATION_ACCESS_TOKEN</code>.
            </p>
            <input type="password" value={dToken} onChange={e=>setDToken(e.target.value)} placeholder="Paste access token…"
              style={{background:D.bg,borderRadius:10,padding:"10px 12px",fontSize:14,
                border:`1.5px solid ${D.border}`,width:"100%",letterSpacing:dToken?".06em":0}}/>
            {dToken&&<p style={{fontSize:10,color:"#16a34a",marginTop:6,fontWeight:600}}>✓ Token configured</p>}
          </div>
        </Card>

        <Card>
          <div style={{padding:"14px"}}>
            <SLabel style={{marginBottom:4}}>Journey Goal</SLabel>
            <p style={{fontSize:11,color:D.muted,marginBottom:12,lineHeight:1.65}}>The MindWrite book is 90 days — but any goal works.</p>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input type="number" value={dGoal} onChange={e=>setDGoal(e.target.value)} min="1" max="365"
                style={{background:D.bg,borderRadius:10,padding:"10px 12px",fontSize:18,fontWeight:700,
                  border:`1.5px solid ${D.border}`,width:72,textAlign:"center",fontFamily:"'Unbounded',monospace"}}/>
              <span style={{fontSize:13,color:D.muted}}>days</span>
              <div style={{display:"flex",gap:5,marginLeft:"auto"}}>
                {[30,60,90].map(n=>(
                  <button key={n} onClick={()=>setDGoal(String(n))}
                    style={{padding:"6px 10px",borderRadius:8,fontFamily:"'Unbounded',monospace",fontSize:9,fontWeight:700,
                      border:`1.5px solid ${dGoal===String(n)?D.bk:D.border}`,
                      background:dGoal===String(n)?D.bk:"transparent",
                      color:dGoal===String(n)?D.yl:D.muted}}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <button onClick={save}
          style={{width:"100%",background:saved?"#16a34a":D.bk,color:saved?"#fff":D.yl,
            borderRadius:12,padding:"14px",fontFamily:"'Unbounded',monospace",fontSize:10,
            fontWeight:700,letterSpacing:".12em",transition:"background .3s"}}>
          {saved?"✓ SAVED":"SAVE SETTINGS"}
        </button>

        <Card>
          <div style={{padding:"14px"}}>
            <SLabel style={{marginBottom:4}}>Backup & Restore</SLabel>
            <p style={{fontSize:11,color:D.muted,lineHeight:1.65,marginBottom:12}}>
              Export everything — journal entries, photos, vault items, and Throne Talk data. Import to restore or transfer to another device.
            </p>
            <button onClick={onExport}
              style={{width:"100%",background:D.bg,border:`1.5px solid ${D.border}`,borderRadius:10,
                padding:"11px",fontFamily:"'Unbounded',monospace",fontSize:9,fontWeight:700,letterSpacing:".1em",marginBottom:8}}>
              ↓ EXPORT {entries.length} {entries.length===1?"ENTRY":"ENTRIES"} AS JSON
            </button>
            <button onClick={()=>importRef.current?.click()} disabled={importing}
              style={{width:"100%",background:"transparent",border:`1.5px solid ${D.border}`,
                borderRadius:10,padding:"11px",fontFamily:"'Unbounded',monospace",fontSize:9,
                fontWeight:700,letterSpacing:".1em",color:D.muted,
                display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              {importing?<><Spinner size={12}/>IMPORTING…</>:"↑ IMPORT BACKUP FILE"}
            </button>
            <input ref={importRef} type="file" accept=".json,application/json"
              style={{display:"none"}} onChange={pickImportFile}/>
            {importMsg&&(
              <p style={{fontSize:11,marginTop:8,lineHeight:1.6,color:importMsg.ok?"#16a34a":D.rd,fontWeight:600}}>{importMsg.text}</p>
            )}
          </div>
        </Card>

        {showImportChoice&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:400,
            display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{background:D.white,borderRadius:18,padding:20,maxWidth:340,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>
              <SLabel style={{marginBottom:8}}>How should we import?</SLabel>
              <p style={{fontSize:12,color:D.muted,lineHeight:1.7,marginBottom:16}}>
                <strong>"{pendingFile?.name}"</strong> is ready. Choose whether to merge or replace.
              </p>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <button onClick={()=>runImport("merge")} style={{background:D.bl,color:"#fff",borderRadius:10,padding:"12px",fontFamily:"'Unbounded',monospace",fontSize:8,fontWeight:700,letterSpacing:".1em"}}>MERGE — add to existing entries</button>
                <button onClick={()=>runImport("replace")} style={{background:D.rd,color:"#fff",borderRadius:10,padding:"12px",fontFamily:"'Unbounded',monospace",fontSize:8,fontWeight:700,letterSpacing:".1em"}}>REPLACE — overwrite all local data</button>
                <button onClick={()=>{setShowImportChoice(false);setPendingFile(null);}} style={{color:D.muted,padding:"10px",fontSize:12,fontWeight:600}}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        <Card>
          <div style={{padding:"14px"}}>
            <SLabel style={{marginBottom:12}}>Platform Notes</SLabel>
            {[
              ["📷","Camera vs Library","Camera and Library both use dynamic input creation for iOS PWA compatibility — no more white screen bug."],
              ["🎙","Voice Recording","Requires Chrome or Safari. If microphone access is blocked, type instead. Voice is always optional."],
              ["💾","Your Data","Entries are stored in IndexedDB on this device — never sent to a server. Export regularly as a personal backup."],
            ].map(([ico,title,note])=>(
              <div key={title} style={{display:"flex",gap:10,paddingBottom:10,marginBottom:10,borderBottom:`1px solid ${D.border}`}}>
                <span style={{fontSize:18,flexShrink:0}}>{ico}</span>
                <div>
                  <div style={{fontFamily:"'Unbounded',monospace",fontSize:8,fontWeight:700,marginBottom:3}}>{title}</div>
                  <p style={{fontSize:11,color:D.muted,lineHeight:1.65}}>{note}</p>
                </div>
              </div>
            ))}
            <div style={{display:"flex"}}>
              <div style={{flex:3.5,height:2,background:D.bl}}/><div style={{flex:.8,height:2,background:D.rd}}/><div style={{flex:.5,height:2,background:D.yl}}/>
            </div>
            <p style={{fontSize:8,color:"#ccc",marginTop:8,fontFamily:"'Unbounded',monospace",letterSpacing:".1em"}}>
              MINDVAULT AI · COMPANION TO MINDWRITE · BUILT WITH CLAUDE
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── JOURNAL ERROR BOUNDARY ────────────────────────────────
class JournalErrorBoundary extends Component {
  constructor(props){super(props);this.state={hasError:false};}
  static getDerivedStateFromError(){return{hasError:true};}
  componentDidCatch(err,info){console.error("[MindVault] Journal section error:",err,info);}
  render(){
    if(this.state.hasError){
      return(
        <div style={{padding:"32px 16px",textAlign:"center",background:D.white,borderRadius:D.r,margin:"16px 0",
          boxShadow:`0 2px 12px ${D.shadow}`}}>
          <div style={{fontSize:36,marginBottom:12}}>⚠️</div>
          <p style={{fontFamily:"'Unbounded',monospace",fontSize:9,fontWeight:700,
            color:D.bk,letterSpacing:".1em",marginBottom:8}}>SOMETHING WENT WRONG</p>
          <p style={{fontSize:12,color:D.muted,lineHeight:1.65,marginBottom:20}}>
            An error occurred in this section. Your data is safe.
          </p>
          <button onClick={()=>this.setState({hasError:false})}
            style={{background:D.bk,color:D.yl,borderRadius:10,padding:"11px 22px",
              fontFamily:"'Unbounded',monospace",fontSize:8,fontWeight:700,letterSpacing:".1em"}}>
            TRY AGAIN
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── ROOT APP ──────────────────────────────────────────────
export default function App() {
  const saved   = LS.get("mv3_settings")||{};
  const [tab,   setTab]   = useState("home");
  const [apiKey,setApiKey]= useState(saved.apiKey||"");
  const [goal,  setGoal]  = useState(saved.goal||90);
  const [accessToken,setAccessToken] = useState(saved.accessToken||"");
  const [historyOpen,setHistoryOpen] = useState(false);
  const [entries,setEntries]=useState([]);
  const [section,setSection]=useState("morning");
  const [mode,  setMode]  = useState("template");
  const [saving,setSaving]=useState(false);
  const [savedMsg,setSavedMsg]=useState(false);
  const [backupReminder,setBackupReminder]=useState(false);
  const [migrationNote,setMigrationNote]=useState(null);
  const [pinSetupComplete,setPinSetupComplete]=useState(false);
  const [pinUnlocked,setPinUnlocked]=useState(false);
  const [onboardingComplete,setOnboardingComplete]=useState(()=>localStorage.getItem("mindwrite_onboarding_complete")==="true");
  const [guideOpen,setGuideOpen]=useState(false);
  const [metricsOpen,setMetricsOpen]=useState(false);
  const entryUpdateRef = useRef(null); // pending IDB save from updateEntry

  const date = toISO();
  const te   = entries.find(e=>e.date===date)||{date,morning:newMorning(),evening:newEvening()};
  const morning=te.morning||newMorning();
  const evening=te.evening||newEvening();

  useEffect(()=>{
    (async()=>{
      const moved = await migrateFromLS().catch(()=>0);
      if (moved > 0) setMigrationNote(`Moved ${moved} legacy ${moved===1?"entry":"entries"} to local database.`);
      const all = await idb.getAll(S.entries).catch(()=>[]);
      const sorted = all.sort((a,b)=>b.date.localeCompare(a.date));
      setEntries(sorted);
      const m = await getManifest().catch(()=>null);
      if (!m) await updateManifest(sorted, false).catch(()=>{});
      // Track app open
      trackEvent("app_open", "app").catch(()=>{});
    })();
  },[]);

  // PIN lock initialization — check if PIN is set on app load
  useEffect(()=>{
    const pinIsSet = !!localStorage.getItem("mv_pin_set");
    setPinSetupComplete(pinIsSet);
    if (pinIsSet) setPinUnlocked(false); // Locked by default if PIN exists
  },[]);

  // Auto-lock on visibility change (tab blur/focus)
  useEffect(()=>{
    const handleVisibility = () => {
      if (document.hidden && pinSetupComplete) {
        setPinUnlocked(false); // Lock when tab becomes hidden
      } else if (!document.hidden) {
        // Track app open when coming back to focus
        trackEvent("app_open", "app").catch(()=>{});
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  },[pinSetupComplete]);

  // Keyboard shortcut for metrics dashboard (Ctrl+Shift+M)
  useEffect(()=>{
    const handleKeyPress = (e) => {
      if (e.ctrlKey && e.shiftKey && e.code === "KeyM") {
        e.preventDefault();
        setMetricsOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  },[]);

  useEffect(()=>{
    const handler = e => setEntries(e.detail||[]);
    window.addEventListener("mv_reload_entries", handler);
    return ()=>window.removeEventListener("mv_reload_entries", handler);
  },[]);

  const upsert=useCallback((field,value)=>{
    // State updater must be pure — no IDB side-effects inside.
    // Persistence is handled by the debounced autosave useEffect below.
    setEntries(prev=>{
      const ex=prev.find(e=>e.date===date);
      const updated=ex?{...ex,[field]:value}:{date,morning:newMorning(),evening:newEvening(),[field]:value};
      return [updated,...prev.filter(e=>e.date!==date)].sort((a,b)=>b.date.localeCompare(a.date));
    });
  },[date]);

  // Update any entry by date (used by HomeScreen to complete carryover tasks).
  // State updater is pure; IDB write is deferred via entryUpdateRef.
  const updateEntry=useCallback((entryDate,field,value)=>{
    setEntries(prev=>{
      const ex=prev.find(e=>e.date===entryDate);
      if(!ex) return prev;
      const updated={...ex,[field]:value};
      entryUpdateRef.current=updated; // picked up by flush effect below
      return prev.map(e=>e.date===entryDate?updated:e);
    });
  },[]);

  // Flush pending updateEntry IDB saves after entries state settles.
  useEffect(()=>{
    const toSave=entryUpdateRef.current;
    if(!toSave) return;
    entryUpdateRef.current=null;
    idb.set(S.entries, toSave).catch(()=>{});
  },[entries]);

  // Debounced autosave for today's entry (handles text fields + photos).
  useEffect(()=>{
    const t=setTimeout(()=>idb.set(S.entries, te).catch(()=>{}), 700);
    return ()=>clearTimeout(t);
  },[morning,evening]); // eslint-disable-line

  const handleSave=async(field,data)=>{
    setSaving(true);
    try{
      const analysis=await analyzeEntry(apiKey,JSON.stringify(data),buildMemoryContext(entries)).catch(()=>({}));
      upsert(field,{...data,...analysis});
      setSavedMsg(true); setTimeout(()=>setSavedMsg(false),2500);
      setMode("template");
      // Track entry creation
      trackEvent("entry_created", "journal", { section: field }).catch(()=>{});
      setTimeout(async()=>{
        const current=await idb.getAll(S.entries).catch(()=>[]);
        await updateManifest(current, false).catch(()=>{});
        const remind=await shouldRemindBackup(current).catch(()=>false);
        if(remind) setBackupReminder(true);
      },800);
    }finally{setSaving(false);}
  };

  const handleExport=async()=>{ await doExport(entries); setBackupReminder(false); };
  const handleDismissReminder=async()=>{ setBackupReminder(false); await snoozeReminder(entries).catch(()=>{}); };

  const handleDisablePin=()=>{
    localStorage.removeItem("mv_pin");
    localStorage.removeItem("mv_pin_set");
    setPinSetupComplete(false);
    setPinUnlocked(false);
  };

  const handleCompleteOnboarding=()=>{
    setOnboardingComplete(true);
  };

  const handleResetOnboarding=()=>{
    localStorage.removeItem("mindwrite_onboarding_complete");
    setOnboardingComplete(false);
  };

  const handleOpenMeditationFromOnboarding=()=>{
    // Opens Jose Silva YouTube channel in new tab
    window.open("https://www.youtube.com/@SilvaMethodOfficial", "_blank");
  };

  const navigate=(m,sec)=>{ if(sec) setSection(sec); setMode(m); setTab("today"); };

  const handleTabChange = (tabId) => {
    setTab(tabId);
    if (tabId !== "home") {
      // Track feature usage (map tab IDs to feature names)
      const featureMap = {
        throne: "throne",
        jarvis: "jarvis",
        context: "vault",
        games: "games",
        settings: "settings"
      };
      if (featureMap[tabId]) {
        trackEvent("feature_use", featureMap[tabId]).catch(()=>{});
      }
    }
    if (tabId === "home") setHistoryOpen(false);
  };

  const handleOpenGuide = () => {
    setGuideOpen(true);
    trackEvent("feature_use", "guide").catch(()=>{});
  };

  // PIN SETUP — if PIN not set yet, show setup flow and block everything else
  if (!pinSetupComplete) {
    return <PinSetup onComplete={()=>{ setPinSetupComplete(true); setPinUnlocked(true); }} />;
  }

  // PIN LOCK — if PIN is set but not unlocked, show lock screen
  if (!pinUnlocked) {
    return <PinLock isLocked={true} onUnlock={()=>setPinUnlocked(true)} />;
  }

  // ONBOARDING — if unlocked but onboarding not complete, show flow
  if (!onboardingComplete) {
    return <OnboardingFlow onComplete={handleCompleteOnboarding} onOpenMeditation={handleOpenMeditationFromOnboarding} />;
  }

  // NORMAL APP FLOW — PIN is set, unlocked, and onboarding complete
  if(tab==="today"&&(mode==="guided"||mode==="scan")) return(
    <div style={{background:D.bg,minHeight:"100vh",maxWidth:480,margin:"0 auto"}}>
      {mode==="guided"&&(
        <GuidedWalkthrough section={section} data={section==="morning"?morning:evening}
          apiKey={apiKey} onChange={d=>upsert(section,d)} onDone={d=>handleSave(section,d)} onExit={()=>setMode("template")}/>
      )}
      {mode==="scan"&&(
        <div style={{padding:"14px 16px"}}>
          <div style={{background:D.bk,borderRadius:14,padding:"12px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
            <button onClick={()=>setMode("template")} style={{color:D.yl,fontFamily:"'Unbounded',monospace",fontSize:9,letterSpacing:".1em",fontWeight:700}}>← BACK</button>
            <div style={{display:"flex",gap:4,marginLeft:"auto"}}>
              {[{id:"morning",l:"☀ MORN"},{id:"evening",l:"🌙 EVE"}].map(s=>(
                <button key={s.id} onClick={()=>setSection(s.id)}
                  style={{padding:"5px 8px",borderRadius:7,fontFamily:"'Unbounded',monospace",fontSize:7,fontWeight:700,
                    background:section===s.id?D.yl:"transparent",color:section===s.id?"#000":D.yl,border:`1.5px solid ${D.yl}`}}>
                  {s.l}
                </button>
              ))}
            </div>
          </div>
          <ScanFlow section={section} date={date} apiKey={apiKey} onComplete={d=>handleSave(section,d)}/>
        </div>
      )}
      {saving&&(
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",
          background:D.bk,color:D.yl,padding:"10px 20px",borderRadius:24,
          display:"flex",gap:8,alignItems:"center",fontFamily:"'Unbounded',monospace",fontSize:9,letterSpacing:".1em",zIndex:999}}>
          <Spinner size={12} color={D.yl}/>SAVING…
        </div>
      )}
    </div>
  );

  return(
    <div style={{background:D.bg,minHeight:"100vh",maxWidth:480,margin:"0 auto"}}>
      <div style={{paddingBottom:80}}>
        {tab==="home"&&!historyOpen&&<HomeScreen entries={entries} goal={goal} onNavigate={navigate} onOpenHistory={()=>setHistoryOpen(true)} onUpdateEntry={updateEntry} apiKey={apiKey} onOpenGuide={()=>setGuideOpen(true)}/>}
        {tab==="home"&&historyOpen&&<JournalHistoryScreen entries={entries} onBack={()=>setHistoryOpen(false)}/>}

        {tab==="today"&&(
          <div>
            <div style={{background:D.bk,padding:"14px 16px 12px"}}>
              <SLabel color={D.yl} style={{marginBottom:8}}>TODAY'S RECORD</SLabel>
              <div style={{background:"#1a1a1a",borderRadius:10,padding:3,display:"grid",gridTemplateColumns:"1fr 1fr",gap:3,marginBottom:8}}>
                {[{id:"morning",l:"☀ MORNING"},{id:"evening",l:"🌙 EVENING"}].map(s=>(
                  <button key={s.id} onClick={()=>setSection(s.id)}
                    style={{padding:"8px",borderRadius:8,fontFamily:"'Unbounded',monospace",fontSize:7,
                      fontWeight:700,letterSpacing:".08em",transition:"all .2s",
                      background:section===s.id?D.white:"transparent",
                      color:section===s.id?D.bk:"#555",
                      boxShadow:section===s.id?`0 1px 4px ${D.shadow}`:"none"}}>
                    {s.l}
                  </button>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4}}>
                {[{id:"template",l:"TEMPLATE"},{id:"scan",l:"📷 SCAN"},{id:"guided",l:"🎙 GUIDED"}].map(m=>(
                  <button key={m.id} onClick={()=>setMode(m.id)}
                    style={{padding:"7px 4px",borderRadius:8,fontFamily:"'Unbounded',monospace",fontSize:6.5,
                      fontWeight:700,letterSpacing:".06em",transition:"all .15s",
                      background:mode===m.id?D.yl:"transparent",
                      color:mode===m.id?"#000":"#555",
                      border:`1.5px solid ${mode===m.id?D.yl:"#333"}`}}>
                    {m.l}
                  </button>
                ))}
              </div>
            </div>
            <AccentStrip/>
            <div style={{padding:"14px 16px"}}>
              <JournalErrorBoundary>
                {section==="morning"
                  ?<MorningTemplate data={morning} onChange={d=>upsert("morning",d)}/>
                  :<EveningTemplate data={evening} onChange={d=>upsert("evening",d)}/>
                }
              </JournalErrorBoundary>
              <button onClick={()=>handleSave(section,section==="morning"?morning:evening)} disabled={saving}
                style={{width:"100%",background:saving?"#333":D.bk,color:D.yl,borderRadius:12,padding:"14px",
                  fontFamily:"'Unbounded',monospace",fontSize:10,fontWeight:700,letterSpacing:".12em",
                  marginTop:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"all .2s"}}>
                {saving?<><Spinner size={14} color={D.yl}/>SAVING…</>:"SAVE ENTRY →"}
              </button>
              {savedMsg&&<p style={{textAlign:"center",fontSize:12,color:"#16a34a",marginTop:8,fontWeight:600}}>✓ Saved</p>}
              <p style={{textAlign:"center",fontSize:10,color:D.muted,marginTop:4}}>Autosaved as you type</p>
            </div>
          </div>
        )}

        {tab==="vault"&&<VaultScreen entries={entries}/>}
        {tab==="throne"&&<ThroneTalk/>}
        {tab==="jarvis"&&<Jarvis token={accessToken}/>}
        {tab==="context"&&<JarvisVault/>}
        {tab==="games"&&<MindGamesWorkspace/>}

        {tab==="settings"&&<SettingsScreen apiKey={apiKey} setApiKey={setApiKey} goal={goal} setGoal={setGoal}
          entries={entries} onExport={handleExport} accessToken={accessToken} setAccessToken={setAccessToken}
          pinSetupComplete={pinSetupComplete} onDisablePin={handleDisablePin}
          onOpenGuide={handleOpenGuide} onResetOnboarding={handleResetOnboarding}
          onOpenMetrics={()=>setMetricsOpen(true)}/>}
      </div>

      {backupReminder&&<BackupReminder entries={entries} onExport={handleExport} onDismiss={handleDismissReminder}/>}

      {migrationNote&&(
        <div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",
          background:"#16a34a",color:"#fff",padding:"8px 16px",borderRadius:20,
          fontSize:11,fontWeight:600,zIndex:400,whiteSpace:"nowrap",
          boxShadow:"0 4px 16px rgba(0,0,0,0.2)"}}
          onClick={()=>setMigrationNote(null)}>
          ✓ {migrationNote}
        </div>
      )}

      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,
        background:"rgba(240,237,229,0.9)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",
        borderTop:`1px solid ${D.border}`,display:"flex",
        height:"calc(72px + env(safe-area-inset-bottom))",
        paddingBottom:"env(safe-area-inset-bottom)",zIndex:200}}>
        {[{id:"home",l:"HOME",icon:"⌂"},{id:"throne",l:"THRONE",icon:"🚽"},
          {id:"jarvis",l:"ORPHEUS",icon:"⚡"},{id:"context",l:"VAULT",icon:"◧"},
          {id:"games",l:"GAMES",icon:"🧠"},
          {id:"settings",l:"MORE",icon:"☰"}].map((t)=>{
          const active=t.id===tab;
          return(
            <button key={t.id} onClick={()=>handleTabChange(t.id)}
              style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",
                justifyContent:"center",gap:2,paddingBottom:8,paddingTop:8}}>
              <span style={{fontSize:20,lineHeight:1,opacity:active?1:.28,transition:"opacity .2s"}}>{t.icon}</span>
              <span style={{fontFamily:"'Unbounded',monospace",fontSize:6,letterSpacing:".08em",fontWeight:700,
                color:active?D.bk:D.muted,transition:"color .2s"}}>{t.l}</span>
            </button>
          );
        })}
      </div>

      {/* Guide Modal Overlay */}
      {guideOpen&&<GuideModal onClose={()=>setGuideOpen(false)}/>}

      {/* Metrics Dashboard */}
      {metricsOpen&&<MetricsScreen onClose={()=>setMetricsOpen(false)}/>}
    </div>
  );
}
