import { useState, useRef, useEffect } from "react";
import { VAULT_CATEGORIES } from "./Jarvis.jsx";
import { VaultImagePicker, ImageGrid } from "./VaultImagePicker.jsx";
import {
  putImages, getImages, deleteImages, deleteImage,
  migrateLegacyPhotoItem, imageIdsOf, hasLegacyPhoto,
  MAX_IMAGES_PER_ITEM,
} from "../../lib/vaultMedia.js";

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
  { id: "photo", label: "Photos",     icon: "◫", desc: `Up to ${MAX_IMAGES_PER_ITEM} images with a caption` },
];

// ── Upload modal ───────────────────────────────────────────────────────────
function UploadModal({ onSave, onClose }) {
  const [step, setStep] = useState("type"); // type | category | details | done
  const [type, setType] = useState(null);
  const [category, setCategory] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState("");
  const [images, setImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const fileRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
    const reader = new FileReader();
    reader.onload = ev => setContent(ev.target.result?.slice(0, 5000) || "");
    reader.readAsText(file);
  }

  async function save() {
    setSaving(true);
    setSaveError("");
    const itemId = crypto.randomUUID();
    try {
      let imageIds = [];
      if (type === "photo" && images.length) {
        // Image bytes go to IndexedDB; only the ordered ids live in the item.
        imageIds = await putImages(images, itemId);
      }
      const item = {
        id: itemId,
        type,
        category,
        title: title.trim() || "Untitled",
        content: type === "photo" ? "" : content.trim(),
        imageIds,
        notes: notes.trim(),
        timestamp: Date.now(),
      };
      const existing = J.get("vault") || [];
      J.set("vault", [...existing, item]);
      onSave(item);
      setStep("done");
    } catch (err) {
      setSaveError(err?.message || "Could not save to the vault. Please try again.");
    } finally {
      setSaving(false);
    }
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
                <SLabel style={{ marginBottom: 6 }}>PHOTOS</SLabel>
                <VaultImagePicker images={images} onChange={setImages} max={MAX_IMAGES_PER_ITEM} />
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

            {saveError && (
              <div style={{ padding: "10px 12px", borderRadius: 10, background: "#ffe6e6", border: `1px solid ${D.rd}`, color: "#8f1218", fontSize: 11, lineHeight: 1.6 }}>
                {saveError}
              </div>
            )}

            <Btn primary onClick={save}
              disabled={saving || (!title.trim() && !content && !images.length)}
              style={{ width: "100%", marginTop: 4 }}>
              {saving
                ? "SAVING…"
                : type === "photo" && images.length
                  ? `SAVE ${images.length} IMAGE${images.length === 1 ? "" : "S"} TO VAULT`
                  : "SAVE TO VAULT"}
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

// ── VaultItemCard ──────────────────────────────────────────────────────────
function VaultItemCard({ item, onDelete, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [imgError, setImgError] = useState("");
  const [addingMore, setAddingMore] = useState(false);
  const [pendingAdds, setPendingAdds] = useState([]);
  const [busy, setBusy] = useState(false);
  const cat = VAULT_CATEGORIES.find(c => c.id === item.category);

  const ids = imageIdsOf(item);

  // Load image records for this item. Legacy single-photo items that could not
  // be migrated still render straight from item.content.
  useEffect(() => {
    let alive = true;
    if (item.type !== "photo") return;
    if (hasLegacyPhoto(item)) {
      setImages([{ id: `legacy-${item.id}`, full: item.content, thumb: item.content, name: item.title }]);
      return;
    }
    if (!ids.length) { setImages([]); return; }
    setLoadingImages(true);
    setImgError("");
    getImages(ids)
      .then(recs => {
        if (!alive) return;
        setImages(recs);
        if (recs.length < ids.length) {
          setImgError(`${ids.length - recs.length} image${ids.length - recs.length === 1 ? "" : "s"} could not be loaded from storage.`);
        }
      })
      .catch(() => alive && setImgError("Could not load images from storage."))
      .finally(() => alive && setLoadingImages(false));
    return () => { alive = false; };
  }, [item.id, ids.join(","), item.type]);

  // Append newly picked images to an existing entry.
  async function commitAdds() {
    if (!pendingAdds.length) return;
    setBusy(true);
    try {
      const newIds = await putImages(pendingAdds, item.id);
      onUpdate({ ...item, imageIds: [...ids, ...newIds] });
      setPendingAdds([]);
      setAddingMore(false);
    } catch {
      setImgError("Could not save the new images. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  // Remove exactly one image; the others are untouched.
  async function removeOne(imageId) {
    if (String(imageId).startsWith("legacy-")) return;
    setBusy(true);
    try {
      onUpdate({ ...item, imageIds: ids.filter(i => i !== imageId) });
      await deleteImage(imageId);
      setImages(prev => prev.filter(im => im.id !== imageId));
    } catch {
      setImgError("Could not remove that image.");
    } finally {
      setBusy(false);
    }
  }
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

            {/* Photo type — multi-image grid */}
            {item.type === "photo" && (
              <div>
                {loadingImages && (
                  <div style={{ fontSize: 11, color: D.muted, padding: "12px 0" }}>Loading images…</div>
                )}

                {!loadingImages && images.length > 0 && (
                  <ImageGrid images={images} title={item.title} onRemove={busy ? undefined : removeOne} />
                )}

                {!loadingImages && !images.length && !imgError && (
                  <div style={{ fontSize: 11, color: D.muted, padding: "10px 0" }}>No images in this entry yet.</div>
                )}

                {imgError && (
                  <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, fontSize: 11,
                    background: "#ffe6e6", border: `1px solid ${D.rd}`, color: "#8f1218" }}>
                    {imgError}
                  </div>
                )}

                {/* Add more images to a saved entry */}
                {!addingMore ? (
                  images.length < MAX_IMAGES_PER_ITEM ? (
                    <button onClick={() => setAddingMore(true)}
                      style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${D.bk}`,
                        background: "transparent", color: D.bk, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                      + ADD MORE PHOTOS
                    </button>
                  ) : (
                    <div style={{ marginTop: 10, fontSize: 10, color: D.muted }}>
                      Limit reached ({MAX_IMAGES_PER_ITEM} images). Remove one to add another.
                    </div>
                  )
                ) : (
                  <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: D.bg, border: `1px solid ${D.border}` }}>
                    <VaultImagePicker
                      images={pendingAdds}
                      onChange={setPendingAdds}
                      max={MAX_IMAGES_PER_ITEM - images.length}
                      compact
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <Btn primary small disabled={!pendingAdds.length || busy} onClick={commitAdds} style={{ flex: 1 }}>
                        {busy ? "SAVING…" : `ADD ${pendingAdds.length || ""}`.trim()}
                      </Btn>
                      <Btn small onClick={() => { setPendingAdds([]); setAddingMore(false); }}>CANCEL</Btn>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
          <span style={{ fontSize: 9, color: D.muted }}>{dateStr}</span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {item.type === "photo" && images.length > 0 && !open && (
              <button
                onClick={() => setOpen(true)}
                style={{ fontSize: 10, color: D.bl, fontWeight: 600, background:"none",
                  border:"none", cursor:"pointer", padding:"4px 8px" }}>
                {images.length} photo{images.length === 1 ? "" : "s"} ↗
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

    </Card>
  );
}

// Single-flight guard for the legacy migration. React StrictMode invokes
// mount effects twice in development, and a remount can do the same in
// production; without this, each legacy photo gets encoded and written twice,
// leaving an orphaned duplicate of its bytes in IndexedDB.
let legacyMigration = null;

// ── Vault list screen ──────────────────────────────────────────────────────
export function VaultScreen({ onAddNew }) {
  const [items, setItems] = useState(() => J.get("vault") || []);
  const [filter, setFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);

  // One-time migration of legacy single-photo items (bytes in localStorage)
  // into the IndexedDB media store. Non-destructive: an item is only rewritten
  // after its image is verified readable from IndexedDB.
  useEffect(() => {
    let alive = true;
    if (!legacyMigration) {
      legacyMigration = (async () => {
        const current = J.get("vault") || [];
        if (!current.some(hasLegacyPhoto)) return null;
        const migrated = [];
        let changed = false;
        for (const it of current) {
          const next = await migrateLegacyPhotoItem(it);
          if (next !== it) changed = true;
          migrated.push(next);
        }
        if (!changed) return null;
        J.set("vault", migrated);
        return migrated;
      })();
    }
    legacyMigration
      .then(migrated => { if (alive && migrated) setItems(migrated); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  function handleSave(item) {
    setItems(J.get("vault") || []);
  }

  function updateItem(updated) {
    const next = (J.get("vault") || []).map(i => (i.id === updated.id ? updated : i));
    J.set("vault", next);
    setItems(next);
  }

  async function deleteItem(id) {
    const target = (J.get("vault") || []).find(i => i.id === id);
    const updated = (J.get("vault") || []).filter(i => i.id !== id);
    J.set("vault", updated);
    setItems(updated);
    // Clean up orphaned image blobs so the media store doesn't grow forever.
    const ids = imageIdsOf(target);
    if (ids.length) await deleteImages(ids);
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
            <VaultItemCard key={item.id} item={item} onDelete={deleteItem} onUpdate={updateItem} />
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
