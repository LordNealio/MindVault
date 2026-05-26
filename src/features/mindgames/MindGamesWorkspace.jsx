import { useState, useCallback } from "react";
import { GAMES } from "./mindGamesData.js";
import { GameCard } from "./GameCard.jsx";
import { GameShell } from "./GameShell.jsx";
import { AttentionGame } from "./AttentionGame.jsx";
import { ReactionGame } from "./ReactionGame.jsx";
import { MemoryGame } from "./MemoryGame.jsx";
import { PatternGame } from "./PatternGame.jsx";
import { getRecentSessions, getPersonalBest } from "./saveMindGameSession.js";

const G = {
  bg:"#F0EDE5", surf:"#FAFAF7", bk:"#0A0A0A",
  border:"#E8E4DA", mut:"#9B9589", txt:"#0A0A0A",
  yl:"#E8B84B", rd:"#C1121F", bl:"#1D3557", r:18,
  shadow:"rgba(0,0,0,0.07)",
};

const GAME_MAP = {
  attention: AttentionGame,
  reaction:  ReactionGame,
  memory:    MemoryGame,
  pattern:   PatternGame,
};

// Abbreviate labels for recent sessions list
const TYPE_LABELS = {
  attention:"FOCUS", reaction:"REACT", memory:"MEMORY", pattern:"LOGIC",
};
const TYPE_COLORS = {
  attention:"#E8B84B", reaction:"#4F6EF7", memory:"#8B5CF6", pattern:"#22C55E",
};

function RecentRow({ session }) {
  const d = new Date(session.createdAt);
  const timeStr = d.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});
  const dateStr = d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
  const color = TYPE_COLORS[session.gameType] || G.mut;
  const label = TYPE_LABELS[session.gameType] || session.gameType.toUpperCase();

  return (
    <div style={{display:"flex",alignItems:"center",gap:10,
      padding:"8px 0",borderBottom:`1px solid ${G.border}`}}>
      <div style={{
        width:36,height:36,borderRadius:9,flexShrink:0,
        background:color+"22",border:`1.5px solid ${color}`,
        display:"flex",alignItems:"center",justifyContent:"center",
      }}>
        <span style={{fontFamily:"'Unbounded',monospace",fontSize:6.5,
          fontWeight:700,color,letterSpacing:".06em"}}>{label}</span>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:"'Unbounded',monospace",fontSize:10,
          fontWeight:700,color:G.txt}}>{session.score} pts</div>
        {session.accuracy != null && (
          <div style={{fontFamily:"'Unbounded',monospace",fontSize:7,
            color:G.mut,letterSpacing:".06em"}}>{session.accuracy}% accuracy</div>
        )}
        {session.averageReactionMs != null && (
          <div style={{fontFamily:"'Unbounded',monospace",fontSize:7,
            color:G.mut,letterSpacing:".06em"}}>{session.averageReactionMs}ms avg</div>
        )}
        {session.memorySpan != null && (
          <div style={{fontFamily:"'Unbounded',monospace",fontSize:7,
            color:G.mut,letterSpacing:".06em"}}>span {session.memorySpan}</div>
        )}
      </div>
      <div style={{textAlign:"right",flexShrink:0}}>
        <div style={{fontSize:10,color:G.mut}}>{dateStr}</div>
        <div style={{fontSize:9,color:G.mut}}>{timeStr}</div>
      </div>
    </div>
  );
}

function LandingView({ onSelect }) {
  const recent = getRecentSessions(5);
  const bests = Object.fromEntries(
    GAMES.map(g => {
      const pb = getPersonalBest(g.id);
      return [g.id, pb?.score ?? null];
    })
  );

  return (
    <div style={{background:G.bg,minHeight:"100%",paddingBottom:20}}>
      {/* Header */}
      <div style={{background:G.bk,padding:"18px 16px 20px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,right:0,width:40,height:40,background:G.yl,opacity:.9}}/>
        <div style={{position:"absolute",bottom:0,left:0,width:32,height:32,background:"#8B5CF6",opacity:.7}}/>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{fontFamily:"'Unbounded',monospace",fontSize:8,
            color:G.yl,letterSpacing:".14em",marginBottom:6}}>MINDVAULT</div>
          <div style={{fontFamily:"'Unbounded',monospace",fontSize:26,
            fontWeight:900,color:"#FAFAF7",lineHeight:1.05,marginBottom:6}}>
            MIND<br/>GAMES
          </div>
          <p style={{fontSize:12,color:"#666",lineHeight:1.5,maxWidth:280}}>
            Train attention, reaction speed, working memory, and logical reasoning.
          </p>
        </div>
      </div>

      <div style={{padding:"16px 16px 0"}}>
        {/* Games grid */}
        <div style={{fontFamily:"'Unbounded',monospace",fontSize:7.5,
          letterSpacing:".12em",color:G.mut,marginBottom:10}}>CHOOSE A GAME</div>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:24}}>
          {GAMES.map(game => (
            <GameCard
              key={game.id}
              game={game}
              onSelect={onSelect}
              bestScore={bests[game.id]}
            />
          ))}
        </div>

        {/* Recent sessions */}
        {recent.length > 0 && (
          <div style={{background:G.surf,borderRadius:G.r,
            boxShadow:`0 2px 10px ${G.shadow}`,overflow:"hidden",
            border:`1.5px solid ${G.border}`}}>
            <div style={{padding:"12px 14px 4px"}}>
              <div style={{fontFamily:"'Unbounded',monospace",fontSize:7.5,
                letterSpacing:".12em",color:G.mut}}>RECENT SESSIONS</div>
            </div>
            <div style={{padding:"0 14px 8px"}}>
              {recent.map((s, i) => (
                <RecentRow key={s.id || i} session={s}/>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function MindGamesWorkspace() {
  const [selectedGame, setSelectedGame] = useState(null);

  const handleSelect = useCallback((gameId) => {
    setSelectedGame(gameId);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedGame(null);
  }, []);

  if (selectedGame) {
    const GameComponent = GAME_MAP[selectedGame];
    const gameMeta = GAMES.find(g => g.id === selectedGame);

    if (!GameComponent || !gameMeta) {
      setSelectedGame(null);
      return null;
    }

    return (
      <GameShell game={gameMeta} onBack={handleBack}>
        <GameComponent onDone={handleBack}/>
      </GameShell>
    );
  }

  return <LandingView onSelect={handleSelect}/>;
}
