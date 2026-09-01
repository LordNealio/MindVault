import { useState, useEffect } from "react";

// App-level crisis / immediate-help surface.
//
// OWNERSHIP: this file is the single place any MindVault feature should get a
// help affordance from. It is deliberately app-level, not owned by one module,
// so the resource list has one place to be reviewed and localised.
//
// OPEN ITEM (needs a named owner): the resource list below is not localised.
// It leads with the user's own local emergency number because the app does not
// know the user's country, and names exactly one line, explicitly labelled by
// country. Do not add region-specific services without a source and a review
// owner — a wrong number in a crisis is worse than no number.
//
// This component never assesses risk, never infers crisis from user data, and
// is never triggered automatically. It is always user-initiated.

const D = { bk: "#0A0A0A", yl: "#E8B84B", rd: "#C1121F", border: "#E8E4DA", muted: "#6B665C" };

export function CrisisHelpSheet({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Get help now"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 600, background: "rgba(0,0,0,.6)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FAFAF7", borderRadius: "20px 20px 0 0", width: "100%",
          maxWidth: 480, maxHeight: "88vh", overflowY: "auto", padding: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontFamily: "'Unbounded',monospace", fontSize: 11, fontWeight: 900, letterSpacing: ".08em" }}>
            GET HELP NOW
          </span>
          <button onClick={onClose} autoFocus aria-label="Close"
            style={{
              width: 38, height: 38, borderRadius: "50%", border: `1px solid ${D.border}`,
              background: "#fff", fontSize: 17, cursor: "pointer",
            }}>✕</button>
        </div>

        <div style={{ border: `2px solid ${D.rd}`, borderRadius: 14, padding: 14, marginBottom: 16, background: "#FFF5F5" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: D.rd, marginBottom: 6 }}>
            If you are in immediate danger
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.75, margin: 0, color: D.bk }}>
            Contact your <strong>local emergency number</strong> now, or go to your nearest emergency
            department. This app is not a crisis service and cannot get help to you.
          </p>
        </div>

        <p style={{ fontSize: 13, lineHeight: 1.8, color: D.bk, marginTop: 0 }}>
          In the <strong>United States</strong>, you can call or text <strong>988</strong> — the Suicide
          &amp; Crisis Lifeline — 24 hours a day.
        </p>
        <p style={{ fontSize: 12.5, lineHeight: 1.8, color: D.muted }}>
          Outside the US, use your country's emergency number or a local crisis line. This app does not
          know where you are and will not guess at a service that may not exist in your country.
        </p>

        <div style={{ borderTop: `1px solid ${D.border}`, paddingTop: 14, marginTop: 14 }}>
          <p style={{ fontSize: 12.5, lineHeight: 1.8, color: D.bk, margin: 0 }}>
            Nothing you write in this app is monitored, and no one is alerted by it. Reaching one
            person you trust is a real action, and it counts.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Persistent, discreet entry point. Render this once per screen that could hold
 * difficult content — it must not be buried inside one step (audit S2).
 */
export function CrisisHelpButton({ style = {} }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "7px 12px", minHeight: 36, borderRadius: 20,
          border: `1px solid ${D.border}`, background: "#FAFAF7",
          color: D.bk, fontSize: 11, fontWeight: 700, cursor: "pointer", ...style,
        }}
      >
        <span aria-hidden="true" style={{ color: D.rd }}>◆</span> Get help
      </button>
      {open && <CrisisHelpSheet onClose={() => setOpen(false)} />}
    </>
  );
}
