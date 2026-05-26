// ── GameCard — landing page card for a single game ────────

const G = {
  bg:"#F0EDE5", surf:"#FAFAF7", bk:"#0A0A0A",
  border:"#E8E4DA", mut:"#9B9589", txt:"#0A0A0A", r:18,
};

export function GameCard({ game, onSelect, bestScore }) {
  return (
    <button
      onClick={() => onSelect(game.id)}
      style={{
        width:"100%", textAlign:"left",
        background:G.surf, borderRadius:G.r,
        border:`1.5px solid ${G.border}`,
        padding:"16px", cursor:"pointer",
        display:"flex", alignItems:"flex-start", gap:14,
        boxShadow:"0 2px 10px rgba(0,0,0,0.06)",
        transition:"transform .12s, box-shadow .12s",
      }}
      onTouchStart={e => { e.currentTarget.style.transform="scale(.98)"; }}
      onTouchEnd={e => { e.currentTarget.style.transform="scale(1)"; }}
    >
      {/* Color accent + emoji */}
      <div style={{
        width:52, height:52, borderRadius:14, flexShrink:0,
        background:game.color + "22",
        border:`2px solid ${game.color}`,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:24,
      }}>
        {game.emoji}
      </div>

      <div style={{flex:1, minWidth:0}}>
        <div style={{
          fontFamily:"'Unbounded',monospace", fontSize:10, fontWeight:700,
          color:G.txt, letterSpacing:".06em", marginBottom:3,
        }}>
          {game.title.toUpperCase()}
        </div>
        <div style={{
          fontFamily:"'Unbounded',monospace", fontSize:6.5, letterSpacing:".08em",
          color:game.color, marginBottom:6, fontWeight:700,
        }}>
          {game.skill.toUpperCase()}
        </div>
        <p style={{fontSize:11.5, color:G.mut, lineHeight:1.55, margin:0}}>
          {game.description}
        </p>
        {bestScore != null && (
          <div style={{
            marginTop:8, display:"inline-flex", alignItems:"center", gap:4,
            background:G.bg, borderRadius:6, padding:"3px 8px",
          }}>
            <span style={{fontSize:9}}>🏆</span>
            <span style={{
              fontFamily:"'Unbounded',monospace", fontSize:7,
              fontWeight:700, color:G.txt, letterSpacing:".06em",
            }}>
              BEST {bestScore}
            </span>
          </div>
        )}
      </div>

      <span style={{fontSize:18, color:"#ccc", alignSelf:"center", flexShrink:0}}>›</span>
    </button>
  );
}
