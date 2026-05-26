import { useState } from "react";
import { dbGetAll } from "../lib/db.js";

function Row({ T, label, children, sub }) {
  return (
    <div style={{ padding: "16px 0", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 12, fontWeight: 600,
            color: T.text, letterSpacing: "0.3px" }}>{label}</div>
          {sub && <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>{sub}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

function SectionHeader({ T, children }) {
  return (
    <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 9, letterSpacing: "2px",
      color: T.muted, padding: "20px 0 8px" }}>{children}</div>
  );
}

function Toggle({ T, value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 48, height: 28, borderRadius: 14, border: "none",
        background: value ? T.accent : T.surface2,
        position: "relative", cursor: "pointer", flexShrink: 0,
        transition: "background 0.2s",
        outline: `2px solid ${value ? T.accent + "40" : "transparent"}`,
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: "50%", background: "#fff",
        position: "absolute", top: 4, left: value ? 24 : 4,
        transition: "left 0.2s",
        boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
      }} />
    </button>
  );
}

function KeyInput({ T, value, onChange, placeholder, isSecret = true }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", marginTop: 8 }}>
      <input
        type={isSecret && !show ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", background: T.surface2, border: `1px solid ${T.border}`,
          borderRadius: 10, padding: "12px 44px 12px 14px", fontSize: 13, color: T.text,
          outline: "none", fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
        onFocus={(e) => { e.target.style.borderColor = T.accent; }}
        onBlur={(e) => { e.target.style.borderColor = T.border; }}
      />
      {isSecret && (
        <button
          onClick={() => setShow((s) => !s)}
          style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer", color: T.muted, fontSize: 16 }}>
          {show ? "🙈" : "👁"}
        </button>
      )}
    </div>
  );
}

function ThemeToggle({ T, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {[
        { id: "dark",  label: "Dark",  emoji: "🌙" },
        { id: "light", label: "Light", emoji: "☀️" },
      ].map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          style={{
            flex: 1, padding: "10px 12px", borderRadius: 12, border: "none", cursor: "pointer",
            background: value === opt.id ? T.accentDim : T.surface2,
            color: value === opt.id ? T.accent : T.muted,
            fontFamily: "'Unbounded', sans-serif", fontSize: 10, letterSpacing: "0.5px",
            fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            outline: value === opt.id ? `1.5px solid ${T.accent}` : "none",
          }}
        >
          <span>{opt.emoji}</span>
          <span>{opt.label.toUpperCase()}</span>
        </button>
      ))}
    </div>
  );
}

async function exportAllData() {
  const [situations, checkins, transcripts] = await Promise.all([
    dbGetAll("situations"),
    dbGetAll("checkins"),
    dbGetAll("transcripts"),
  ]);
  const data = {
    exportedAt: new Date().toISOString(),
    version: "1.0",
    situations,
    checkins,
    transcripts,
    conversations: (() => { try { return JSON.parse(localStorage.getItem("ww_conversations")) || []; } catch { return []; } })(),
    frameworkSessions: (() => { try { return JSON.parse(localStorage.getItem("ww_fw_sessions")) || []; } catch { return []; } })(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `workwrite-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SettingsScreen({ T, settings, onSettingsChange }) {
  const [saved, setSaved] = useState(false);

  const update = (key) => (val) => {
    onSettingsChange({ [key]: val });
    if (key !== "theme") {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  };

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ padding: "20px 0 4px" }}>
        <h1 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 26, fontWeight: 700,
          color: T.text, margin: 0 }}>MORE</h1>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 6 }}>Settings & preferences</div>
      </div>

      {/* Profile */}
      <SectionHeader T={T}>PROFILE</SectionHeader>
      <div style={{ background: T.surface, borderRadius: 16, padding: "0 16px", border: `1px solid ${T.border}` }}>
        <Row T={T} label="Your Name" sub={settings.name || "Not set"}>
          <input
            value={settings.name || ""}
            onChange={(e) => update("name")(e.target.value)}
            placeholder="Your name"
            style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8,
              padding: "8px 12px", fontSize: 13, color: T.text, outline: "none", width: 140,
              fontFamily: "'Plus Jakarta Sans', sans-serif", textAlign: "right" }}
            onFocus={(e) => { e.target.style.borderColor = T.accent; }}
            onBlur={(e) => { e.target.style.borderColor = T.border; }}
          />
        </Row>
        <Row T={T} label="Role / Title" sub={settings.role || "Not set"}>
          <input
            value={settings.role || ""}
            onChange={(e) => update("role")(e.target.value)}
            placeholder="e.g. Staff Accountant"
            style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8,
              padding: "8px 12px", fontSize: 13, color: T.text, outline: "none", width: 160,
              fontFamily: "'Plus Jakarta Sans', sans-serif", textAlign: "right" }}
            onFocus={(e) => { e.target.style.borderColor = T.accent; }}
            onBlur={(e) => { e.target.style.borderColor = T.border; }}
          />
        </Row>
      </div>

      {/* Appearance */}
      <SectionHeader T={T}>APPEARANCE</SectionHeader>
      <div style={{ background: T.surface, borderRadius: 16, padding: "16px", border: `1px solid ${T.border}` }}>
        <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 11, fontWeight: 600,
          color: T.text, marginBottom: 12 }}>THEME</div>
        <ThemeToggle T={T} value={settings.theme || "dark"} onChange={update("theme")} />
      </div>

      {/* AI Configuration */}
      <SectionHeader T={T}>AI CONFIGURATION</SectionHeader>
      <div style={{ background: T.surface, borderRadius: 16, padding: "16px", border: `1px solid ${T.border}` }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 11, fontWeight: 600,
            color: T.text, marginBottom: 4 }}>ANTHROPIC API KEY</div>
          <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5, marginBottom: 8 }}>
            Used for Chat and Framework analysis. Calls go directly from your browser to Anthropic.
          </div>
          <KeyInput T={T} value={settings.apiKey || ""} onChange={update("apiKey")}
            placeholder="sk-ant-..." />
          {settings.apiKey && (
            <div style={{ fontSize: 11, color: T.green, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
              ✓ API key set
            </div>
          )}
        </div>

        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
          <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 11, fontWeight: 600,
            color: T.text, marginBottom: 4 }}>ACCESS TOKEN</div>
          <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5, marginBottom: 8 }}>
            Optional. Used if you have a server-side proxy deployed. Retro synthesis can also use this path.
          </div>
          <KeyInput T={T} value={settings.accessToken || ""} onChange={update("accessToken")}
            placeholder="Your access token..." />
          {settings.accessToken && (
            <div style={{ fontSize: 11, color: T.green, marginTop: 6 }}>✓ Token set</div>
          )}
        </div>
      </div>

      {/* Data */}
      <SectionHeader T={T}>DATA</SectionHeader>
      <div style={{ background: T.surface, borderRadius: 16, padding: "0 16px", border: `1px solid ${T.border}` }}>
        <Row T={T} label="Export All Data" sub="Download a JSON backup of all your data">
          <button onClick={exportAllData} style={{
            background: T.accentDim, color: T.accent, border: "none", borderRadius: 8,
            padding: "8px 14px", fontFamily: "'Unbounded', sans-serif", fontSize: 10,
            letterSpacing: "0.5px", fontWeight: 600, cursor: "pointer",
          }}>EXPORT</button>
        </Row>
        <Row T={T} label="Clear Retro Cache" sub="Force re-generate AI synthesis">
          <button onClick={() => { localStorage.removeItem("ww_retro_cache"); setSaved(true); setTimeout(() => setSaved(false), 1500); }} style={{
            background: T.surface2, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 8,
            padding: "8px 14px", fontFamily: "'Unbounded', sans-serif", fontSize: 10,
            letterSpacing: "0.5px", fontWeight: 600, cursor: "pointer",
          }}>CLEAR</button>
        </Row>
      </div>

      {/* About */}
      <SectionHeader T={T}>ABOUT</SectionHeader>
      <div style={{ background: T.surface, borderRadius: 16, padding: "0 16px", border: `1px solid ${T.border}` }}>
        <Row T={T} label="WorkWrite" sub="v1.0.0" />
        <Row T={T} label="Research basis">
          <span style={{ fontSize: 11, color: T.muted, textAlign: "right", maxWidth: 200, lineHeight: 1.4 }}>
            Cognitive Load Theory · Feedback Loop Learning · Metacognitive Regulation
          </span>
        </Row>
        <Row T={T} label="Storage" sub="All data stored locally on this device" />
      </div>

      {saved && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          background: T.green, color: "#fff", borderRadius: 20, padding: "10px 20px",
          fontFamily: "'Unbounded', sans-serif", fontSize: 11, letterSpacing: "0.5px",
          zIndex: 300, boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}>
          ✓ Saved
        </div>
      )}

      <div style={{ height: 32 }} />
    </div>
  );
}
