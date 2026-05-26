import React from "react";

const D = {
  bg:"#F0EDE5", white:"#FAFAF7", bk:"#0A0A0A",
  border:"#E8E4DA", muted:"#9B9589", rd:"#C1121F", yl:"#E8B84B",
};

export function OnboardingCard({ children }) {
  return (
    <div style={{
      background: D.white,
      borderRadius: 18,
      boxShadow: `0 3px 16px rgba(0,0,0,0.08)`,
      padding: "32px 24px",
      textAlign: "center",
      animation: "fadeUp .4s cubic-bezier(.16,1,.3,1) both",
    }}>
      {children}
    </div>
  );
}

export function OnboardingButton({ children, onClick, variant = "primary", style = {} }) {
  const isPrimary = variant === "primary";
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "14px 20px",
        borderRadius: 12,
        border: "none",
        fontFamily: "'Unbounded', monospace",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: ".12em",
        cursor: "pointer",
        transition: "all .2s",
        background: isPrimary ? D.bk : "transparent",
        color: isPrimary ? D.yl : D.bk,
        borderBottom: !isPrimary ? `2px solid ${D.border}` : "none",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
