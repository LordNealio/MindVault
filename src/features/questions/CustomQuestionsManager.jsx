import { useState, useCallback } from "react";
import {
  CATEGORIES, CORE_MORNING, CORE_EVENING, QUESTION_PACKS,
  MORNING_SECTIONS, EVENING_SECTIONS,
  loadQuestions, getActiveQuestions,
  createQuestion, updateQuestion, deleteQuestion,
  togglePin, toggleActive, moveQuestion,
  isPackInstalled, installPack,
  loadSectionPrefs, toggleSection,
} from "./customQuestions.js";

// ── Design tokens ─────────────────────────────────────────
const D = {
  bg:"#F0EDE5", surf:"#FAFAF7", bk:"#0A0A0A",
  border:"#E8E4DA", muted:"#9B9589", txt:"#0A0A0A",
  yl:"#E8B84B", rd:"#C1121F", bl:"#1D3557",
  r:14,
};

const CAT_OPTS = Object.entries(CATEGORIES).map(([id, v]) => ({ id, ...v }));

// ── Small helpers ─────────────────────────────────────────
function SLabel({ children, color = D.txt, style = {} }) {
  return (
    <div style={{ fontFamily:"'Unbounded',monospace", fontSize:8, fontWeight:700,
      letterSpacing:".12em", color, ...style }}>
      {children}
    </div>
  );
}
function CategoryBadge({ category }) {
  const cat = CATEGORIES[category] || CATEGORIES.custom;
  return (
    <span style={{ fontFamily:"'Unbounded',monospace", fontSize:6.5, fontWeight:700,
      letterSpacing:".08em", color:cat.color,
      background:cat.color + "18", borderRadius:6,
      padding:"2px 7px", flexShrink:0 }}>
      {cat.label.toUpperCase()}
    </span>
  );
}

// ── Core question card (read-only) ────────────────────────
function CoreCard({ q }) {
  return (
    <div style={{ padding:"11px 14px", background:"#F5F3EE",
      borderRadius:10, border:`1px solid ${D.border}`,
      display:"flex", alignItems:"center", gap:10 }}>
      <span style={{ fontSize:13, flexShrink:0 }}>🔒</span>
      <div style={{ flex:1, fontSize:12, color:D.txt, lineHeight:1.5 }}>{q.promptText}</div>
      <CategoryBadge category={q.category}/>
    </div>
  );
}

// ── Custom question card ──────────────────────────────────
function QuestionCard({ q, onEdit, onRefresh }) {
  const cat = CATEGORIES[q.category] || CATEGORIES.custom;
  return (
    <div style={{
      padding:"12px 14px", background:D.surf,
      borderRadius:12, border:`1.5px solid ${q.isPinned ? cat.color : D.border}`,
      display:"flex", flexDirection:"column", gap:8,
    }}>
      {/* Top row */}
      <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
        <div style={{ flex:1, fontSize:13, fontWeight:600, color:D.txt, lineHeight:1.5 }}>
          {q.promptText}
        </div>
        <div style={{ display:"flex", gap:6, flexShrink:0, marginTop:1 }}>
          {/* Pin */}
          <button
            title={q.isPinned ? "Unpin" : "Pin"}
            onClick={() => { togglePin(q.id); onRefresh(); }}
            style={{ width:28, height:28, borderRadius:8,
              background: q.isPinned ? cat.color + "22" : "transparent",
              border:`1px solid ${q.isPinned ? cat.color : D.border}`,
              fontSize:13, cursor:"pointer", color: q.isPinned ? cat.color : D.muted }}>
            📌
          </button>
          {/* Edit */}
          <button
            title="Edit"
            onClick={() => onEdit(q)}
            style={{ width:28, height:28, borderRadius:8,
              background:"transparent", border:`1px solid ${D.border}`,
              fontSize:13, cursor:"pointer" }}>
            ✎
          </button>
          {/* Delete */}
          <button
            title="Delete"
            onClick={() => { if (confirm("Delete this question?")) { deleteQuestion(q.id); onRefresh(); } }}
            style={{ width:28, height:28, borderRadius:8,
              background:"transparent", border:`1px solid ${D.border}`,
              fontSize:13, cursor:"pointer", color:D.rd }}>
            ✕
          </button>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <CategoryBadge category={q.category}/>
        {q.timeOfDay === "both" && (
          <span style={{ fontSize:9, color:D.muted }}>Morning &amp; Evening</span>
        )}
        <div style={{ flex:1 }}/>
        {/* Active toggle */}
        <button
          onClick={() => { toggleActive(q.id); onRefresh(); }}
          style={{
            padding:"3px 10px", borderRadius:20, fontSize:9, fontWeight:600,
            border:`1px solid ${q.isActive ? "#16a34a" : D.border}`,
            background: q.isActive ? "#f0fdf4" : "transparent",
            color: q.isActive ? "#16a34a" : D.muted, cursor:"pointer",
          }}>
          {q.isActive ? "Active" : "Retired"}
        </button>
        {/* Move up/down */}
        <div style={{ display:"flex", gap:2 }}>
          {["up","down"].map(dir => (
            <button key={dir}
              onClick={() => { moveQuestion(q.id, dir); onRefresh(); }}
              style={{ width:22, height:22, borderRadius:6, fontSize:11,
                background:"transparent", border:`1px solid ${D.border}`,
                cursor:"pointer", color:D.muted }}>
              {dir === "up" ? "↑" : "↓"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Add / Edit form ───────────────────────────────────────
function QuestionForm({ initial, defaultTOD, onSave, onCancel }) {
  const [text, setText]   = useState(initial?.promptText || "");
  const [tod,  setTod]    = useState(initial?.timeOfDay  || defaultTOD || "morning");
  const [cat,  setCat]    = useState(initial?.category   || "custom");
  const valid = text.trim().length > 4;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12,
      background:"#F5F3EE", borderRadius:14, padding:"16px 14px",
      border:`1.5px solid ${D.border}` }}>
      <SLabel>{initial ? "EDIT QUESTION" : "ADD QUESTION"}</SLabel>

      <textarea
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Type your question…"
        rows={3}
        style={{ padding:"10px 12px", borderRadius:10, border:`1.5px solid ${D.border}`,
          fontSize:13, color:D.txt, background:D.surf, resize:"none",
          fontFamily:"inherit", lineHeight:1.6, outline:"none" }}
      />

      {/* Time of day */}
      <div>
        <SLabel style={{ marginBottom:6, color:D.muted }}>WHEN</SLabel>
        <div style={{ display:"flex", gap:8 }}>
          {[["morning","Morning ☀️"],["evening","Evening 🌙"],["both","Both"]].map(([v,l]) => (
            <button key={v} onClick={() => setTod(v)} style={{
              flex:1, padding:"8px 4px", borderRadius:8, fontSize:11, fontWeight:600,
              border:`1.5px solid ${tod === v ? D.bk : D.border}`,
              background: tod === v ? D.bk : "transparent",
              color: tod === v ? D.yl : D.muted, cursor:"pointer",
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Category */}
      <div>
        <SLabel style={{ marginBottom:6, color:D.muted }}>CATEGORY</SLabel>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {CAT_OPTS.map(c => (
            <button key={c.id} onClick={() => setCat(c.id)} style={{
              padding:"5px 10px", borderRadius:20, fontSize:10, fontWeight:600,
              border:`1.5px solid ${cat === c.id ? c.color : D.border}`,
              background: cat === c.id ? c.color + "22" : "transparent",
              color: cat === c.id ? c.color : D.muted, cursor:"pointer",
            }}>{c.label}</button>
          ))}
        </div>
      </div>

      <div style={{ display:"flex", gap:8 }}>
        <button
          disabled={!valid}
          onClick={() => valid && onSave({ promptText:text.trim(), timeOfDay:tod, category:cat })}
          style={{ flex:1, padding:"12px", borderRadius:10, border:"none",
            background: valid ? D.bk : D.border,
            color: valid ? D.yl : D.muted,
            fontFamily:"'Unbounded',monospace", fontSize:9,
            fontWeight:700, letterSpacing:".08em",
            cursor: valid ? "pointer" : "not-allowed" }}>
          {initial ? "SAVE" : "ADD"}
        </button>
        <button onClick={onCancel} style={{
          padding:"12px 16px", borderRadius:10,
          border:`1.5px solid ${D.border}`, background:"transparent",
          fontSize:11, color:D.muted, cursor:"pointer",
        }}>Cancel</button>
      </div>
    </div>
  );
}

// ── Pack card ─────────────────────────────────────────────
function PackCard({ pack, onInstall }) {
  const installed = isPackInstalled(pack.id);
  const [done, setDone] = useState(false);

  function handleInstall() {
    const count = installPack(pack.id);
    setDone(true);
    onInstall(count);
  }

  return (
    <div style={{ background:D.surf, borderRadius:14,
      border:`1.5px solid ${D.border}`, padding:"14px 14px" }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:8 }}>
        <span style={{ fontSize:22, flexShrink:0 }}>{pack.icon}</span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:13, color:D.txt }}>{pack.name}</div>
          <div style={{ fontSize:11, color:D.muted, marginTop:2, lineHeight:1.5 }}>
            {pack.description}
          </div>
        </div>
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:10 }}>
        {pack.questions.map((pq, i) => (
          <span key={i} style={{ fontSize:10, color:D.muted, background:"#F5F3EE",
            borderRadius:6, padding:"3px 8px", lineHeight:1.4 }}>
            {pq.promptText.length > 42 ? pq.promptText.slice(0, 42) + "…" : pq.promptText}
          </span>
        ))}
      </div>
      <button
        onClick={handleInstall}
        disabled={installed || done}
        style={{
          width:"100%", padding:"10px", borderRadius:10, border:"none",
          background: (installed || done) ? "#f0fdf4" : D.bk,
          color: (installed || done) ? "#16a34a" : D.yl,
          fontFamily:"'Unbounded',monospace", fontSize:9,
          fontWeight:700, letterSpacing:".08em",
          cursor: (installed || done) ? "default" : "pointer",
        }}>
        {(installed || done) ? "✓ INSTALLED" : "INSTALL PACK"}
      </button>
    </div>
  );
}

// ── Section toggle row ────────────────────────────────────
function SectionRow({ section, visible, onToggle }) {
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:12,
      padding:"12px 14px",
      background: visible ? D.surf : "#F5F3EE",
      borderRadius:12,
      border:`1.5px solid ${visible ? D.border : "#ddd"}`,
    }}>
      <span style={{ fontSize:20, flexShrink:0, lineHeight:1 }}>{section.icon}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:700, fontSize:13, color: visible ? D.txt : D.muted,
          lineHeight:1.3 }}>
          {section.label}
        </div>
        <div style={{ fontSize:10, color:D.muted, marginTop:2, lineHeight:1.4 }}>
          {section.desc}
        </div>
        {section.note && (
          <div style={{ fontSize:9, color:"#E8B84B", marginTop:3, fontStyle:"italic" }}>
            ⚠ {section.note}
          </div>
        )}
      </div>
      {/* Toggle */}
      <button
        onClick={onToggle}
        style={{
          width:44, height:26, borderRadius:13, border:"none", cursor:"pointer",
          background: visible ? "#16a34a" : "#ddd",
          position:"relative", transition:"background .2s", flexShrink:0,
        }}
      >
        <div style={{
          width:20, height:20, borderRadius:"50%", background:"#fff",
          position:"absolute", top:3,
          left: visible ? 21 : 3,
          transition:"left .2s",
          boxShadow:"0 1px 4px rgba(0,0,0,.2)",
        }}/>
      </button>
    </div>
  );
}

function SectionsTab({ onRefresh }) {
  const [prefs, setPrefs] = useState(() => loadSectionPrefs());

  function handleToggle(tod, id) {
    toggleSection(tod, id);
    setPrefs(loadSectionPrefs());
    onRefresh();
  }

  return (
    <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:16 }}>
      <p style={{ fontSize:11, color:D.muted, lineHeight:1.65 }}>
        Turn off sections you don't need. Required sections can't be hidden.
        Changes apply immediately to your journal.
      </p>

      {/* Morning sections */}
      <div>
        <SLabel style={{ marginBottom:10 }}>☀️ MORNING</SLabel>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {MORNING_SECTIONS.map(s => (
            <SectionRow
              key={s.id}
              section={s}
              visible={prefs.morning?.[s.id] !== false}
              onToggle={() => handleToggle("morning", s.id)}
            />
          ))}
        </div>
      </div>

      {/* Evening sections */}
      <div>
        <SLabel style={{ marginBottom:10 }}>🌙 EVENING</SLabel>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {EVENING_SECTIONS.map(s => (
            <SectionRow
              key={s.id}
              section={s}
              visible={prefs.evening?.[s.id] !== false}
              onToggle={() => handleToggle("evening", s.id)}
            />
          ))}
        </div>
      </div>
      <div style={{ height:20 }}/>
    </div>
  );
}

// ── Main manager overlay ──────────────────────────────────
export function CustomQuestionsManager({ onClose }) {
  const [tab, setTab]       = useState("morning");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null); // question object
  const [tick, setTick]     = useState(0);       // force re-render
  const [packMsg, setPackMsg] = useState(null);
  const [showRetired, setShowRetired] = useState(false);
  const [showPacks, setShowPacks]     = useState(false);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  const coreQs   = tab === "morning" ? CORE_MORNING : CORE_EVENING;
  const allCustom = loadQuestions().filter(q => q.timeOfDay === tab || q.timeOfDay === "both");
  const active   = allCustom.filter(q => q.isActive)
    .sort((a, b) => (a.isPinned ? -1 : b.isPinned ? 1 : 0) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const retired  = allCustom.filter(q => !q.isActive);

  function handleSaveNew(fields) {
    createQuestion({ ...fields, timeOfDay: fields.timeOfDay || tab });
    setAdding(false);
    refresh();
  }
  function handleSaveEdit(fields) {
    updateQuestion(editing.id, fields);
    setEditing(null);
    refresh();
  }
  function handlePackInstall(count) {
    setPackMsg(count > 0 ? `✓ Added ${count} question${count > 1 ? "s" : ""}` : "Already installed");
    refresh();
    setTimeout(() => setPackMsg(null), 2500);
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {/* Header */}
      <div style={{ flexShrink:0, background:D.bk, padding:"14px 16px",
        display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <SLabel color={D.yl} style={{ marginBottom:2 }}>CUSTOM REFLECTION</SLabel>
          <div style={{ fontFamily:"'Unbounded',monospace", fontSize:14,
            fontWeight:900, color:"#FAFAF7" }}>DAILY QUESTIONS</div>
        </div>
        <button onClick={onClose} style={{ width:32, height:32, borderRadius:"50%",
          background:"rgba(255,255,255,.1)", border:"none", color:"rgba(255,255,255,.6)",
          fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div style={{ flexShrink:0, display:"flex", borderBottom:`2px solid ${D.border}`,
        background:D.surf }}>
        {[["morning","☀️ Morning"],["evening","🌙 Evening"],["sections","⚙️ Sections"]].map(([v, l]) => (
          <button key={v} onClick={() => { setTab(v); setAdding(false); setEditing(null); }}
            style={{ flex:1, padding:"12px 4px", border:"none", background:"transparent",
              fontFamily:"'Unbounded',monospace", fontSize:7.5, fontWeight:700,
              letterSpacing:".06em", cursor:"pointer",
              color: tab === v ? D.bk : D.muted,
              borderBottom: tab === v ? `3px solid ${D.bk}` : "3px solid transparent",
              marginBottom:-2 }}>
            {l}
          </button>
        ))}
      </div>

      {/* Scrollable body */}
      <div style={{ flex:1, overflowY:"auto",
        ...(tab !== "sections" ? { padding:"14px 16px" } : {}),
        display:"flex", flexDirection:"column", gap:10 }}>

        {/* Sections tab */}
        {tab === "sections" && <SectionsTab onRefresh={refresh}/>}

        {/* Questions tab content (morning / evening only) */}
        {tab !== "sections" && packMsg && (
          <div style={{ padding:"10px 14px", borderRadius:10, background:"#f0fdf4",
            border:"1px solid #bbf7d0", fontSize:12, color:"#16a34a", fontWeight:600 }}>
            {packMsg}
          </div>
        )}

        {tab !== "sections" && <>
        {/* Core questions */}
        <div>
          <SLabel color={D.muted} style={{ marginBottom:8 }}>CORE (ALWAYS INCLUDED)</SLabel>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {coreQs.map(q => <CoreCard key={q.id} q={q}/>)}
          </div>
        </div>

        {/* Add / Edit form */}
        {adding && (
          <QuestionForm
            defaultTOD={tab}
            onSave={handleSaveNew}
            onCancel={() => setAdding(false)}
          />
        )}
        {editing && (
          <QuestionForm
            initial={editing}
            defaultTOD={tab}
            onSave={handleSaveEdit}
            onCancel={() => setEditing(null)}
          />
        )}

        {/* Add button */}
        {!adding && !editing && (
          <button onClick={() => setAdding(true)} style={{
            width:"100%", padding:"12px", borderRadius:12,
            border:`2px dashed ${D.border}`, background:"transparent",
            fontFamily:"'Unbounded',monospace", fontSize:8, fontWeight:700,
            letterSpacing:".1em", color:D.muted, cursor:"pointer",
          }}>
            + ADD QUESTION
          </button>
        )}

        {/* Active custom questions */}
        {active.length > 0 && (
          <div>
            <SLabel color={D.muted} style={{ marginBottom:8 }}>
              YOUR QUESTIONS ({active.length})
            </SLabel>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {active.map(q => (
                <QuestionCard key={q.id + tick} q={q}
                  onEdit={setEditing} onRefresh={refresh}/>
              ))}
            </div>
          </div>
        )}

        {/* Retired questions */}
        {retired.length > 0 && (
          <div>
            <button onClick={() => setShowRetired(r => !r)}
              style={{ display:"flex", alignItems:"center", gap:6, background:"none",
                border:"none", cursor:"pointer", padding:"4px 0" }}>
              <span style={{ fontSize:10, color:D.muted, transition:"transform .2s",
                display:"inline-block", transform:showRetired?"rotate(90deg)":"none" }}>›</span>
              <SLabel color={D.muted}>RETIRED ({retired.length})</SLabel>
            </button>
            {showRetired && (
              <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:6 }}>
                {retired.map(q => (
                  <QuestionCard key={q.id + tick} q={q}
                    onEdit={setEditing} onRefresh={refresh}/>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Question Packs */}
        <div style={{ paddingTop:4, borderTop:`1px solid ${D.border}` }}>
          <button onClick={() => setShowPacks(p => !p)}
            style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
              width:"100%", background:"none", border:"none", cursor:"pointer",
              padding:"8px 0" }}>
            <SLabel>QUESTION PACKS</SLabel>
            <span style={{ fontSize:16, color:D.muted,
              transform:showPacks?"rotate(90deg)":"none", transition:"transform .2s" }}>›</span>
          </button>
          {showPacks && (
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:6 }}>
              <p style={{ fontSize:11, color:D.muted, lineHeight:1.6 }}>
                Install a pack to add a curated set of questions to your journal.
              </p>
              {QUESTION_PACKS.map(pack => (
                <PackCard key={pack.id} pack={pack} onInstall={handlePackInstall}/>
              ))}
            </div>
          )}
        </div>

        {/* Bottom space */}
        <div style={{ height:20 }}/>
        </>}
      </div>
    </div>
  );
}

// ── CustomQuestionsSection (used inside journal templates) ─
const DEFAULT_VISIBLE = 3;

export function CustomQuestionsSection({ timeOfDay, answers = {}, onChange }) {
  const [showAll, setShowAll]   = useState(false);
  const [tick, setTick]         = useState(0);

  const questions = getActiveQuestions(timeOfDay);
  // Re-read on every render (tick) to pick up changes made in manager
  const visible = showAll ? questions : questions.slice(0, DEFAULT_VISIBLE);
  const hidden  = questions.length - DEFAULT_VISIBLE;

  if (questions.length === 0) return null;

  function setAnswer(id, val) {
    onChange({ ...answers, [id]: val });
  }

  return (
    <div style={{ background:D.surf, borderRadius:D.r,
      border:`1.5px solid ${D.border}`, overflow:"hidden" }}>
      {/* Header */}
      <div style={{ padding:"10px 14px 8px",
        borderBottom:`1px solid ${D.border}`, background:"#F5F3EE" }}>
        <div style={{ fontFamily:"'Unbounded',monospace", fontSize:7.5, fontWeight:700,
          letterSpacing:".12em", color:D.muted }}>
          CUSTOM QUESTIONS
        </div>
      </div>

      {/* Questions */}
      <div style={{ padding:"10px 14px", display:"flex", flexDirection:"column", gap:12 }}>
        {visible.map(q => {
          const cat = CATEGORIES[q.category] || CATEGORIES.custom;
          return (
            <div key={q.id}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
                {q.isPinned && (
                  <span style={{ fontSize:9, color:cat.color }}>📌</span>
                )}
                <div style={{ fontSize:12, fontWeight:600, color:D.txt, lineHeight:1.45, flex:1 }}>
                  {q.promptText}
                </div>
                <CategoryBadge category={q.category}/>
              </div>
              <textarea
                value={answers[q.id] || ""}
                onChange={e => setAnswer(q.id, e.target.value)}
                placeholder="Your response…"
                rows={2}
                style={{ width:"100%", boxSizing:"border-box",
                  padding:"9px 11px", borderRadius:8,
                  border:`1.5px solid ${D.border}`, fontSize:12,
                  color:D.txt, background:D.bg,
                  resize:"none", fontFamily:"inherit", lineHeight:1.6,
                  outline:"none" }}
              />
            </div>
          );
        })}

        {/* Show more / less */}
        {hidden > 0 && (
          <button
            onClick={() => setShowAll(s => !s)}
            style={{ alignSelf:"center", padding:"6px 16px", borderRadius:20,
              border:`1px solid ${D.border}`, background:"transparent",
              fontSize:11, color:D.muted, cursor:"pointer" }}>
            {showAll ? "Show less ↑" : `Show ${hidden} more ↓`}
          </button>
        )}
      </div>
    </div>
  );
}
