import { useScrollLock } from "../../lib/useScrollLock.js";

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
  // Body overflow alone does not hold on iOS — see useScrollLock.
  useScrollLock();

  return (
    <div style={{
      display:"flex", flexDirection:"column",
      // 72px is the fixed bottom nav. The home-indicator inset has to come off
      // too, or on a notched iPhone the game is that much taller than the space
      // it has and the page scrolls.
      height:"calc(100dvh - 72px - env(safe-area-inset-bottom))",
      background:G.bg, overflow:"hidden", overscrollBehavior:"contain",
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

      {/* Game content — flex column so children can fill height.
          overflowY:auto, NOT overflow:hidden: a game taller than the space it
          has was being clipped with no way to reach the rest of it (the
          attention game showed only its top arrow). Scrolling is the safety
          net; games should still aim to fit. */}
      <div style={{flex:1, minHeight:0, display:"flex", flexDirection:"column",
        overflowX:"hidden", overflowY:"auto", overscrollBehavior:"contain"}}>
        {children}
      </div>
    </div>
  );
}
