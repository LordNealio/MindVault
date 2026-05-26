import { useState, useRef } from "react";
import { VAULT_CATEGORIES } from "./Jarvis.jsx";

const D = {
  bg: "#F0EDE5", white: "#FAFAF7", bl: "#1D3557", rd: "#C1121F",
  yl: "#E8B84B", bk: "#0A0A0A", muted: "#9B9589", border: "#E8E4DA",
  shadow: "rgba(0,0,0,0.08)", r: 18,
};

const J = {
  get: k => { try { const v = localStorage.getItem("j_" + k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem("j_" + k, JSON.stringify(v)); } catch {} },
};

const SLabel = ({ children, color = D.rd, style = {} }) => (
  <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 8, fontWeight: 700, letterSpacing: ".14em", color, ...style }}>
    {children}
  </div>
);
const Card = ({ children, style = {} }) => (
  <div style={{ background: D.white, borderRadius: D.r, border: `1px solid ${D.border}`, boxShadow: `0 2px 12px ${D.shadow}`, overflow: "hidden", ...style }}>
    {children}
  </div>
);
const Btn = ({ children, onClick, primary, small, disabled, style = {} }) => (
  <button onClick={onClick} disabled={disabled} style={{
    padding: small ? "8px 14px" : "13px 20px", borderRadius: 10,
    fontFamily: "'Unbounded',monospace", fontSize: small ? 8 : 10, fontWeight: 700, letterSpacing: ".08em",
    background: disabled ? D.border : primary ? D.bk : "transparent",
    color: disabled ? D.muted : primary ? D.yl : D.bk,
    border: `1.5px solid ${disabled ? D.border : D.bk}`,
    cursor: disabled ? "not-allowed" : "pointer", transition: "all .15s", ...style,
  }}>{children}</button>
);

const UPLOAD_TYPES = [
  { id: "note",  label: "Text Note",  icon: "✎", desc: "Write or paste text" },
  { id: "url",   label: "URL / Link", icon: "⬡", desc: "A webpage, article, video" },
  { id: "file",  label: "Document",   icon: "◧", desc: "PDF, TXT, or any text file" },
  { id: "photo", label: "Photo",      icon: "◫", desc: "Image with a caption" },
];

// ── Upload modal ───────────────────────────────────────────────────────────
function UploadModal({ onSave, onClose }) {
  const [step, setStep] = useState("type"); // type | category | details | done
  const [type, setType] = useState(null);
  const [category, setCategory] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState("");
  const [photoData, setPhotoData] = useState(null);
  const fileRef = useRef(null);
  const photoRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
    const reader = new FileReader();
    reader.onload = ev => setContent(ev.target.result?.slice(0, 5000) || "");
    reader.readAsText(file);
  }

  function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
    const reader = new FileReader();
    reader.onload = ev => setPhotoData(ev.target.result);
    reader.readAsDataURL(file);
  }

  function save() {
    const item = {
      id: crypto.randomUUID(),
      type,
      category,
      title: title.trim() || "Untitled",
      content: type === "photo" ? photoData : content.trim(),
      notes: notes.trim(),
      timestamp: Date.now(),
    };
    const existing = J.get("vault") || [];
    J.set("vault", [...existing, item]);
    onSave(item);
    setStep("done");
  }

  const cat = VAULT_CATEGORIES.find(c => c.id === category);

  if (step === "done") return (
    <div style={{ padding: "32px 20px", textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{cat?.icon}</div>
      <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 16, fontWeight: 900, marginBottom: 8 }}>Saved to vault</div>
      <p style={{ fontSize: 12, color: D.muted, marginBottom: 20, lineHeight: 1.7 }}>
        Orpheus will use this context in all future conversations.
      </p>
      <Btn primary onClick={onClose} style={{ width: "100%" }}>DONE</Btn>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ padding: "16px 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${D.border}` }}>
        <SLabel>{step === "type" ? "WHAT ARE YOU ADDING?" : step === "category" ? "WHAT IS THIS?" : "ADD DETAILS"}</SLabel>
        <button onClick={onClose} style={{ fontSize: 20, color: D.muted }}>×</button>
      </div>

      <div style={{ padding: "16px", maxHeight: "70vh", overflowY: "auto" }}>

        {/* Step 1: Type */}
        {step === "type" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {UPLOAD_TYPES.map(t => (
              <button key={t.id} onClick={() => { setType(t.id); setStep("category"); }} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                borderRadius: 14, border: `2px solid ${D.border}`, background: D.white, textAlign: "left",
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: D.bk, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: D.yl, flexShrink: 0 }}>
                  {t.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: D.muted }}>{t.desc}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Category */}
        {step === "category" && (
          <>
            <p style={{ fontSize: 12, color: D.muted, marginBottom: 16, lineHeight: 1.7 }}>
              Categorizing helps Orpheus understand the context and pull it into the right conversations.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {VAULT_CATEGORIES.map(c => (
                <button key={c.id} onClick={() => { setCategory(c.id); setStep("details"); }} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                  borderRadius: 14, border: `2px solid ${D.border}`, background: D.white, textAlign: "left",
                }}>
                  <span style={{ fontSize: 22, width: 28, textAlign: "center", color: c.color }}>{c.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: D.bk }}>{c.label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setStep("type")} style={{ marginTop: 12, fontSize: 11, color: D.muted }}>← Back</button>
          </>
        )}

        {/* Step 3: Details */}
        {step === "details" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Category badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: (cat?.color || D.muted) + "18", border: `1px solid ${cat?.color || D.muted}` }}>
              <span style={{ color: cat?.color, fontSize: 16 }}>{cat?.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: cat?.color }}>{cat?.label}</span>
              <button onClick={() => setStep("category")} style={{ marginLeft: "auto", fontSize: 10, color: D.muted }}>change</button>
            </div>

            {/* Title */}
            <div>
              <SLabel style={{ marginBottom: 6 }}>TITLE</SLabel>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Give it a name…"
                style={{ width: "100%", background: D.bg, borderRadius: 10, padding: "10px 12px", fontSize: 14, border: `1.5px solid ${D.border}` }} />
            </div>

            {/* Content by type */}
            {type === "note" && (
              <div>
                <SLabel style={{ marginBottom: 6 }}>CONTENT</SLabel>
                <div style={{ background: D.bg, borderRadius: 12, padding: "12px 14px", border: `1.5px solid ${D.border}` }}>
                  <textarea value={content} onChange={e => setContent(e.target.value)}
                    placeholder="Write or paste your text here…"
                    rows={6} style={{ fontSize: 13, lineHeight: 1.75, width: "100%" }} />
                </div>
              </div>
            )}

            {type === "url" && (
              <div>
                <SLabel style={{ marginBottom: 6 }}>URL</SLabel>
                <input value={content} onChange={e => setContent(e.target.value)}
                  placeholder="https://…"
                  style={{ width: "100%", background: D.bg, borderRadius: 10, padding: "10px 12px", fontSize: 13, border: `1.5px solid ${D.border}` }} />
              </div>
            )}

            {type === "file" && (
              <div>
                <SLabel style={{ marginBottom: 6 }}>DOCUMENT</SLabel>
                {content ? (
                  <div style={{ background: D.bg, borderRadius: 12, padding: "10px 12px", border: `1px solid ${D.border}`, fontSize: 11, color: D.muted, lineHeight: 1.6 }}>
                    {content.slice(0, 200)}…
                    <button onClick={() => setContent("")} style={{ marginLeft: 8, color: D.rd, fontSize: 10 }}>remove</button>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()} style={{
                    width: "100%", padding: "16px", borderRadius: 12, border: `2px dashed ${D.border}`,
                    background: D.bg, color: D.muted, fontSize: 12,
                  }}>
                    Tap to pick a file (PDF, TXT, MD…)
                  </button>
                )}
                <input ref={fileRef} type="file" accept=".txt,.md,.pdf,.doc,.docx,.csv" style={{ display: "none" }} onChange={handleFile} />
              </div>
            )}

            {type === "photo" && (
              <div>
                <SLabel style={{ marginBottom: 6 }}>PHOTO</SLabel>
                {photoData ? (
                  <div style={{ position: "relative" }}>
                    <img src={photoData} alt="upload" style={{ width: "100%", borderRadius: 12, objectFit: "cover", maxHeight: 200 }} />
                    <button onClick={() => setPhotoData(null)} style={{ position: "absolute", top: 8, right: 8, background: D.rd, color: "#fff", borderRadius: 6, padding: "4px 8px", fontSize: 10 }}>remove</button>
                  </div>
                ) : (
                  <button onClick={() => photoRef.current?.click()} style={{
                    width: "100%", padding: "32px", borderRadius: 12, border: `2px dashed ${D.border}`,
                    background: D.bg, color: D.muted, fontSize: 12,
                  }}>
                    Tap to pick a photo
                  </button>
                )}
                <input ref={photoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto} />
              </div>
            )}

            {/* Notes */}
            <div>
              <SLabel style={{ marginBottom: 6 }}>WHY ARE YOU SAVING THIS? <span style={{ color: D.muted, fontSize: 7 }}>(OPTIONAL)</span></SLabel>
              <div style={{ background: D.bg, borderRadius: 12, padding: "10px 14px", border: `1.5px solid ${D.border}` }}>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Context for yourself and Orpheus — what does this mean to you, what question does it answer, what idea did it spark?"
                  rows={3} style={{ fontSize: 13, lineHeight: 1.75, width: "100%" }} />
              </div>
            </div>

            <Btn primary onClick={save}
              disabled={!title.trim() && !content && !photoData}
              style={{ width: "100%", marginTop: 4 }}>
              SAVE TO VAULT
            </Btn>
            <button onClick={() => setStep("category")} style={{ textAlign: "center", fontSize: 11, color: D.muted }}>← Back</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── YouTube URL helpers ────────────────────────────────────────────────────
function getYouTubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0];
  } catch {}
  return null;
}

function isURL(str) {
  try { return !!new URL(str) && (str.startsWith("http://") || str.startsWith("https://")); }
  catch { return false; }
}

// ── Photo Lightbox ─────────────────────────────────────────────────────────
function PhotoLightbox({ src, title, onClose }) {
  // Download helper: for data-URL images, trigger browser save
  function download() {
    const a = document.createElement("a");
    a.href = src;
    a.download = (title || "photo") + ".jpg";
    a.click();
  }
  return (
    <div
      onClick={onClose}
      style={{
        position:"fixed", inset:0, zIndex:9999,
        background:"rgba(0,0,0,0.92)",
        display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        padding:16,
      }}
    >
      {/* Top bar */}
      <div
        onClick={e=>e.stopPropagation()}
        style={{width:"100%",maxWidth:480,display:"flex",justifyContent:"space-between",
          alignItems:"center",marginBottom:12}}
      >
        <span style={{color:"#fff",fontSize:13,fontWeight:600,flex:1,
          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title}</span>
        <div style={{display:"flex",gap:10,flexShrink:0,marginLeft:12}}>
          <button
            onClick={download}
            style={{padding:"7px 14px",borderRadius:8,border:"1.5px solid rgba(255,255,255,.35)",
              background:"rgba(255,255,255,.1)",color:"#fff",fontSize:11,
              fontWeight:700,cursor:"pointer"}}>
            ⬇ Save
          </button>
          <button
            onClick={onClose}
            style={{width:34,height:34,borderRadius:"50%",border:"none",
              background:"rgba(255,255,255,.15)",color:"#fff",fontSize:18,
              cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
            ✕
          </button>
        </div>
      </div>
      {/* Image */}
      <div
        onClick={e=>e.stopPropagation()}
        style={{flex:1,width:"100%",maxWidth:480,display:"flex",
          alignItems:"center",justifyContent:"center",minHeight:0}}
      >
        <img
          src={src}
          alt={title}
          style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain",
            borderRadius:12,boxShadow:"0 8px 40px rgba(0,0,0,.5)"}}
        />
      </div>
      <div style={{marginTop:12,fontSize:10,color:"rgba(255,255,255,.4)"}}>
        Tap outside to close
      </div>
    </div>
  );
}

// ── VaultItemCard ──────────────────────────────────────────────────────────
function VaultItemCard({ item, onDelete }) {
  const [open, setOpen] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const cat = VAULT_CATEGORIES.find(c => c.id === item.category);
  const typeIcons = { note: "✎", url: "⬡", file: "◧", photo: "◫" };
  const ytId = item.type === "url" ? getYouTubeId(item.content || "") : null;
  const isLink = item.type === "url" && isURL(item.content || "");
  const dateStr = new Date(item.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <Card>
      {/* Category strip */}
      <div style={{ padding: "6px 14px", background: (cat?.color || D.muted) + "14", borderBottom: `1px solid ${D.border}`, display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ color: cat?.color || D.muted, fontSize: 13 }}>{cat?.icon}</span>
        <SLabel color={cat?.color || D.muted} style={{ fontSize: 7, flex: 1 }}>{cat?.label}</SLabel>
        <span style={{ fontSize: 14, color: D.muted }}>{typeIcons[item.type]}</span>
      </div>

      {/* Main body — tappable header row */}
      <div style={{ padding: "12px 16px" }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{ width: "100%", textAlign: "left", background: "none", padding: 0, display: "flex", alignItems: "flex-start", gap: 8 }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: open && item.notes ? 4 : 0 }}>{item.title}</div>
            {!open && item.notes && (
              <p style={{ fontSize: 11, color: D.muted, lineHeight: 1.55, marginTop: 3 }}>
                {item.notes.slice(0, 80)}{item.notes.length > 80 ? "…" : ""}
              </p>
            )}
            {!open && !item.notes && item.type === "url" && item.content && (
              <p style={{ fontSize: 10, color: D.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.content}
              </p>
            )}
            {!open && item.type === "note" && item.content && (
              <p style={{ fontSize: 11, color: D.muted, lineHeight: 1.55, marginTop: 3 }}>
                {item.content.slice(0, 80)}{item.content.length > 80 ? "…" : ""}
              </p>
            )}
          </div>
          <span style={{ fontSize: 18, color: D.muted, flexShrink: 0, transform: open ? "rotate(90deg)" : "none", transition: "transform .2s", lineHeight: 1.2 }}>›</span>
        </button>

        {/* ── Expanded view ── */}
        {open && (
          <div style={{ marginTop: 12 }}>

            {/* Notes */}
            {item.notes && (
              <div style={{ background: D.bg, borderRadius: 10, padding: "10px 12px", marginBottom: 12, borderLeft: `3px solid ${cat?.color || D.muted}` }}>
                <p style={{ fontSize: 11, color: "#555", lineHeight: 1.7 }}>{item.notes}</p>
              </div>
            )}

            {/* URL type */}
            {item.type === "url" && item.content && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Clickable link */}
                <a
                  href={item.content}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 12px", borderRadius: 10,
                    background: D.bl + "14", border: `1.5px solid ${D.bl}`,
                    textDecoration: "none",
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>🔗</span>
                  <span style={{
                    fontSize: 11, color: D.bl, fontWeight: 600,
                    wordBreak: "break-all", lineHeight: 1.5,
                  }}>{item.content}</span>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: D.bl, flexShrink: 0 }}>↗</span>
                </a>

                {/* YouTube embed */}
                {ytId && (
                  <div style={{ borderRadius: 12, overflow: "hidden", position: "relative", paddingBottom: "56.25%", background: D.bk }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={item.title}
                      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Note / file type — full text */}
            {(item.type === "note" || item.type === "file") && item.content && (
              <div style={{ background: D.bg, borderRadius: 10, padding: "12px 14px", border: `1px solid ${D.border}`, maxHeight: 320, overflowY: "auto" }}>
                <p style={{ fontSize: 12, color: "#444", lineHeight: 1.75, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {item.content}
                </p>
              </div>
            )}

            {/* Photo type */}
            {item.type === "photo" && item.content && (
              <button
                onClick={() => setLightbox(true)}
                style={{width:"100%",padding:0,background:"none",border:"none",cursor:"zoom-in",
                  borderRadius:10,overflow:"hidden",display:"block"}}
              >
                <img src={item.content} alt={item.title}
                  style={{ width: "100%", borderRadius: 10, objectFit: "contain", maxHeight: 320,
                    display:"block" }} />
                <div style={{fontSize:10,color:D.muted,marginTop:6,textAlign:"center"}}>
                  Tap to zoom · save ⬇
                </div>
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
          <span style={{ fontSize: 9, color: D.muted }}>{dateStr}</span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {item.type === "photo" && item.content && (
              <button
                onClick={() => setLightbox(true)}
                style={{ fontSize: 10, color: D.bl, fontWeight: 600, background:"none",
                  border:"none", cursor:"pointer", padding:"4px 8px" }}>
                zoom ↗
              </button>
            )}
            {isLink && !open && (
              <a href={item.content} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 10, color: D.bl, fontWeight: 600, textDecoration: "none" }}
                onClick={e => e.stopPropagation()}>
                open ↗
              </a>
            )}
            <button onClick={() => onDelete(item.id)} style={{ fontSize: 10, color: D.muted, padding: "4px 8px" }}>delete</button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && item.type === "photo" && item.content && (
        <PhotoLightbox
          src={item.content}
          title={item.title}
          onClose={() => setLightbox(false)}
        />
      )}
    </Card>
  );
}

// ── Vault list screen ──────────────────────────────────────────────────────
export function VaultScreen({ onAddNew }) {
  const [items, setItems] = useState(() => J.get("vault") || []);
  const [filter, setFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);

  function handleSave(item) {
    setItems(J.get("vault") || []);
  }

  function deleteItem(id) {
    const updated = items.filter(i => i.id !== id);
    J.set("vault", updated);
    setItems(updated);
  }

  const filtered = filter === "all" ? items : items.filter(i => i.category === filter);

  return (
    <div style={{ padding: "0 0 120px" }}>
      {/* Header */}
      <div style={{ background: D.bk, padding: "18px 16px 20px" }}>
        <SLabel color={D.yl} style={{ marginBottom: 4 }}>CONTEXT VAULT</SLabel>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 18, fontWeight: 900, color: D.white }}>
            {items.length} {items.length === 1 ? "item" : "items"}
          </div>
          <button onClick={() => setShowModal(true)} style={{
            padding: "8px 14px", borderRadius: 10, background: D.yl,
            fontFamily: "'Unbounded',monospace", fontSize: 9, fontWeight: 700, color: D.bk,
          }}>+ ADD</button>
        </div>
      </div>

      {/* Category filter */}
      <div style={{ padding: "12px 16px 0", display: "flex", gap: 6, overflowX: "auto", paddingBottom: 12, borderBottom: `1px solid ${D.border}` }}>
        {[{ id: "all", label: "All", icon: "◎", color: D.muted }, ...VAULT_CATEGORIES].map(c => (
          <button key={c.id} onClick={() => setFilter(c.id)} style={{
            padding: "5px 12px", borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0,
            border: `1.5px solid ${filter === c.id ? (c.color || D.bk) : D.border}`,
            background: filter === c.id ? (c.color || D.bk) + "18" : "transparent",
            fontSize: 11, fontWeight: 600, color: filter === c.id ? (c.color || D.bk) : D.muted,
          }}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* Items */}
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>◎</div>
            <p style={{ fontSize: 13, color: D.muted, lineHeight: 1.7, marginBottom: 20 }}>
              {filter === "all"
                ? "Your vault is empty. Add documents, links, photos, and notes — Orpheus will use them as context."
                : `No ${VAULT_CATEGORIES.find(c => c.id === filter)?.label} items yet.`}
            </p>
            <button onClick={() => setShowModal(true)} style={{
              padding: "12px 20px", borderRadius: 12, background: D.bk,
              fontFamily: "'Unbounded',monospace", fontSize: 9, fontWeight: 700, color: D.yl,
            }}>ADD YOUR FIRST ITEM</button>
          </div>
        ) : (
          filtered.slice().reverse().map(item => (
            <VaultItemCard key={item.id} item={item} onDelete={deleteItem} />
          ))
        )}
      </div>

      {/* Upload modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: D.white, borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", animation: "fadeUp .25s both" }}>
            <UploadModal onSave={handleSave} onClose={() => setShowModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
