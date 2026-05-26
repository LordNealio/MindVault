import { useState, useEffect, useCallback } from "react";
import { dbGetAll } from "../lib/db.js";
import { callClaude } from "../lib/ai.js";
import { today, getWeekNumber, getWeekStart, getDatesInWeek, fmtDate } from "../lib/utils.js";

const RETRO_KEY = "ww_retro_cache";
const loadRetroCache = () => { try { return JSON.parse(localStorage.getItem(RETRO_KEY)) || {}; } catch { return {}; } };
const saveRetroCache = (c) => localStorage.setItem(RETRO_KEY, JSON.stringify(c));

const ENERGY_LABELS = ["", "Low", "Moderate", "Okay", "Good", "High"];

function computeMetrics(situations, checkins, dates) {
  const sitSet = new Set(dates);
  const daySits = situations.filter((s) => sitSet.has(s.date));
  const dayCheckins = checkins.filter((c) => sitSet.has(c.date));

  const bods = dayCheckins.filter((c) => c.type === "bod");
  const eods = dayCheckins.filter((c) => c.type === "eod");

  // Rework rate: situations with category Rework / total
  const reworkSits = daySits.filter((s) => s.category === "Rework" || s.description?.toLowerCase().includes("rework"));
  const reworkRate = daySits.length > 0 ? Math.round((reworkSits.length / daySits.length) * 100) : 0;

  // Avg energy
  const avgEnergy = bods.length
    ? Math.round((bods.reduce((sum, b) => sum + (b.energyLevel || 3), 0) / bods.length) * 10) / 10
    : null;

  // Error recurrence: categories appearing more than once
  const catCounts = {};
  daySits.forEach((s) => { catCounts[s.category] = (catCounts[s.category] || 0) + 1; });
  const recurringCats = Object.entries(catCounts).filter(([, c]) => c > 1);

  // EOD avg rating
  const avgRating = eods.length
    ? Math.round((eods.reduce((sum, e) => sum + (e.rating || 3), 0) / eods.length) * 10) / 10
    : null;

  // Check-in consistency
  const daysWithBOD = new Set(bods.map((b) => b.date)).size;
  const daysWithEOD = new Set(eods.map((e) => e.date)).size;
  const workDays = Math.min(dates.length, 5);

  return {
    totalSituations: daySits.length,
    openSituations: daySits.filter((s) => s.status === "open").length,
    resolvedSituations: daySits.filter((s) => s.status === "resolved").length,
    reworkRate,
    reworkCount: reworkSits.length,
    avgEnergy,
    avgRating,
    recurringCats,
    daysWithBOD,
    daysWithEOD,
    workDays,
    checkInRate: workDays > 0 ? Math.round(((daysWithBOD + daysWithEOD) / (workDays * 2)) * 100) : 0,
    highImpactSits: daySits.filter((s) => s.impact === "High"),
    categoryBreakdown: catCounts,
  };
}

function buildRetroContext(situations, checkins, dates) {
  const sitSet = new Set(dates);
  const daySits = situations.filter((s) => sitSet.has(s.date));
  const dayCheckins = checkins.filter((c) => sitSet.has(c.date));

  const lines = [];
  lines.push(`WEEK OF ${fmtDate(dates[0])}`);
  lines.push(`Total situations logged: ${daySits.length}`);
  lines.push(`Situations by status: ${daySits.filter(s => s.status === "open").length} open, ${daySits.filter(s => s.status === "resolved").length} resolved`);

  if (daySits.length) {
    lines.push("\nSITUATIONS:");
    daySits.forEach((s) => {
      lines.push(`- [${s.status.toUpperCase()}] ${s.title} | ${s.category} | ${s.impact} impact`);
      if (s.description) lines.push(`  ${s.description.slice(0, 100)}`);
    });
  }

  const bods = dayCheckins.filter((c) => c.type === "bod");
  const eods = dayCheckins.filter((c) => c.type === "eod");

  if (bods.length) {
    lines.push("\nMORNING CHECK-INS:");
    bods.forEach((b) => {
      lines.push(`- ${b.date}: Energy ${b.energyLevel}/5 | Priorities: ${b.priorities?.join(", ")}`);
      if (b.anticipatedObstacles) lines.push(`  Risks: ${b.anticipatedObstacles.slice(0, 80)}`);
    });
  }

  if (eods.length) {
    lines.push("\nEVENING CHECK-INS:");
    eods.forEach((e) => {
      lines.push(`- ${e.date}: Rating ${e.rating}/5`);
      if (e.accomplishments) lines.push(`  Wins: ${e.accomplishments.slice(0, 80)}`);
      if (e.obstacles) lines.push(`  Obstacles: ${e.obstacles.slice(0, 80)}`);
      if (e.rework) lines.push(`  Rework: ${e.rework.slice(0, 60)}`);
    });
  }

  return lines.join("\n");
}

const RETRO_SYSTEM = `You are WorkWrite's behavioral analysis engine. Based on a week of work data, generate a structured retrospective with the following sections:

**BEHAVIORAL SIGNATURE**
[2–3 sentences describing this week's overall work pattern — honest, specific, non-judgmental]

**RECURRING PATTERN**
[The most significant recurring issue or theme. Be specific. Name the pattern, what drives it, and why it matters.]

**PEAK PERFORMANCE**
[When and how did the user do their best work this week? What conditions enabled it?]

**RISK ALERT**
[One specific risk or warning sign based on the data — rework concentration, energy drops, high-impact open situations, etc.]

**TOP 3 ACTIONS FOR NEXT WEEK**
1. [Specific, actionable, time-bound]
2. [Specific, actionable, time-bound]
3. [Specific, actionable, time-bound]

Keep each section tight — 2–4 sentences max. Be direct and honest, not generic.`;

// ─── UI components ─────────────────────────────────────────────
function MetricCard({ T, label, value, subLabel, color = "accent" }) {
  const colorMap = { accent: T.accent, green: T.green, amber: T.amber, purple: T.purple, red: T.red };
  const dimMap   = { accent: T.accentDim, green: T.greenDim, amber: T.amberDim, purple: T.purpleDim, red: T.redDim };
  return (
    <div style={{ background: T.surface, borderRadius: 14, padding: "16px 14px",
      border: `1px solid ${T.border}`, flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 22, fontWeight: 700,
        color: colorMap[color] || T.accent, marginBottom: 2 }}>{value}</div>
      <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 9, color: T.muted,
        letterSpacing: "0.5px", lineHeight: 1.3 }}>{label}</div>
      {subLabel && <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{subLabel}</div>}
    </div>
  );
}

function PatternCard({ T, icon, title, body, color = "accent" }) {
  const borderMap = { accent: T.accent, green: T.green, amber: T.amber, purple: T.purple, red: T.red };
  return (
    <div style={{ background: T.surface, borderRadius: 14, padding: "16px",
      border: `1px solid ${T.border}`, borderLeft: `3px solid ${borderMap[color] || T.accent}`,
      marginBottom: 10, display: "flex", gap: 14 }}>
      <span style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>{icon}</span>
      <div>
        <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 11, fontWeight: 600,
          color: T.text, marginBottom: 4, letterSpacing: "0.3px" }}>{title}</div>
        <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.55 }}>{body}</div>
      </div>
    </div>
  );
}

function BarRow({ T, label, value, max = 100, color }) {
  const colorMap = { accent: T.accent, green: T.green, amber: T.amber, purple: T.purple };
  const pct = Math.min(Math.round((value / max) * 100), 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: T.muted, width: 110, flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 6, background: T.surface2, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 3, width: `${pct}%`,
          background: colorMap[color] || T.accent, transition: "width 0.5s ease-out" }} />
      </div>
      <div style={{ fontSize: 11, color: colorMap[color] || T.accent, width: 32, textAlign: "right",
        fontFamily: "'Unbounded', sans-serif", fontWeight: 600 }}>{value}{max === 100 ? "%" : ""}</div>
    </div>
  );
}

function WeekPicker({ T, weekStart, onPrev, onNext, isCurrentWeek }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
      <button onClick={onPrev} style={{ background: T.surface2, border: `1px solid ${T.border}`,
        borderRadius: 10, padding: "8px 12px", cursor: "pointer", color: T.muted, fontSize: 16 }}>←</button>
      <div style={{ flex: 1, textAlign: "center", background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 10, padding: "8px 16px" }}>
        <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 11, color: T.text, fontWeight: 600 }}>
          WK {getWeekNumber(weekStart)} · {fmtDate(weekStart)}
        </div>
        {isCurrentWeek && (
          <div style={{ fontSize: 10, color: T.accent, fontFamily: "'Unbounded', sans-serif",
            letterSpacing: "0.5px", marginTop: 2 }}>CURRENT WEEK</div>
        )}
      </div>
      <button onClick={onNext} disabled={isCurrentWeek}
        style={{ background: T.surface2, border: `1px solid ${T.border}`,
          borderRadius: 10, padding: "8px 12px", cursor: isCurrentWeek ? "not-allowed" : "pointer",
          color: isCurrentWeek ? T.border : T.muted, fontSize: 16 }}>→</button>
    </div>
  );
}

function parseRetroSections(text) {
  const sections = {};
  const headers = [
    "BEHAVIORAL SIGNATURE",
    "RECURRING PATTERN",
    "PEAK PERFORMANCE",
    "RISK ALERT",
    "TOP 3 ACTIONS FOR NEXT WEEK",
  ];
  headers.forEach((h, i) => {
    const pattern = new RegExp(`\\*\\*${h}\\*\\*\\s*([\\s\\S]*?)(?=\\*\\*${headers[i + 1]}\\*\\*|$)`);
    const match = text.match(pattern);
    if (match) sections[h] = match[1].trim();
  });
  return sections;
}

// ─── Main RetroScreen ──────────────────────────────────────────
export default function RetroScreen({ T, settings, hideHeader = false }) {
  const todayStr = today();
  const currentWeekStart = getWeekStart(todayStr);

  const [weekStart, setWeekStart]     = useState(currentWeekStart);
  const [situations, setSituations]   = useState([]);
  const [checkins, setCheckins]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [synthesis, setSynthesis]     = useState(null);
  const [synthing, setSynthing]       = useState(false);
  const [metrics, setMetrics]         = useState(null);

  const dates = getDatesInWeek(weekStart);
  const isCurrentWeek = weekStart === currentWeekStart;
  const cacheKey = `retro_${weekStart}`;
  const cache = loadRetroCache();

  useEffect(() => {
    setLoading(true);
    Promise.all([dbGetAll("situations"), dbGetAll("checkins")]).then(([sits, checks]) => {
      setSituations(sits);
      setCheckins(checks);
      setMetrics(computeMetrics(sits, checks, dates));
      setSynthesis(cache[cacheKey] || null);
      setLoading(false);
    });
  }, [weekStart]);

  const generateSynthesis = async () => {
    if (!settings.apiKey) {
      alert("Add your Anthropic API key in MORE → Settings to generate synthesis.");
      return;
    }
    setSynthing(true);
    try {
      const context = buildRetroContext(situations, checkins, dates);
      const result = await callClaude(
        [{ role: "user", content: context }],
        RETRO_SYSTEM,
        settings.apiKey,
        1500,
      );
      setSynthesis(result);
      const newCache = { ...cache, [cacheKey]: result };
      saveRetroCache(newCache);
    } catch (err) {
      setSynthesis(`⚠️ Error: ${err.message}`);
    } finally {
      setSynthing(false);
    }
  };

  const prevWeek = () => {
    const d = new Date(weekStart + "T12:00:00");
    d.setDate(d.getDate() - 7);
    setWeekStart(d.toISOString().slice(0, 10));
    setSynthesis(null);
  };

  const nextWeek = () => {
    if (isCurrentWeek) return;
    const d = new Date(weekStart + "T12:00:00");
    d.setDate(d.getDate() + 7);
    const next = d.toISOString().slice(0, 10);
    setWeekStart(next);
    setSynthesis(cache[`retro_${next}`] || null);
  };

  const sections = synthesis ? parseRetroSections(synthesis) : null;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
        height: "60dvh", color: T.muted, fontFamily: "'Unbounded', sans-serif",
        fontSize: 11, letterSpacing: 1 }}>
        LOADING...
      </div>
    );
  }

  const noData = !metrics || metrics.totalSituations === 0 && metrics.daysWithBOD === 0;

  return (
    <div style={{ padding: "0 16px" }}>
      {!hideHeader && (
        <div style={{ padding: "20px 0 16px" }}>
          <h1 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 26, fontWeight: 700,
            color: T.text, margin: "0 0 4px" }}>RETRO</h1>
          <div style={{ fontSize: 13, color: T.muted }}>Weekly behavioral work signature</div>
        </div>
      )}

      <WeekPicker T={T} weekStart={weekStart} onPrev={prevWeek} onNext={nextWeek} isCurrentWeek={isCurrentWeek} />

      {noData ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: T.muted }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 11, letterSpacing: 1, marginBottom: 8 }}>
            NO DATA FOR THIS WEEK
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            Log situations and check-ins in the TODAY tab — they'll appear here as your behavioral signature builds.
          </div>
        </div>
      ) : (
        <>
          {/* Metrics grid */}
          <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 10, letterSpacing: "1.5px",
            color: T.muted, marginBottom: 10 }}>WEEK METRICS</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <MetricCard T={T} label="SITUATIONS" value={metrics.totalSituations} color="accent" />
            <MetricCard T={T} label="RESOLVED" value={metrics.resolvedSituations} color="green" />
            <MetricCard T={T} label="STILL OPEN" value={metrics.openSituations}
              color={metrics.openSituations > 3 ? "amber" : "accent"} />
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {metrics.avgEnergy !== null && (
              <MetricCard T={T} label="AVG ENERGY" value={`${metrics.avgEnergy}/5`}
                color={metrics.avgEnergy >= 4 ? "green" : metrics.avgEnergy >= 3 ? "accent" : "amber"} />
            )}
            {metrics.avgRating !== null && (
              <MetricCard T={T} label="AVG DAY RATING" value={`${metrics.avgRating}/5`}
                color={metrics.avgRating >= 4 ? "green" : metrics.avgRating >= 3 ? "accent" : "amber"} />
            )}
            <MetricCard T={T} label="CHECK-IN RATE" value={`${metrics.checkInRate}%`}
              color={metrics.checkInRate >= 80 ? "green" : metrics.checkInRate >= 50 ? "accent" : "amber"} />
          </div>

          {/* Signature bars */}
          <div style={{ background: `linear-gradient(135deg, ${T.surface}, ${T.surface2})`,
            border: `1px solid ${T.border}`, borderRadius: 16, padding: "18px", marginBottom: 16 }}>
            <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 10, letterSpacing: "1.5px",
              color: T.purple, marginBottom: 14 }}>BEHAVIORAL SIGNATURE</div>
            {metrics.avgEnergy !== null && (
              <BarRow T={T} label="Energy level" value={Math.round((metrics.avgEnergy / 5) * 100)}
                max={100} color="accent" />
            )}
            {metrics.avgRating !== null && (
              <BarRow T={T} label="Day quality" value={Math.round((metrics.avgRating / 5) * 100)}
                max={100} color="green" />
            )}
            <BarRow T={T} label="Rework rate" value={metrics.reworkRate} max={100}
              color={metrics.reworkRate > 30 ? "amber" : "green"} />
            <BarRow T={T} label="Check-in rate" value={metrics.checkInRate} max={100} color="purple" />
          </div>

          {/* Recurring patterns */}
          {metrics.recurringCats.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 10, letterSpacing: "1.5px",
                color: T.muted, marginBottom: 10 }}>RECURRING PATTERNS</div>
              {metrics.recurringCats.map(([cat, count]) => (
                <PatternCard key={cat} T={T} icon="🔁" color="amber" title={`${cat.toUpperCase()} — ${count}x THIS WEEK`}
                  body={`This category appeared ${count} times. Consider running a 5 Whys or Kaizen session.`} />
              ))}
            </div>
          )}

          {/* High-impact open situations */}
          {metrics.highImpactSits.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 10, letterSpacing: "1.5px",
                color: T.muted, marginBottom: 10 }}>HIGH-IMPACT OPEN ITEMS</div>
              {metrics.highImpactSits.map((s) => (
                <div key={s.id} style={{ background: T.surface, borderRadius: 14, padding: "14px 16px",
                  marginBottom: 8, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.red}` }}>
                  <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 11, fontWeight: 600,
                    color: T.text, marginBottom: 4 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: T.muted }}>{s.category} · {s.status}</div>
                </div>
              ))}
            </div>
          )}

          {/* AI Synthesis */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 10, letterSpacing: "1.5px",
              color: T.muted, marginBottom: 10 }}>AI SYNTHESIS</div>

            {!synthesis && !synthing && (
              <div style={{ background: T.surface, borderRadius: 16, padding: "20px",
                border: `1px solid ${T.border}`, textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🧠</div>
                <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 11, color: T.text,
                  letterSpacing: "0.5px", marginBottom: 8 }}>GENERATE SYNTHESIS</div>
                <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, marginBottom: 16 }}>
                  AI will analyze your week's data and surface behavioral patterns, peak performance windows, and specific actions for next week.
                </div>
                <button onClick={generateSynthesis} style={{
                  background: T.accent, color: "#fff", border: "none", borderRadius: 12,
                  padding: "13px 24px", fontFamily: "'Unbounded', sans-serif", fontSize: 11,
                  letterSpacing: "1px", fontWeight: 600, cursor: "pointer",
                }}>GENERATE WEEKLY SYNTHESIS</button>
              </div>
            )}

            {synthing && (
              <div style={{ textAlign: "center", padding: "40px 0", color: T.muted }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🧠</div>
                <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 11, letterSpacing: 1, color: T.purple }}>
                  SYNTHESIZING...
                </div>
              </div>
            )}

            {synthesis && !synthing && sections && (
              <div>
                {sections["BEHAVIORAL SIGNATURE"] && (
                  <PatternCard T={T} icon="🎯" color="purple" title="BEHAVIORAL SIGNATURE"
                    body={sections["BEHAVIORAL SIGNATURE"]} />
                )}
                {sections["RECURRING PATTERN"] && (
                  <PatternCard T={T} icon="🔁" color="amber" title="RECURRING PATTERN"
                    body={sections["RECURRING PATTERN"]} />
                )}
                {sections["PEAK PERFORMANCE"] && (
                  <PatternCard T={T} icon="⚡" color="green" title="PEAK PERFORMANCE"
                    body={sections["PEAK PERFORMANCE"]} />
                )}
                {sections["RISK ALERT"] && (
                  <PatternCard T={T} icon="⚠️" color="red" title="RISK ALERT"
                    body={sections["RISK ALERT"]} />
                )}
                {sections["TOP 3 ACTIONS FOR NEXT WEEK"] && (
                  <div style={{ background: T.surface, borderRadius: 14, padding: "16px",
                    border: `1px solid ${T.border}`, marginBottom: 10 }}>
                    <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 11, fontWeight: 600,
                      color: T.accent, marginBottom: 10 }}>NEXT WEEK ACTIONS</div>
                    <div style={{ fontSize: 13, color: T.text, lineHeight: 1.7, whiteSpace: "pre-line" }}>
                      {sections["TOP 3 ACTIONS FOR NEXT WEEK"]}
                    </div>
                  </div>
                )}
                <button onClick={generateSynthesis} style={{
                  width: "100%", background: "none", border: `1px solid ${T.border}`,
                  borderRadius: 12, padding: "12px", fontFamily: "'Unbounded', sans-serif",
                  fontSize: 10, letterSpacing: "1px", color: T.muted, cursor: "pointer", marginTop: 4,
                }}>↺ REGENERATE</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
