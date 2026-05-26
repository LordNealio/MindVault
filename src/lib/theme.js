import { createContext, useContext } from "react";

export const DARK = {
  bg: "#0D0F14",
  surface: "#161920",
  surface2: "#1E2230",
  surface3: "#252A38",
  accent: "#4F6EF7",
  accentDim: "rgba(79,110,247,0.12)",
  green: "#22C55E",
  greenDim: "rgba(34,197,94,0.12)",
  amber: "#F59E0B",
  amberDim: "rgba(245,158,11,0.12)",
  purple: "#8B5CF6",
  purpleDim: "rgba(139,92,246,0.12)",
  red: "#EF4444",
  redDim: "rgba(239,68,68,0.12)",
  text: "#F1F5F9",
  muted: "#6B7A99",
  border: "#2D3348",
  navBg: "#161920",
  mode: "dark",
};

export const LIGHT = {
  bg: "#F4F6FC",
  surface: "#FFFFFF",
  surface2: "#EEF1F8",
  surface3: "#E5E9F4",
  accent: "#4361EE",
  accentDim: "rgba(67,97,238,0.08)",
  green: "#059669",
  greenDim: "rgba(5,150,105,0.08)",
  amber: "#D97706",
  amberDim: "rgba(217,119,6,0.08)",
  purple: "#7C3AED",
  purpleDim: "rgba(124,58,237,0.08)",
  red: "#DC2626",
  redDim: "rgba(220,38,38,0.08)",
  text: "#1A1D4E",
  muted: "#7B8DB0",
  border: "#DDE3F0",
  navBg: "#FFFFFF",
  mode: "light",
};

export const ThemeCtx = createContext(DARK);
export const useT = () => useContext(ThemeCtx);
