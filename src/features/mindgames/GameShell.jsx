import { useEffect } from "react";

// ── Design tokens (matching App.jsx D palette) ────────────
const G = {
  bg:"#0A0A0A", surf:"#141414", surf2:"#1C1C1E",
  border:"#2C2C2E", txt:"#FAFAF7", mut:"#9B9589",
  yl:"#E8B84B", rd:"#C1121F", gn:"#16a34a", r:14,
};

/**
 * GameShell — consistent layout wrapper for all games.
 * Provides a header with back-button, game title + skill tag,
 * and a scrollable content area.
 */
export function GameShell({ game, onBack, children }) {
  // Prevent body scroll while a game is active
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div style={{
      display:"flex", flexDirection:"column",
      height:"calc(100dvh - 72px)", // dvh respects browser chrome on mobile
      background:G.bg, overflow:"hidden",
    }}>
      {/* Header */}
      <div style={{
        flexShrink:0, background:G.surf,
        borderBottom:`1px solid ${G.border}`,
        padding:"12px 16px",
        display:"flex", alignItems:"center", gap:12,
      }}>
        <button
          onClick={onBack}
          style={{
            fontFamily:"'Unbounded',monospace", fontSize:8, fontWeight:700,
            letterSpacing:".08em", color:G.mut, flexShrink:0,
            display:"flex", alignItems:"center", gap:4,
          }}
        >
          ← GAMES
        </button>
        <div style={{flex:1, minWidth:0}}>
          <div style={{
            fontFamily:"'Unbounded',monospace", fontSize:10, fontWeight:700,
            color:G.txt, letterSpacing:".06em",
            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
          }}>
            {game.emoji} {game.title.toUpperCase()}
          </div>
          <div style={{
            fontFamily:"'Unbounded',monospace", fontSize:6.5, letterSpacing:".08em",
            color:game.color, marginTop:2,
          }}>
            {game.skill.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Game content — flex column so children can fill height */}
      <div style={{flex:1, minHeight:0, display:"flex", flexDirection:"column", overflow:"hidden"}}>
        {children}
      </div>
    </div>
  );
}
