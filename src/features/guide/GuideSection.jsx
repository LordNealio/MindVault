import { useState } from "react";

const D = {
  bg:"#F0EDE5", white:"#FAFAF7", bk:"#0A0A0A",
  border:"#E8E4DA", muted:"#9B9589",
};

export function GuideSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{
      borderBottom: `1px solid ${D.border}`,
      paddingBottom: 14,
      marginBottom: 14,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "8px 0",
          fontSize: 14,
          fontWeight: 600,
          color: D.bk,
          fontFamily: "'Unbounded', monospace",
        }}
      >
        {title}
        <span
          style={{
            display: "inline-block",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform .2s",
            fontSize: 12,
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.7,
            color: D.muted,
            marginTop: 12,
            paddingLeft: 0,
            animation: "fadeUp .2s cubic-bezier(.16,1,.3,1) both",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
