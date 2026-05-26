import { useState, useEffect, useRef, useCallback } from "react";
import { callClaude } from "../lib/ai.js";
import { dbGetByIndex, dbGetAll } from "../lib/db.js";
import { today, uuid, timeAgo } from "../lib/utils.js";

const CONV_KEY = "ww_conversations";
const loadConvs = () => { try { return JSON.parse(localStorage.getItem(CONV_KEY)) || []; } catch { return []; } };
const saveConvs = (c) => localStorage.setItem(CONV_KEY, JSON.stringify(c));

const MODES = [
  { id: "coach",      label: "WORK COACH",  desc: "Contextual AI coach aware of your situations and patterns." },
  { id: "transcript", label: "TRANSCRIPT",  desc: "Paste a meeting or training transcript to extract insights." },
  { id: "deepdive",   label: "DEEP DIVE",   desc: "Extended analytical conversation for complex work problems." },
];

const SYSTEM_PROMPTS = {
  coach: (context) => `You are WorkWrite Coach, an expert AI work coach specializing in professional accounting environments. You help users improve workflow, reduce rework, and build better work habits.

${context ? `USER'S CURRENT CONTEXT:\n${context}\n` : ""}
Guidelines:
- Be direct and practical. Skip preamble.
- Ask clarifying questions when needed to diagnose root causes.
- Connect observations to frameworks when relevant (5 Whys, Kaizen, PDCA, etc.).
- Keep responses concise — 3–5 sentences unless depth is needed.
- Use the user's logged situations and check-ins to give personalized advice.`,

  transcript: () => `You are a WorkWrite transcript analyst. When given a meeting or training transcript, extract:
1. **Situations / Problems** identified (bullet list)
2. **Action Items** with implied owners (bullet list)
3. **Key Decisions** made (bullet list)
4. **Insights** for improvement (bullet list)
5. **Suggested Framework** if a specific improvement method applies

Format with clear bold headers. Be concise and actionable.`,

  deepdive: (context) => `You are WorkWrite Deep Dive, an advanced analytical partner for professional knowledge workers.

${context ? `USER'S CURRENT CONTEXT:\n${context}\n` : ""}
Guidelines:
- Engage with nuance and depth.
- Help the user think through complex situations systematically.
- Apply cognitive frameworks, mental models, and professional best practices.
- Challenge assumptions constructively.
- Responses can be longer when depth is warranted.`,
};

function buildContext(situations, checkins) {
  const parts = [];
  if (checkins.length) {
    const recent = checkins.slice(0, 3);
    parts.push("Recent check-ins:");
    recent.forEach((c) => {
      if (c.type === "bod") parts.push(`- BOD ${c.date}: Priorities: ${c.priorities?.join(", ")} | Energy: ${c.energyLevel}/5`);
      if (c.type === "eod") parts.push(`- EOD ${c.date}: ${c.accomplishments?.slice(0, 80)}...`);
    });
  }
  if (situations.length) {
    const open = situations.filter((s) => s.status !== "resolved").slice(0, 5);
    if (open.length) {
      parts.push("\nOpen situations:");
      open.forEach((s) => parts.push(`- [${s.status.toUpperCase()}] ${s.title} (${s.category}, ${s.impact} impact)`));
    }
  }
  return parts.join("\n");
}

// ─── Shared components ─────────────────────────────────────────
function Pill({ T, active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 14px", borderRadius: 20, border: "none", cursor: "pointer",
      background: active ? T.accentDim : T.surface2,
      color: active ? T.accent : T.muted,
      fontFamily: "'Unbounded', sans-serif", fontSize: 9, letterSpacing: "0.8px",
      fontWeight: 600,
      outline: active ? `1.5px solid ${T.accent}40` : "none",
    }}>{children}</button>
  );
}

function IconBtn({ onClick, children, T, title }) {
  return (
    <button onClick={onClick} title={title} style={{
      background: "none", border: "none", cursor: "pointer", padding: 6,
      color: T.muted, display: "flex", alignItems: "center", justifyContent: "center",
      borderRadius: 8,
    }}>{children}</button>
  );
}

// ─── Conversation List ─────────────────────────────────────────
function ConvList({ T, convs, onSelect, onNew, mode, setMode }) {
  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ padding: "20px 0 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 26, fontWeight: 700, color: T.text, margin: 0 }}>CHAT</h1>
        <button onClick={onNew} style={{
          background: T.accent, color: "#fff", border: "none", borderRadius: 10,
          padding: "8px 14px", fontFamily: "'Unbounded', sans-serif", fontSize: 10,
          letterSpacing: "1px", fontWeight: 600, cursor: "pointer",
        }}>+ NEW</button>
      </div>

      <div style={{ display: "flex", gap: 8, padding: "8px 0 16px", overflowX: "auto" }}>
        {MODES.map((m) => (
          <Pill key={m.id} T={T} active={mode === m.id} onClick={() => setMode(m.id)}>
            {m.label}
          </Pill>
        ))}
      </div>

      {mode === "transcript" && (
        <div style={{ background: T.accentDim, border: `1px solid ${T.accent}40`, borderRadius: 12,
          padding: "12px 14px", marginBottom: 16, fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
          Paste a meeting or training transcript into a new chat — the AI will extract situations, action items, and insights.
        </div>
      )}

      {convs.filter((c) => c.mode === mode).length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: T.muted }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>💬</div>
          <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 11, letterSpacing: 1, marginBottom: 8 }}>
            NO CONVERSATIONS YET
          </div>
          <div style={{ fontSize: 13 }}>Start a new chat above.</div>
        </div>
      ) : (
        convs
          .filter((c) => c.mode === mode)
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
          .map((c) => (
            <div key={c.id} onClick={() => onSelect(c)} style={{
              background: T.surface, borderRadius: 14, padding: "14px 16px",
              marginBottom: 8, border: `1px solid ${T.border}`, cursor: "pointer",
            }}>
              <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 12, fontWeight: 600,
                color: T.text, marginBottom: 4 }}>{c.title}</div>
              <div style={{ fontSize: 12, color: T.muted }}>
                {c.messages[c.messages.length - 1]?.content?.slice(0, 60)}...
              </div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>{timeAgo(c.updatedAt)}</div>
            </div>
          ))
      )}
    </div>
  );
}

// ─── Active Conversation ───────────────────────────────────────
function ConvView({ T, conv, onBack, onUpdate, settings, mode }) {
  const [messages, setMessages] = useState(conv.messages || []);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [context, setContext]   = useState("");
  const bottomRef = useRef(null);
  const textRef   = useRef(null);

  useEffect(() => {
    (async () => {
      const [sits, checkins] = await Promise.all([
        dbGetAll("situations"),
        dbGetAll("checkins"),
      ]);
      setContext(buildContext(sits, checkins.slice(-10)));
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (!settings.apiKey) {
      alert("Add your Anthropic API key in MORE → Settings to use Chat.");
      return;
    }

    const userMsg = { role: "user", content: text, ts: new Date().toISOString() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const systemFn = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.coach;
      const system = systemFn(context);
      const apiMessages = next.map(({ role, content }) => ({ role, content }));
      const reply = await callClaude(apiMessages, system, settings.apiKey,
        mode === "deepdive" ? 2048 : 1024);
      const aiMsg = { role: "assistant", content: reply, ts: new Date().toISOString() };
      const final = [...next, aiMsg];
      setMessages(final);

      const updated = {
        ...conv,
        messages: final,
        title: conv.title === "New Chat" && text.length < 60 ? text : conv.title,
        updatedAt: new Date().toISOString(),
      };
      onUpdate(updated);
    } catch (err) {
      const errMsg = { role: "assistant", content: `⚠️ Error: ${err.message}`, ts: new Date().toISOString() };
      setMessages((m) => [...m, errMsg]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, settings.apiKey, context, mode, conv, onUpdate]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const modeLabel = MODES.find((m) => m.id === mode)?.label || "CHAT";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
      {/* Header */}
      <div style={{ padding: "16px 16px 12px", display: "flex", alignItems: "center",
        gap: 12, borderBottom: `1px solid ${T.border}`, background: T.surface }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", cursor: "pointer", padding: "4px 8px 4px 0",
          color: T.accent, fontSize: 20,
        }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 11, fontWeight: 600,
            color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {conv.title}
          </div>
          <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 9, color: T.accent, letterSpacing: 1 }}>
            {modeLabel}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 0", color: T.muted }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>
              {mode === "transcript" ? "📋" : mode === "deepdive" ? "🔬" : "💬"}
            </div>
            <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 10, letterSpacing: 1, marginBottom: 8, color: T.muted }}>
              {MODES.find((m) => m.id === mode)?.label}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              {mode === "transcript"
                ? "Paste your meeting or training transcript below."
                : MODES.find((m) => m.id === mode)?.desc}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{
            display: "flex",
            flexDirection: "column",
            alignItems: msg.role === "user" ? "flex-end" : "flex-start",
            marginBottom: 12,
          }}>
            <div style={{
              padding: "12px 16px",
              borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              background: msg.role === "user" ? T.accent : T.surface2,
              color: msg.role === "user" ? "#fff" : T.text,
              fontSize: 14, lineHeight: 1.65, maxWidth: "85%",
              whiteSpace: "pre-wrap",
            }}>
              {msg.content}
            </div>
            <div style={{ fontSize: 10, color: T.muted, marginTop: 3, padding: "0 4px" }}>
              {timeAgo(msg.ts)}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 12 }}>
            <div style={{ padding: "12px 16px", borderRadius: "16px 16px 16px 4px",
              background: T.surface2, color: T.muted, fontSize: 14 }}>
              <span style={{ animation: "pulse 1.2s infinite" }}>●●●</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "10px 12px 10px", borderTop: `1px solid ${T.border}`,
        background: T.navBg, display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea
          ref={textRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={mode === "transcript" ? "Paste transcript here..." : "Message..."}
          rows={1}
          style={{
            flex: 1, background: T.surface2, border: `1px solid ${T.border}`,
            borderRadius: 20, padding: "10px 16px", fontSize: 14, color: T.text,
            lineHeight: 1.5, resize: "none", outline: "none", maxHeight: 120,
            fontFamily: "'Plus Jakarta Sans', sans-serif", overflowY: "auto",
          }}
          onInput={(e) => {
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
          }}
          onFocus={(e) => { e.target.style.borderColor = T.accent; }}
          onBlur={(e) => { e.target.style.borderColor = T.border; }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          style={{
            width: 40, height: 40, borderRadius: "50%", border: "none",
            background: input.trim() && !loading ? T.accent : T.surface3,
            color: "#fff", cursor: input.trim() && !loading ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, fontSize: 16, transition: "background 0.15s",
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}

// ─── Main ChatScreen ───────────────────────────────────────────
export default function ChatScreen({ T, settings }) {
  const [convs, setConvs]     = useState(() => loadConvs());
  const [active, setActive]   = useState(null);
  const [mode, setMode]       = useState("coach");

  const newConv = () => {
    const c = {
      id: uuid(),
      title: "New Chat",
      mode,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const next = [c, ...convs];
    setConvs(next);
    saveConvs(next);
    setActive(c);
  };

  const updateConv = useCallback((updated) => {
    setConvs((prev) => {
      const next = prev.map((c) => (c.id === updated.id ? updated : c));
      saveConvs(next);
      return next;
    });
    setActive(updated);
  }, []);

  const deleteConv = (id) => {
    const next = convs.filter((c) => c.id !== id);
    setConvs(next);
    saveConvs(next);
    if (active?.id === id) setActive(null);
  };

  if (active) {
    return (
      <ConvView
        T={T}
        conv={active}
        mode={active.mode}
        settings={settings}
        onBack={() => setActive(null)}
        onUpdate={updateConv}
      />
    );
  }

  return (
    <ConvList
      T={T}
      convs={convs}
      mode={mode}
      setMode={setMode}
      onSelect={setActive}
      onNew={newConv}
    />
  );
}
