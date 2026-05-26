import { useState, useEffect, useCallback } from "react";
import { dbGetByIndex, dbPut, dbDelete } from "../lib/db.js";
import { today, uuid, fmtDateLong, getWeekNumber } from "../lib/utils.js";

const ENERGY_LABELS = ["", "Low", "Moderate", "Okay", "Good", "High"];
const ENERGY_EMOJI  = ["", "😴", "🥱", "😐", "😊", "🔥"];
const CATEGORIES = ["Deadline", "Data Error", "Process Gap", "Communication", "Tool Failure", "Rework", "Other"];
const IMPACTS = ["Low", "Medium", "High"];
const STATUSES = [
  { id: "open",       label: "Open",        color: "amber" },
  { id: "analyzing",  label: "Analyzing",   color: "purple" },
  { id: "resolved",   label: "Resolved",    color: "green" },
];

// ─── Shared UI primitives ──────────────────────────────────────
function Sheet({ T, onClose, children, title }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "flex-end",
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: T.surface, borderRadius: "24px 24px 0 0",
        padding: "0 20px 32px", width: "100%", maxHeight: "90dvh",
        overflowY: "auto", boxShadow: "0 -8px 40px rgba(0,0,0,0.4)",
      }}>
        <div style={{ textAlign: "center", padding: "12px 0 16px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border, margin: "0 auto" }} />
        </div>
        {title && (
          <h2 style={{
            fontFamily: "'Unbounded', sans-serif", fontSize: 14, fontWeight: 700,
            color: T.text, margin: "0 0 20px", letterSpacing: 1,
          }}>{title}</h2>
        )}
        {children}
      </div>
    </div>
  );
}

function Label({ T, children }) {
  return (
    <div style={{
      fontFamily: "'Unbounded', sans-serif", fontSize: 10, letterSpacing: "1.5px",
      color: T.muted, marginBottom: 8, marginTop: 4,
    }}>{children}</div>
  );
}

function TextArea({ T, value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: "100%", background: T.surface2, border: `1px solid ${T.border}`,
        borderRadius: 10, padding: "12px 14px", fontSize: 14, color: T.text,
        lineHeight: 1.6, resize: "none", outline: "none",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
      onFocus={(e) => { e.target.style.borderColor = T.accent; }}
      onBlur={(e) => { e.target.style.borderColor = T.border; }}
    />
  );
}

function Input({ T, value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%", background: T.surface2, border: `1px solid ${T.border}`,
        borderRadius: 10, padding: "12px 14px", fontSize: 14, color: T.text,
        outline: "none", fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
      onFocus={(e) => { e.target.style.borderColor = T.accent; }}
      onBlur={(e) => { e.target.style.borderColor = T.border; }}
    />
  );
}

function Btn({ T, onClick, children, variant = "primary", disabled = false }) {
  const styles = {
    primary: { background: T.accent, color: "#fff" },
    ghost:   { background: "transparent", color: T.muted, border: `1px solid ${T.border}` },
    danger:  { background: T.redDim, color: T.red, border: `1px solid ${T.red}40` },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%", padding: "14px", borderRadius: 12, border: "none",
        fontFamily: "'Unbounded', sans-serif", fontSize: 11, letterSpacing: "1px",
        fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1, marginTop: 8,
        ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}

function Chip({ T, color = "accent", children }) {
  const map = {
    accent: { bg: T.accentDim, text: T.accent },
    green:  { bg: T.greenDim,  text: T.green },
    amber:  { bg: T.amberDim,  text: T.amber },
    purple: { bg: T.purpleDim, text: T.purple },
    red:    { bg: T.redDim,    text: T.red },
  };
  const c = map[color] || map.accent;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: c.bg, borderRadius: 20, padding: "3px 10px",
      fontSize: 10, fontFamily: "'Unbounded', sans-serif",
      letterSpacing: "0.5px", color: c.text, fontWeight: 600,
    }}>{children}</span>
  );
}

function StatusChip({ T, status }) {
  const s = STATUSES.find((x) => x.id === status) || STATUSES[0];
  return <Chip T={T} color={s.color}>{s.label.toUpperCase()}</Chip>;
}

function Card({ T, accentColor, children, onClick }) {
  const borderMap = { accent: T.accent, amber: T.amber, green: T.green, purple: T.purple };
  return (
    <div
      onClick={onClick}
      style={{
        background: T.surface, borderRadius: 16,
        border: `1px solid ${T.border}`,
        borderLeft: accentColor ? `3px solid ${borderMap[accentColor] || T.accent}` : `1px solid ${T.border}`,
        padding: "18px 18px 18px 16px",
        marginBottom: 10,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {children}
    </div>
  );
}

// ─── BOD Check-in Modal ────────────────────────────────────────
function BODModal({ T, onClose, onSave, existing }) {
  const [priorities, setPriorities] = useState(existing?.priorities || ["", "", ""]);
  const [energy, setEnergy] = useState(existing?.energyLevel || 3);
  const [obstacles, setObstacles] = useState(existing?.anticipatedObstacles || "");
  const [intention, setIntention] = useState(existing?.intention || "");

  const updatePriority = (i, val) => {
    const next = [...priorities];
    next[i] = val;
    setPriorities(next);
  };

  const handleSave = () => {
    const filled = priorities.filter((p) => p.trim());
    if (!filled.length) return;
    onSave({ priorities: filled, energyLevel: energy, anticipatedObstacles: obstacles, intention });
  };

  return (
    <Sheet T={T} onClose={onClose} title="START OF DAY">
      <Label T={T}>TOP PRIORITIES (up to 3)</Label>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <Input T={T} value={priorities[i]} onChange={(v) => updatePriority(i, v)}
            placeholder={`Priority ${i + 1}${i === 0 ? " (required)" : " (optional)"}`} />
        </div>
      ))}

      <Label T={T} style={{ marginTop: 16 }}>ENERGY LEVEL</Label>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setEnergy(n)} style={{
            flex: 1, padding: "10px 4px", borderRadius: 10, border: "none",
            background: energy === n ? T.accentDim : T.surface2,
            cursor: "pointer", display: "flex", flexDirection: "column",
            alignItems: "center", gap: 4,
            outline: energy === n ? `2px solid ${T.accent}` : "none",
          }}>
            <span style={{ fontSize: 20 }}>{ENERGY_EMOJI[n]}</span>
            <span style={{ fontSize: 9, color: energy === n ? T.accent : T.muted,
              fontFamily: "'Unbounded', sans-serif", letterSpacing: "0.5px" }}>
              {ENERGY_LABELS[n].toUpperCase()}
            </span>
          </button>
        ))}
      </div>

      <Label T={T}>ANTICIPATED OBSTACLES</Label>
      <TextArea T={T} value={obstacles} onChange={setObstacles}
        placeholder="What might get in the way today?" rows={2} />

      <Label T={T} style={{ marginTop: 16 }}>TODAY'S INTENTION</Label>
      <Input T={T} value={intention} onChange={setIntention}
        placeholder="One sentence: what does success look like today?" />

      <div style={{ marginTop: 16 }}>
        <Btn T={T} onClick={handleSave} disabled={!priorities[0].trim()}>
          {existing ? "UPDATE CHECK-IN" : "LOG START OF DAY"}
        </Btn>
        <Btn T={T} onClick={onClose} variant="ghost">CANCEL</Btn>
      </div>
    </Sheet>
  );
}

// ─── EOD Check-in Modal ────────────────────────────────────────
function EODModal({ T, onClose, onSave, existing }) {
  const [accomplishments, setAccomplishments] = useState(existing?.accomplishments || "");
  const [obstacles, setObstacles] = useState(existing?.obstacles || "");
  const [rework, setRework] = useState(existing?.rework || "");
  const [tomorrowFocus, setTomorrowFocus] = useState(existing?.tomorrowFocus || "");
  const [rating, setRating] = useState(existing?.rating || 3);

  const handleSave = () => {
    if (!accomplishments.trim()) return;
    onSave({ accomplishments, obstacles, rework, tomorrowFocus, rating });
  };

  return (
    <Sheet T={T} onClose={onClose} title="END OF DAY">
      <Label T={T}>ACCOMPLISHMENTS</Label>
      <TextArea T={T} value={accomplishments} onChange={setAccomplishments}
        placeholder="What did you get done today?" rows={3} />

      <Label T={T} style={{ marginTop: 12 }}>WHAT GOT IN THE WAY</Label>
      <TextArea T={T} value={obstacles} onChange={setObstacles}
        placeholder="Obstacles, interruptions, delays..." rows={2} />

      <Label T={T} style={{ marginTop: 12 }}>ANY REWORK? (OPTIONAL)</Label>
      <TextArea T={T} value={rework} onChange={setRework}
        placeholder="Anything you had to redo or correct?" rows={2} />

      <Label T={T} style={{ marginTop: 12 }}>TOMORROW'S TOP PRIORITY</Label>
      <Input T={T} value={tomorrowFocus} onChange={setTomorrowFocus}
        placeholder="The single most important thing tomorrow" />

      <Label T={T} style={{ marginTop: 16 }}>DAY RATING</Label>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)} style={{
            flex: 1, padding: "12px 4px", borderRadius: 10, border: "none",
            background: rating === n ? T.accentDim : T.surface2, cursor: "pointer",
            fontFamily: "'Unbounded', sans-serif", fontSize: 16, fontWeight: 700,
            color: rating === n ? T.accent : T.muted,
            outline: rating === n ? `2px solid ${T.accent}` : "none",
          }}>{n}</button>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <Btn T={T} onClick={handleSave} disabled={!accomplishments.trim()}>
          {existing ? "UPDATE CHECK-IN" : "LOG END OF DAY"}
        </Btn>
        <Btn T={T} onClick={onClose} variant="ghost">CANCEL</Btn>
      </div>
    </Sheet>
  );
}

// ─── Situation Modal ───────────────────────────────────────────
function SituationModal({ T, onClose, onSave, existing }) {
  const [title, setTitle] = useState(existing?.title || "");
  const [description, setDescription] = useState(existing?.description || "");
  const [impact, setImpact] = useState(existing?.impact || "Medium");
  const [category, setCategory] = useState(existing?.category || "Other");
  const [status, setStatus] = useState(existing?.status || "open");

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), description, impact, category, status });
  };

  return (
    <Sheet T={T} onClose={onClose} title={existing ? "EDIT SITUATION" : "LOG SITUATION"}>
      <Label T={T}>WHAT HAPPENED</Label>
      <Input T={T} value={title} onChange={setTitle} placeholder="Short title" />

      <div style={{ marginTop: 12 }}>
        <TextArea T={T} value={description} onChange={setDescription}
          placeholder="Describe the situation in detail — what happened, when, context..." rows={3} />
      </div>

      <Label T={T} style={{ marginTop: 12 }}>CATEGORY</Label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)} style={{
            padding: "6px 12px", borderRadius: 20, border: "none", cursor: "pointer",
            background: category === c ? T.accentDim : T.surface2,
            color: category === c ? T.accent : T.muted,
            fontFamily: "'Unbounded', sans-serif", fontSize: 9, letterSpacing: "0.5px",
            fontWeight: 600,
            outline: category === c ? `1.5px solid ${T.accent}` : "none",
          }}>{c.toUpperCase()}</button>
        ))}
      </div>

      <Label T={T} style={{ marginTop: 12 }}>IMPACT</Label>
      <div style={{ display: "flex", gap: 8 }}>
        {IMPACTS.map((imp) => {
          const colors = { Low: "green", Medium: "amber", High: "red" };
          const col = colors[imp];
          const colorMap = { green: T.green, amber: T.amber, red: T.red };
          const dimMap   = { green: T.greenDim, amber: T.amberDim, red: T.redDim };
          const sel = impact === imp;
          return (
            <button key={imp} onClick={() => setImpact(imp)} style={{
              flex: 1, padding: "10px", borderRadius: 10, border: "none", cursor: "pointer",
              background: sel ? dimMap[col] : T.surface2,
              color: sel ? colorMap[col] : T.muted,
              fontFamily: "'Unbounded', sans-serif", fontSize: 10, letterSpacing: "0.5px",
              fontWeight: 600,
              outline: sel ? `1.5px solid ${colorMap[col]}` : "none",
            }}>{imp.toUpperCase()}</button>
          );
        })}
      </div>

      {existing && (
        <>
          <Label T={T} style={{ marginTop: 12 }}>STATUS</Label>
          <div style={{ display: "flex", gap: 8 }}>
            {STATUSES.map((s) => {
              const colorMap = { green: T.green, amber: T.amber, purple: T.purple };
              const dimMap   = { green: T.greenDim, amber: T.amberDim, purple: T.purpleDim };
              const sel = status === s.id;
              return (
                <button key={s.id} onClick={() => setStatus(s.id)} style={{
                  flex: 1, padding: "10px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: sel ? dimMap[s.color] : T.surface2,
                  color: sel ? colorMap[s.color] : T.muted,
                  fontFamily: "'Unbounded', sans-serif", fontSize: 9, letterSpacing: "0.5px",
                  fontWeight: 600,
                  outline: sel ? `1.5px solid ${colorMap[s.color]}` : "none",
                }}>{s.label.toUpperCase()}</button>
              );
            })}
          </div>
        </>
      )}

      <div style={{ marginTop: 16 }}>
        <Btn T={T} onClick={handleSave} disabled={!title.trim()}>
          {existing ? "SAVE CHANGES" : "LOG SITUATION"}
        </Btn>
        <Btn T={T} onClick={onClose} variant="ghost">CANCEL</Btn>
      </div>
    </Sheet>
  );
}

// ─── Main TodayScreen ──────────────────────────────────────────
export default function TodayScreen({ T, setTab }) {
  const todayStr = today();
  const [bod, setBod]          = useState(null);
  const [eod, setEod]          = useState(null);
  const [situations, setSituations] = useState([]);
  const [loading, setLoading]  = useState(true);
  const [modal, setModal]      = useState(null); // null | "bod" | "eod" | "situation" | "edit"
  const [editSit, setEditSit]  = useState(null);

  const load = useCallback(async () => {
    const [checkins, sits] = await Promise.all([
      dbGetByIndex("checkins", "date", todayStr),
      dbGetByIndex("situations", "date", todayStr),
    ]);
    setBod(checkins.find((c) => c.type === "bod") || null);
    setEod(checkins.find((c) => c.type === "eod") || null);
    setSituations(sits.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    setLoading(false);
  }, [todayStr]);

  useEffect(() => { load(); }, [load]);

  const saveBOD = async (data) => {
    const item = {
      id: bod?.id || uuid(),
      type: "bod",
      date: todayStr,
      ...data,
      createdAt: bod?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await dbPut("checkins", item);
    setBod(item);
    setModal(null);
  };

  const saveEOD = async (data) => {
    const item = {
      id: eod?.id || uuid(),
      type: "eod",
      date: todayStr,
      ...data,
      createdAt: eod?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await dbPut("checkins", item);
    setEod(item);
    setModal(null);
  };

  const saveSituation = async (data) => {
    const item = {
      id: editSit?.id || uuid(),
      date: todayStr,
      ...data,
      createdAt: editSit?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await dbPut("situations", item);
    setEditSit(null);
    setModal(null);
    load();
  };

  const deleteSituation = async (id) => {
    await dbDelete("situations", id);
    setSituations((prev) => prev.filter((s) => s.id !== id));
  };

  const wk = getWeekNumber(todayStr);
  const impactColor = { Low: "green", Medium: "amber", High: "red" };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
        height: "60dvh", color: T.muted, fontFamily: "'Unbounded', sans-serif",
        fontSize: 11, letterSpacing: 1 }}>
        LOADING...
      </div>
    );
  }

  return (
    <div style={{ padding: "0 16px" }}>
      {/* Header */}
      <div style={{ padding: "20px 0 4px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 26, fontWeight: 700,
            color: T.text, margin: 0, lineHeight: 1.1 }}>TODAY</h1>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>{fmtDateLong(todayStr)}</div>
        </div>
        <Chip T={T} color="accent">WK {wk}</Chip>
      </div>

      {/* BOD Card */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 10, letterSpacing: "1.5px",
          color: T.muted, marginBottom: 10 }}>MORNING CHECK-IN</div>
        {bod ? (
          <Card T={T} accentColor="accent">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 12, fontWeight: 700, color: T.text }}>
                Start of Day
              </span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Chip T={T} color="green">✓ DONE</Chip>
                <button onClick={() => setModal("bod")} style={{
                  background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 13 }}>Edit</button>
              </div>
            </div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 12, lineHeight: 1.5 }}>
              {bod.priorities.join(" · ")}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <div style={{ flex: 1, background: T.surface2, borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 18, fontWeight: 700, color: T.text }}>
                  {bod.priorities.length}
                </div>
                <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 9, color: T.muted, letterSpacing: "0.5px" }}>
                  PRIORITIES
                </div>
              </div>
              <div style={{ flex: 1, background: T.surface2, borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 18, fontWeight: 700, color: T.text }}>
                  {ENERGY_EMOJI[bod.energyLevel]}
                </div>
                <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 9, color: T.muted, letterSpacing: "0.5px" }}>
                  {ENERGY_LABELS[bod.energyLevel].toUpperCase()}
                </div>
              </div>
              {bod.anticipatedObstacles && (
                <div style={{ flex: 1, background: T.amberDim, borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 18 }}>⚠️</div>
                  <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 9, color: T.amber, letterSpacing: "0.5px" }}>
                    RISKS
                  </div>
                </div>
              )}
            </div>
          </Card>
        ) : (
          <Card T={T} accentColor="accent">
            <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 6 }}>
              Start of Day
            </div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 14, lineHeight: 1.5 }}>
              Set your priorities, energy level, and today's intention.
            </div>
            <button onClick={() => setModal("bod")} style={{
              background: T.accent, color: "#fff", border: "none", borderRadius: 10,
              padding: "11px 16px", fontFamily: "'Unbounded', sans-serif", fontSize: 10,
              letterSpacing: "1px", fontWeight: 600, cursor: "pointer",
            }}>BEGIN MORNING CHECK-IN</button>
          </Card>
        )}
      </div>

      {/* Situations */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 10, letterSpacing: "1.5px",
          color: T.muted, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>SITUATIONS TODAY</span>
          <span style={{ color: T.accent }}>{situations.length}</span>
        </div>
        {situations.length === 0 ? (
          <Card T={T}>
            <div style={{ fontSize: 13, color: T.muted, textAlign: "center", padding: "8px 0" }}>
              No situations logged today.
              <br />
              <span style={{ fontSize: 12 }}>Tap <strong style={{ color: T.accent }}>+</strong> to log one.</span>
            </div>
          </Card>
        ) : (
          situations.map((sit) => (
            <Card key={sit.id} T={T} accentColor={impactColor[sit.impact] || "amber"}
              onClick={() => { setEditSit(sit); setModal("situation"); }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <span style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 12, fontWeight: 700,
                  color: T.text, flex: 1, marginRight: 8 }}>{sit.title}</span>
                <StatusChip T={T} status={sit.status} />
              </div>
              {sit.description && (
                <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.5, marginBottom: 8 }}>
                  {sit.description.length > 100 ? sit.description.slice(0, 100) + "…" : sit.description}
                </div>
              )}
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Chip T={T} color={impactColor[sit.impact] || "amber"}>{sit.impact.toUpperCase()} IMPACT</Chip>
                <Chip T={T} color="accent">{sit.category.toUpperCase()}</Chip>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* EOD Card */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 10, letterSpacing: "1.5px",
          color: T.muted, marginBottom: 10 }}>END OF DAY</div>
        {eod ? (
          <Card T={T} accentColor="green">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 12, fontWeight: 700, color: T.text }}>
                End of Day
              </span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Chip T={T} color="green">✓ DONE</Chip>
                <button onClick={() => setModal("eod")} style={{
                  background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 13 }}>Edit</button>
              </div>
            </div>
            <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.5, marginBottom: 8 }}>
              {eod.accomplishments.length > 120 ? eod.accomplishments.slice(0, 120) + "…" : eod.accomplishments}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {[1,2,3,4,5].map((n) => (
                <div key={n} style={{ flex: 1, height: 4, borderRadius: 2,
                  background: n <= eod.rating ? T.green : T.surface2 }} />
              ))}
            </div>
          </Card>
        ) : (
          <Card T={T} accentColor="green">
            <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 6 }}>
              End of Day
            </div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 14, lineHeight: 1.5 }}>
              Reflect on accomplishments, obstacles, and set tomorrow's focus.
            </div>
            <button onClick={() => setModal("eod")} style={{
              background: T.greenDim, color: T.green, border: `1px solid ${T.green}40`,
              borderRadius: 10, padding: "11px 16px", fontFamily: "'Unbounded', sans-serif",
              fontSize: 10, letterSpacing: "1px", fontWeight: 600, cursor: "pointer",
            }}>BEGIN EOD CHECK-IN</button>
          </Card>
        )}
      </div>

      <div style={{ height: 24 }} />

      {/* FAB */}
      <button
        onClick={() => { setEditSit(null); setModal("situation"); }}
        style={{
          position: "fixed", bottom: 80, right: "max(16px, calc((100vw - 480px) / 2 + 16px))",
          width: 54, height: 54, borderRadius: "50%",
          background: T.accent, border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 4px 20px ${T.accent}60`, zIndex: 50,
          fontSize: 26, color: "#fff", fontWeight: 300,
        }}
      >+</button>

      {/* Modals */}
      {modal === "bod" && (
        <BODModal T={T} onClose={() => setModal(null)} onSave={saveBOD} existing={bod} />
      )}
      {modal === "eod" && (
        <EODModal T={T} onClose={() => setModal(null)} onSave={saveEOD} existing={eod} />
      )}
      {modal === "situation" && (
        <SituationModal T={T}
          onClose={() => { setModal(null); setEditSit(null); }}
          onSave={saveSituation}
          existing={editSit}
        />
      )}
    </div>
  );
}
