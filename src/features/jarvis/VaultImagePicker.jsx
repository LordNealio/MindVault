import { useState, useRef, useEffect } from "react";
import { processImageFile, MAX_IMAGES_PER_ITEM } from "../../lib/vaultMedia.js";

const D = {
  bg: "#F0EDE5", white: "#FAFAF7", bl: "#1D3557", rd: "#C1121F",
  yl: "#E8B84B", bk: "#0A0A0A", muted: "#9B9589", border: "#E8E4DA",
  gr: "#2D6A4F",
};

// ── Lightbox with prev/next across a set ───────────────────────────────────
export function ImageLightbox({ images, startIndex = 0, title, onClose }) {
  const [i, setI] = useState(startIndex);
  const img = images[i];

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI(v => (v + 1) % images.length);
      if (e.key === "ArrowLeft") setI(v => (v - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, onClose]);

  if (!img) return null;

  function download() {
    const a = document.createElement("a");
    a.href = img.full;
    a.download = img.name || `${title || "photo"}.jpg`;
    a.click();
  }

  const navBtn = (dir, label) => (
    <button
      onClick={(e) => { e.stopPropagation(); setI(v => (v + dir + images.length) % images.length); }}
      style={{
        width: 44, height: 44, borderRadius: "50%", border: "none", flexShrink: 0,
        background: "rgba(255,255,255,.15)", color: "#fff", fontSize: 20,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
      }}
      aria-label={label}
    >{label}</button>
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.93)",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}
      >
        <span style={{ color: "#fff", fontSize: 13, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}{images.length > 1 ? ` · ${i + 1} of ${images.length}` : ""}
        </span>
        <div style={{ display: "flex", gap: 10, flexShrink: 0, marginLeft: 12 }}>
          <button onClick={download}
            style={{ padding: "7px 14px", borderRadius: 8, border: "1.5px solid rgba(255,255,255,.35)", background: "rgba(255,255,255,.1)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            ⬇ Save
          </button>
          <button onClick={onClose}
            style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.15)", color: "#fff", fontSize: 18, cursor: "pointer" }}>
            ✕
          </button>
        </div>
      </div>

      <div
        onClick={e => e.stopPropagation()}
        style={{ flex: 1, width: "100%", maxWidth: 480, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0, gap: 8 }}
      >
        {images.length > 1 && navBtn(-1, "‹")}
        <img src={img.full} alt={img.name || title}
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 12, boxShadow: "0 8px 40px rgba(0,0,0,.5)", flex: 1, minWidth: 0 }} />
        {images.length > 1 && navBtn(1, "›")}
      </div>

      {images.length > 1 && (
        <div onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 6, marginTop: 12, overflowX: "auto", maxWidth: "100%", padding: "0 4px" }}>
          {images.map((im, idx) => (
            <button key={im.id} onClick={() => setI(idx)}
              style={{
                width: 40, height: 40, borderRadius: 6, flexShrink: 0, padding: 0, cursor: "pointer",
                border: idx === i ? `2px solid ${D.yl}` : "2px solid transparent",
                opacity: idx === i ? 1 : 0.55, overflow: "hidden", background: "none",
              }}>
              <img src={im.thumb || im.full} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </button>
          ))}
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 10, color: "rgba(255,255,255,.4)" }}>Tap outside to close</div>
    </div>
  );
}

// ── Read-only responsive grid (saved items) ────────────────────────────────
export function ImageGrid({ images, title, onRemove }) {
  const [lightbox, setLightbox] = useState(null);
  if (!images?.length) return null;

  return (
    <>
      <div style={{
        display: "grid", gap: 6,
        gridTemplateColumns: images.length === 1 ? "1fr" : "repeat(auto-fill, minmax(88px, 1fr))",
      }}>
        {images.map((im, idx) => (
          <div key={im.id} style={{ position: "relative" }}>
            <button
              onClick={() => setLightbox(idx)}
              style={{
                width: "100%", padding: 0, border: "none", background: "none", cursor: "zoom-in",
                borderRadius: 10, overflow: "hidden", display: "block",
                aspectRatio: images.length === 1 ? "auto" : "1 / 1",
                // A lone image sizes to its own height, which is 0 until it
                // decodes. Reserve space so the card doesn't collapse.
                minHeight: images.length === 1 ? 120 : undefined,
              }}>
              {/* No loading="lazy": these are data: URLs already held in
                  memory, so lazy saves no fetch, and browsers leave such
                  images permanently undecoded here. Thumbnails (320px) are
                  what keeps a 10-image card cheap. */}
              <img src={im.thumb || im.full} alt={im.name || title}
                style={{
                  width: "100%", height: images.length === 1 ? "auto" : "100%",
                  maxHeight: images.length === 1 ? 320 : undefined,
                  objectFit: images.length === 1 ? "contain" : "cover", display: "block",
                }} />
            </button>
            {onRemove && (
              <button
                onClick={() => onRemove(im.id)}
                title="Remove this image"
                style={{
                  position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%",
                  background: "rgba(10,10,10,.75)", color: "#fff", border: "none", fontSize: 12,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
                }}>×</button>
            )}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: D.muted, marginTop: 6 }}>
        {images.length} image{images.length === 1 ? "" : "s"} · tap to zoom
      </div>
      {lightbox !== null && (
        <ImageLightbox images={images} startIndex={lightbox} title={title} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}

// ── Editable picker (create + add-more flows) ──────────────────────────────
/**
 * images: array of processed records ({id, full, thumb, name})
 * onChange: (nextImages) => void
 */
export function VaultImagePicker({ images, onChange, max = MAX_IMAGES_PER_ITEM, compact, alreadyHave = 0 }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(0);          // files currently decoding
  const [errors, setErrors] = useState([]);     // per-file failures
  // Two channels: a limit warning must persist until the next action, while a
  // success toast self-clears. One shared slot let the toast bury the warning.
  const [limitMsg, setLimitMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [lightbox, setLightbox] = useState(null);

  const remaining = max - images.length;
  const full = remaining <= 0;

  async function handleFiles(e) {
    const picked = Array.from(e.target.files || []);
    e.target.value = ""; // allow re-picking the same file
    if (!picked.length) return;

    setErrors([]);
    setLimitMsg("");
    setSuccessMsg("");

    let accepted = picked;
    const overLimit = picked.length > remaining;
    if (overLimit) {
      accepted = picked.slice(0, Math.max(0, remaining));
      setLimitMsg(
        remaining <= 0
          ? `You've reached the limit of ${max} images. Remove one to add another.`
          : `You picked ${picked.length}, but only ${remaining} more ${remaining === 1 ? "fits" : "fit"} (limit ${max}). Added the first ${accepted.length}; the rest were skipped.`
      );
    }
    if (!accepted.length) return;

    setBusy(accepted.length);
    const done = [];
    const failed = [];

    // Sequential so a huge multi-select doesn't spike memory on mobile.
    for (const file of accepted) {
      try {
        done.push(await processImageFile(file));
      } catch (err) {
        failed.push(err.message || `${file.name} failed`);
      }
      setBusy(b => b - 1);
    }

    // Partial success is kept — failures never discard what worked.
    if (done.length) onChange([...images, ...done]);
    if (failed.length) setErrors(failed);
    if (done.length && !failed.length && !overLimit) {
      setSuccessMsg(`Added ${done.length} image${done.length === 1 ? "" : "s"}.`);
      setTimeout(() => setSuccessMsg(""), 2500);
    }
    setBusy(0);
  }

  const remove = (id) => {
    onChange(images.filter(im => im.id !== id));
    setLimitMsg("");
    setSuccessMsg("");
  };
  const move = (idx, dir) => {
    const next = [...images];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const sq = {
    width: 20, height: 20, borderRadius: 5, border: "none", cursor: "pointer",
    background: "rgba(10,10,10,.72)", color: "#fff", fontSize: 11, lineHeight: 1,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        {/* When adding to a saved entry, count against the entry's real
            total (already-saved + pending) so "N of 10" always means the
            same thing to the reader. */}
        <span style={{ fontSize: 11, fontWeight: 700, color: images.length ? D.bk : D.muted }}>
          {alreadyHave + images.length} of {alreadyHave + max} images
          {alreadyHave > 0 && (
            <span style={{ fontWeight: 400, color: D.muted }}> · {alreadyHave} already saved</span>
          )}
        </span>
        {images.length > 1 && (
          <span style={{ fontSize: 9, color: D.muted }}>◀ ▶ to reorder</span>
        )}
      </div>

      {images.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: 6, marginBottom: 10 }}>
          {images.map((im, idx) => (
            <div key={im.id} style={{ position: "relative", aspectRatio: "1 / 1", borderRadius: 10, overflow: "hidden", border: `1px solid ${D.border}` }}>
              <img
                src={im.thumb || im.full} alt={im.name}
                onClick={() => setLightbox(idx)}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", cursor: "zoom-in" }}
              />
              <button onClick={() => remove(im.id)} title="Remove"
                style={{ ...sq, position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", background: D.rd, fontSize: 13 }}>×</button>
              {images.length > 1 && (
                <div style={{ position: "absolute", bottom: 4, left: 4, display: "flex", gap: 3 }}>
                  <button onClick={() => move(idx, -1)} disabled={idx === 0} title="Move left"
                    style={{ ...sq, opacity: idx === 0 ? 0.3 : 1 }}>◀</button>
                  <button onClick={() => move(idx, 1)} disabled={idx === images.length - 1} title="Move right"
                    style={{ ...sq, opacity: idx === images.length - 1 ? 0.3 : 1 }}>▶</button>
                </div>
              )}
              <span style={{
                position: "absolute", top: 4, left: 4, background: "rgba(10,10,10,.72)", color: "#fff",
                fontSize: 9, fontWeight: 700, borderRadius: 4, padding: "1px 5px",
              }}>{idx + 1}</span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => inputRef.current?.click()}
        disabled={full || busy > 0}
        style={{
          width: "100%", padding: compact ? "10px" : (images.length ? "12px" : "28px"),
          borderRadius: 12, border: `2px dashed ${full ? D.border : D.muted}`,
          background: D.bg, color: full ? D.muted : D.bk, fontSize: 12,
          cursor: full || busy > 0 ? "not-allowed" : "pointer", fontWeight: 600,
        }}>
        {busy > 0
          ? `Processing ${busy} image${busy === 1 ? "" : "s"}…`
          : full
            ? `Limit reached (${max} images)`
            : images.length
              ? `+ Add more photos (${remaining} left)`
              : "Tap to pick photos — select several at once"}
      </button>
      <input
        ref={inputRef} type="file" accept="image/*" multiple
        style={{ display: "none" }} onChange={handleFiles}
      />

      {limitMsg && (
        <div role="alert" style={{
          marginTop: 8, padding: "8px 10px", borderRadius: 8, fontSize: 11, lineHeight: 1.5,
          background: D.yl + "22", border: `1px solid ${D.yl}`, color: "#6b5310",
        }}>⚠ {limitMsg}</div>
      )}
      {successMsg && (
        <div style={{
          marginTop: 8, padding: "8px 10px", borderRadius: 8, fontSize: 11,
          background: D.gr + "18", border: `1px solid ${D.gr}`, color: D.gr, fontWeight: 600,
        }}>✓ {successMsg}</div>
      )}
      {errors.length > 0 && (
        <div style={{
          marginTop: 8, padding: "8px 10px", borderRadius: 8, fontSize: 11,
          background: "#ffe6e6", border: `1px solid ${D.rd}`, color: "#8f1218", lineHeight: 1.5,
        }}>
          {errors.length} image{errors.length === 1 ? "" : "s"} couldn't be added:
          {errors.map((er, i) => <div key={i}>· {er}</div>)}
          <div style={{ marginTop: 4, opacity: .8 }}>The others were kept.</div>
        </div>
      )}

      {lightbox !== null && (
        <ImageLightbox images={images} startIndex={lightbox} title="Preview" onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
