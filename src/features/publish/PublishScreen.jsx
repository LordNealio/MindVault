import { useState, useEffect } from "react";
import {
  FORMATS, getBrandProfile, saveBrandProfile,
  saveDraft, listDrafts, deleteDraft,
  generateAssets, entryToText,
} from "../../lib/publish.js";

const D = {
  bg: "#F0EDE5", bk: "#0A0A0A", muted: "#9B9589",
  yl: "#E8B84B", border: "#E8E4DA", surf: "#FAFAF7", rd: "#C1121F",
  gr: "#3DD68C",
};

const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function PublishScreen({ entries = [], accessToken = "" }) {
  const [view, setView] = useState("create"); // create | brand | drafts
  const [idea, setIdea] = useState("");
  const [showEntryPicker, setShowEntryPicker] = useState(false);
  const [selectedFormats, setSelectedFormats] = useState(FORMATS.map(f => f.id));
  const [generating, setGenerating] = useState(false);
  const [assets, setAssets] = useState(null);
  const [error, setError] = useState("");
  const [brand, setBrand] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [copied, setCopied] = useState(null);
  const [savedIds, setSavedIds] = useState([]);

  useEffect(() => {
    getBrandProfile().then(setBrand).catch(() => setBrand({ id: "default", name: "", about: "", audience: "", tone: "", ctas: "" }));
  }, []);

  useEffect(() => {
    if (view === "drafts") listDrafts().then(setDrafts).catch(() => setDrafts([]));
  }, [view]);

  const toggleFormat = (id) => {
    setSelectedFormats(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError("");
    setAssets(null);
    setSavedIds([]);
    try {
      const result = await generateAssets(idea, selectedFormats, brand || {}, accessToken);
      setAssets(result);
    } catch (err) {
      setError(`Generation failed (${err.message}). Check your access token in Settings → MORE.`);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (formatId, content) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(formatId);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* clipboard blocked */ }
  };

  const handleSaveDraft = async (formatId, content) => {
    await saveDraft({ format: formatId, content, ideaText: idea.slice(0, 300) });
    setSavedIds(s => [...s, formatId]);
  };

  const label = (s) => (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", marginBottom: 6, color: D.bk, fontFamily: "'Unbounded',monospace" }}>{s}</div>
  );

  // ── Sub-nav ────────────────────────────────────────────────
  const subnav = (
    <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
      {[["create", "✨ CREATE"], ["brand", "🎨 BRAND"], ["drafts", "📂 DRAFTS"]].map(([id, l]) => (
        <button key={id} onClick={() => setView(id)}
          style={{
            flex: 1, padding: "10px 4px", borderRadius: 8, fontSize: 10, fontWeight: 700,
            fontFamily: "'Unbounded',monospace", letterSpacing: ".05em",
            background: view === id ? D.bk : D.surf, color: view === id ? D.yl : D.muted,
            border: `1px solid ${view === id ? D.bk : D.border}`, cursor: "pointer",
          }}>
          {l}
        </button>
      ))}
    </div>
  );

  // ── BRAND VIEW ─────────────────────────────────────────────
  if (view === "brand") {
    if (!brand) return <div style={{ padding: 20, color: D.muted }}>Loading…</div>;
    const set = (k) => (e) => setBrand({ ...brand, [k]: e.target.value });
    const fields = [
      ["name", "NAME / BRAND", "e.g. Justin Neal / MindVault"],
      ["about", "WHAT YOU DO", "e.g. I build AI tools for mindful productivity"],
      ["audience", "WHO IT'S FOR", "e.g. Founders and creators who journal"],
      ["tone", "VOICE & TONE", "e.g. Warm, direct, a little poetic. No hype."],
      ["ctas", "CTAS & LINKS", "e.g. Try MindVault → mindvault-app-zeta.vercel.app"],
    ];
    return (
      <div style={{ padding: 20, maxWidth: 480, margin: "0 auto", paddingBottom: 100 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: D.bk }}>Publish</h2>
        <div style={{ fontSize: 11, color: D.muted, marginBottom: 16 }}>Brand memory — injected into every generation, stored only on this device</div>
        {subnav}
        {fields.map(([k, l, ph]) => (
          <div key={k} style={{ marginBottom: 14 }}>
            {label(l)}
            <textarea value={brand[k] || ""} onChange={set(k)} placeholder={ph}
              style={{
                width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${D.border}`,
                fontSize: 13, fontFamily: "inherit", minHeight: k === "tone" || k === "about" ? 60 : 40,
                boxSizing: "border-box", background: D.surf,
              }} />
          </div>
        ))}
        <button
          onClick={async () => { await saveBrandProfile(brand); setView("create"); }}
          style={{
            width: "100%", padding: 12, borderRadius: 8, background: D.yl, border: "none",
            fontSize: 12, fontWeight: 700, cursor: "pointer", color: D.bk,
          }}>
          SAVE BRAND PROFILE
        </button>
      </div>
    );
  }

  // ── DRAFTS VIEW ────────────────────────────────────────────
  if (view === "drafts") {
    return (
      <div style={{ padding: 20, maxWidth: 480, margin: "0 auto", paddingBottom: 100 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: D.bk }}>Publish</h2>
        <div style={{ fontSize: 11, color: D.muted, marginBottom: 16 }}>{drafts.length} saved draft{drafts.length === 1 ? "" : "s"}</div>
        {subnav}
        {drafts.length === 0 && (
          <div style={{ textAlign: "center", color: D.muted, fontSize: 13, padding: "40px 0" }}>
            No drafts yet — generate content in Create and save what you like
          </div>
        )}
        {drafts.map(d => {
          const fmt = FORMATS.find(f => f.id === d.format);
          return (
            <div key={d.id} style={{
              border: `1px solid ${D.border}`, borderRadius: 12, padding: 14,
              marginBottom: 12, background: D.surf,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: D.bk }}>
                  {fmt?.icon} {fmt?.label || d.format}
                </span>
                <span style={{ fontSize: 10, color: D.muted }}>{fmtDate(d.createdAt)}</span>
              </div>
              <div style={{
                fontSize: 12, color: D.bk, whiteSpace: "pre-wrap", lineHeight: 1.5,
                maxHeight: 120, overflow: "hidden", marginBottom: 10,
              }}>
                {d.content.slice(0, 400)}{d.content.length > 400 ? "…" : ""}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => handleCopy(d.id, d.content)}
                  style={{ flex: 1, padding: 8, borderRadius: 6, background: D.bk, color: copied === d.id ? D.gr : "#fff", border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                  {copied === d.id ? "✓ COPIED" : "COPY"}
                </button>
                <button onClick={async () => { await deleteDraft(d.id); setDrafts(await listDrafts()); }}
                  style={{ padding: "8px 12px", borderRadius: 6, background: "transparent", border: `1px solid ${D.border}`, color: D.rd, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                  DELETE
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── CREATE VIEW ────────────────────────────────────────────
  const recentEntries = entries.slice(-10).reverse();
  return (
    <div style={{ padding: 20, maxWidth: 480, margin: "0 auto", paddingBottom: 100 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: D.bk }}>Publish</h2>
      <div style={{ fontSize: 11, color: D.muted, marginBottom: 16 }}>Turn a private idea into public content</div>
      {subnav}

      {label("THE IDEA")}
      <textarea
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        placeholder="Paste a thought, lesson, or story worth sharing — or pull one from your journal below"
        style={{
          width: "100%", padding: 12, borderRadius: 8, border: `1px solid ${D.border}`,
          fontSize: 13, fontFamily: "inherit", minHeight: 110, boxSizing: "border-box",
          background: D.surf, marginBottom: 8,
        }} />

      {recentEntries.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setShowEntryPicker(!showEntryPicker)}
            style={{ background: "transparent", border: "none", color: D.muted, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}>
            {showEntryPicker ? "▾" : "▸"} PULL FROM A JOURNAL ENTRY
          </button>
          {showEntryPicker && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {recentEntries.map((e, i) => {
                const text = entryToText(e);
                if (!text) return null;
                return (
                  <button key={i}
                    onClick={() => { setIdea(text); setShowEntryPicker(false); }}
                    style={{
                      textAlign: "left", padding: 10, borderRadius: 8, cursor: "pointer",
                      border: `1px solid ${D.border}`, background: D.surf, fontSize: 11, color: D.bk,
                    }}>
                    <span style={{ fontWeight: 700 }}>{fmtDate(e.date)}</span>
                    <span style={{ color: D.muted }}> — {text.slice(0, 70)}…</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {label("FORMATS")}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {FORMATS.map(f => {
          const on = selectedFormats.includes(f.id);
          return (
            <button key={f.id} onClick={() => toggleFormat(f.id)}
              style={{
                padding: 10, borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
                background: on ? D.yl : D.surf, color: D.bk,
                border: `1px solid ${on ? D.yl : D.border}`,
              }}>
              {f.icon} {f.label}
            </button>
          );
        })}
      </div>

      {!accessToken ? (
        <div style={{
          background: D.surf, border: `1px solid ${D.border}`, borderRadius: 8,
          padding: 14, fontSize: 12, color: D.muted, textAlign: "center",
        }}>
          Enter your access token in <strong>MORE → Settings</strong> to enable AI generation
        </div>
      ) : (
        <button
          onClick={handleGenerate}
          disabled={generating || !idea.trim() || selectedFormats.length === 0}
          style={{
            width: "100%", padding: 14, borderRadius: 8, fontSize: 12, fontWeight: 700,
            background: generating || !idea.trim() || selectedFormats.length === 0 ? D.muted : D.bk,
            color: D.yl, border: "none",
            cursor: generating || !idea.trim() ? "wait" : "pointer",
          }}>
          {generating ? "WRITING YOUR CONTENT…" : `✨ GENERATE ${selectedFormats.length} ASSET${selectedFormats.length === 1 ? "" : "S"}`}
        </button>
      )}
      {accessToken && (
        <div style={{ fontSize: 10, color: D.muted, marginTop: 6, textAlign: "center" }}>
          Sends this idea + your brand profile to Claude via MindVault's secure proxy
        </div>
      )}

      {error && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 8, fontSize: 12, background: "#ffe6e6", color: "#a33" }}>
          {error}
        </div>
      )}

      {assets && (
        <div style={{ marginTop: 20 }}>
          {label("YOUR ASSETS")}
          {FORMATS.filter(f => assets[f.id]).map(f => (
            <div key={f.id} style={{
              border: `1px solid ${D.border}`, borderRadius: 12, padding: 14,
              marginBottom: 12, background: D.surf,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8, color: D.bk }}>
                {f.icon} {f.label}
              </div>
              <div style={{ fontSize: 12, color: D.bk, whiteSpace: "pre-wrap", lineHeight: 1.6, marginBottom: 10 }}>
                {assets[f.id]}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => handleCopy(f.id, assets[f.id])}
                  style={{ flex: 1, padding: 9, borderRadius: 6, background: D.bk, color: copied === f.id ? D.gr : "#fff", border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                  {copied === f.id ? "✓ COPIED" : "COPY"}
                </button>
                <button
                  onClick={() => handleSaveDraft(f.id, assets[f.id])}
                  disabled={savedIds.includes(f.id)}
                  style={{
                    flex: 1, padding: 9, borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer",
                    background: savedIds.includes(f.id) ? D.gr : "transparent",
                    color: savedIds.includes(f.id) ? "#fff" : D.bk,
                    border: savedIds.includes(f.id) ? "none" : `1px solid ${D.border}`,
                  }}>
                  {savedIds.includes(f.id) ? "✓ SAVED" : "SAVE DRAFT"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
