// Programs hub — the five feature modules that used to each own a slot in the
// bottom navigation. Bottom nav is now Home / Vault / Programs / More.

const D = {
  bg: "#F0EDE5", white: "#FAFAF7", bk: "#0A0A0A", muted: "#9B9589",
  border: "#E8E4DA", yl: "#E8B84B", rd: "#C1121F", bl: "#1D3557",
  gr: "#2D6A4F", shadow: "rgba(0,0,0,0.08)",
};

// Tab ids owned by the Programs section. Used by App.jsx to keep the
// "Programs" nav item lit while any program is open.
export const PROGRAM_TABS = ["programs", "throne", "jarvis", "habits", "publish", "games"];

export const PROGRAMS = [
  {
    id: "throne",
    icon: "🚽",
    label: "Throne",
    desc: "Quick captures and candid thoughts, whenever they strike.",
    accent: D.rd,
  },
  {
    id: "jarvis",
    icon: "⚡",
    label: "Orpheus",
    desc: "Your AI thinking partner, grounded in your vault.",
    accent: D.yl,
  },
  {
    id: "habits",
    icon: "✓",
    label: "Habits",
    desc: "Build routines that fit your life. Track them daily.",
    accent: D.gr,
  },
  {
    id: "publish",
    icon: "📣",
    label: "Publish",
    desc: "Turn a private idea into ready-to-post content.",
    accent: D.bl,
  },
  {
    id: "games",
    icon: "🧠",
    label: "Games",
    desc: "Sharpen focus, memory, and pattern recognition.",
    accent: "#6B4F9E",
  },
];

export function ProgramsScreen({ onOpen }) {
  return (
    <div style={{ paddingBottom: 120 }}>
      {/* Header — matches the app's black/gold section headers */}
      <div style={{ background: D.bk, padding: "18px 16px 20px" }}>
        <div style={{
          fontFamily: "'Unbounded',monospace", fontSize: 8, fontWeight: 700,
          letterSpacing: ".14em", color: D.yl, marginBottom: 4,
        }}>
          PROGRAMS
        </div>
        <div style={{ fontFamily: "'Unbounded',monospace", fontSize: 18, fontWeight: 900, color: D.white }}>
          {PROGRAMS.length} programs
        </div>
        <p style={{ fontSize: 11, color: "#8a857c", marginTop: 6, lineHeight: 1.6 }}>
          Everything beyond your daily journal and vault.
        </p>
      </div>

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {PROGRAMS.map(p => (
          <button
            key={p.id}
            onClick={() => onOpen(p.id)}
            aria-label={`Open ${p.label}`}
            style={{
              display: "flex", alignItems: "center", gap: 14, width: "100%",
              padding: "16px 14px", borderRadius: 18, textAlign: "left",
              background: D.white, border: `1px solid ${D.border}`,
              borderLeft: `4px solid ${p.accent}`,
              boxShadow: `0 2px 12px ${D.shadow}`, cursor: "pointer",
              minHeight: 72, // comfortable mobile tap target
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 12, flexShrink: 0,
              background: D.bk, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 24,
            }}>
              {p.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: "'Unbounded',monospace", fontSize: 13, fontWeight: 900,
                color: D.bk, marginBottom: 3,
              }}>
                {p.label}
              </div>
              <div style={{ fontSize: 11, color: D.muted, lineHeight: 1.5 }}>
                {p.desc}
              </div>
            </div>
            <span style={{ fontSize: 20, color: p.accent, flexShrink: 0 }}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Slim back bar shown above an open program. */
export function ProgramHeader({ programId, onBack }) {
  const p = PROGRAMS.find(x => x.id === programId);
  if (!p) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px", background: D.bk,
      borderBottom: `1px solid rgba(255,255,255,.08)`,
    }}>
      <button
        onClick={onBack}
        aria-label="Back to Programs"
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "6px 10px",
          borderRadius: 8, background: "rgba(255,255,255,.1)", border: "none",
          color: D.yl, fontFamily: "'Unbounded',monospace", fontSize: 8,
          fontWeight: 700, letterSpacing: ".1em", cursor: "pointer",
        }}
      >
        ← PROGRAMS
      </button>
      <span style={{ fontSize: 14 }}>{p.icon}</span>
      <span style={{
        fontFamily: "'Unbounded',monospace", fontSize: 10, fontWeight: 900,
        color: D.white, letterSpacing: ".04em",
      }}>
        {p.label.toUpperCase()}
      </span>
    </div>
  );
}
