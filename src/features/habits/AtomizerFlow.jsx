import { useState } from "react";
import { createHabit } from "../../lib/habitService.js";
import { searchGoals, detectDomain, personalizeAtoms, QUALIFICATION_BANKS } from "../../lib/atomizer-rules.js";
import { callProxy } from "../../lib/ai.js";
import { HabitFormScreen } from "./HabitFormScreen.jsx";

const AI_COACH_SYSTEM = `You are a warm, practical habit coach inside MindVault, a private journaling app. The user described a goal and answered qualification questions; you also receive the app's template suggestions.

Write a short personalized starting plan in plain text (no markdown symbols). Structure:
1. One sentence naming which approach fits them best and WHY, referencing their specific answers.
2. A concrete "your first two weeks" plan: exact days, exact durations, starting versions. Small and winnable beats ambitious.
3. One pitfall this specific person should watch for.

Rules: under 200 words. Never give medical advice; if they indicated injuries or health concerns, keep intensity low and tell them to clear it with a professional first. Never invent equipment or time they didn't mention. Warm but not gushing.`;

const D = {
  bg: "#F0EDE5", bk: "#0A0A0A", muted: "#9B9589",
  yl: "#E8B84B", border: "#E8E4DA", surf: "#FAFAF7",
  gr: "#3DD68C",
};

export function AtomizerFlow({ onHabitCreated, onCancel }) {
  const [step, setStep] = useState("input"); // input | qualify | candidates | editing
  const [goalText, setGoalText] = useState("");
  const [domain, setDomain] = useState("life");
  const [answers, setAnswers] = useState({});
  const [candidates, setCandidates] = useState([]);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [expandedCard, setExpandedCard] = useState(null);
  const [aiPlan, setAiPlan] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  // AI enhance rides the existing hardened proxy; token lives in mv3_settings.
  const accessToken = (() => {
    try { return JSON.parse(localStorage.getItem("mv3_settings") || "{}").accessToken || ""; }
    catch { return ""; }
  })();

  const handleEnhanceWithAI = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const summary = candidates.slice(0, 3).map(c =>
        `- ${c.title} (${c.approach || c.goalTitle}): full=${c.full} | reduced=${c.reduced} | minimum=${c.minimum}`
      ).join("\n");
      const userMsg = `Goal: ${goalText}\nDomain: ${domain}\nMy answers: ${JSON.stringify(answers)}\n\nApp's top template suggestions:\n${summary}`;
      const text = await callProxy(
        [{ role: "user", content: userMsg }],
        AI_COACH_SYSTEM,
        accessToken,
        1024
      );
      setAiPlan(text);
    } catch (err) {
      setAiError(`Couldn't reach the AI coach (${err.message}). The templates below work offline either way.`);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSearchGoals = () => {
    const results = searchGoals(goalText);
    if (results.length === 0) {
      alert("No matching templates found. Try different keywords or create a custom habit.");
      return;
    }

    setDomain(detectDomain(results));
    setStep("qualify");
  };

  const handleQualifyAndSearch = () => {
    const results = searchGoals(goalText);
    if (results.length === 0) {
      alert("No matching templates found. Try different keywords or create a custom habit.");
      return;
    }

    const atoms = [];
    results.forEach(goal => {
      goal.atoms.forEach(atom => {
        atoms.push(atom);
      });
    });

    const personalized = personalizeAtoms(atoms, domain, answers);
    if (personalized.length === 0) {
      alert("Based on your health answers, we'd rather not suggest these habits without a doctor's input. Try a gentler goal like walking or breathing exercises.");
      return;
    }

    setCandidates(personalized.slice(0, 10));
    setStep("candidates");
  };

  const handleEditCandidate = (candidate) => {
    setEditingCandidate(candidate);
    setStep("editing");
  };

  const handleSaveFromEdit = async (habitData, rrule) => {
    try {
      await createHabit(habitData, rrule);
      onHabitCreated();
    } catch (err) {
      console.error("Failed to create habit:", err);
      alert("Failed to create habit");
    }
  };

  // ────────────────────────────────────────────────────────────
  // STEP 1: INPUT
  if (step === "input") {
    return (
      <div style={{ padding: 20, maxWidth: 600, margin: "0 auto", paddingBottom: 40 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: D.bk }}>
          What habit do you want to build?
        </h2>
        <p style={{ fontSize: 13, color: D.muted, marginBottom: 16, lineHeight: 1.6 }}>
          Describe your goal and we'll find personalized templates. (Takes ~30 seconds)
        </p>
        <textarea
          value={goalText}
          onChange={(e) => setGoalText(e.target.value)}
          placeholder="e.g. Get stronger, Read more, Learn to code, Reduce stress..."
          autoFocus
          style={{
            width: "100%", padding: "12px", borderRadius: 8,
            border: `1px solid ${D.border}`, minHeight: 100,
            fontSize: 14, fontFamily: "inherit", boxSizing: "border-box",
            marginBottom: 16,
          }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleSearchGoals}
            disabled={!goalText.trim()}
            style={{
              flex: 1, padding: "12px", borderRadius: 8,
              background: goalText.trim() ? D.yl : D.muted,
              border: "none", cursor: goalText.trim() ? "pointer" : "not-allowed",
              fontSize: 12, fontWeight: 700, color: D.bk,
            }}
          >
            NEXT →
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: "12px 16px", borderRadius: 8,
              border: `1px solid ${D.border}`, background: "transparent",
              cursor: "pointer", fontSize: 12, color: D.muted,
            }}
          >
            CANCEL
          </button>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // STEP 2: QUALIFY
  if (step === "qualify") {
    const qs = QUALIFICATION_BANKS[domain] || QUALIFICATION_BANKS.life;
    const allAnswered = qs.every(q => answers[q.id]);

    return (
      <div style={{ padding: 20, maxWidth: 600, margin: "0 auto", paddingBottom: 40 }}>
        <button
          onClick={() => {
            setStep("input");
            setAnswers({});
          }}
          style={{
            background: "transparent", border: "none",
            cursor: "pointer", fontSize: 12, color: D.muted,
            fontWeight: 700, marginBottom: 20,
          }}
        >
          ← BACK
        </button>

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: D.bk }}>
          Tell us a bit more
        </h2>
        <p style={{ fontSize: 12, color: D.muted, marginBottom: 20 }}>
          Your answers directly shape which habits we suggest — and how big to start
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
          {qs.map(q => (
            <div key={q.id}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: D.bk }}>
                {q.q}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {q.opts.map(opt => (
                  <button
                    key={opt}
                    onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                    style={{
                      padding: "10px", borderRadius: 8,
                      background: answers[q.id] === opt ? D.yl : D.surf,
                      border: `1px solid ${answers[q.id] === opt ? D.yl : D.border}`,
                      cursor: "pointer", fontSize: 11, fontWeight: 600, color: D.bk,
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleQualifyAndSearch}
          disabled={!allAnswered}
          style={{
            width: "100%", padding: "12px", borderRadius: 8,
            background: allAnswered ? D.yl : D.muted,
            border: "none", cursor: allAnswered ? "pointer" : "not-allowed",
            fontSize: 12, fontWeight: 700, color: D.bk,
          }}
        >
          SEE RECOMMENDATIONS →
        </button>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // STEP 3: CANDIDATES
  if (step === "candidates") {
    const needsCaution = domain === "fitness" &&
      (answers.health === "Minor" || answers.health === "Significant / unsure");

    return (
      <div style={{ padding: 20, maxWidth: 600, margin: "0 auto", paddingBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <button
            onClick={() => setStep("qualify")}
            style={{
              background: "transparent", border: "none",
              cursor: "pointer", fontSize: 12, color: D.muted,
              fontWeight: 700,
            }}
          >
            ← BACK
          </button>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: D.bk, margin: "0 0 0 8px", flex: 1 }}>
            Recommendations
          </h2>
        </div>

        {needsCaution && (
          <div style={{
            background: "#FFF3CD", border: "1px solid #FFE69C", borderRadius: 8,
            padding: 12, marginBottom: 16, fontSize: 12, color: "#856404",
          }}>
            ⚠️ <strong>Important:</strong> Based on your answers, please check with a healthcare provider before starting or intensifying a fitness habit. Suggestions below are kept gentle on purpose.
          </div>
        )}

        <div style={{ fontSize: 12, color: D.muted, marginBottom: 16 }}>
          {candidates.length} templates, ranked for your answers
        </div>

        {accessToken && !aiPlan && (
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={handleEnhanceWithAI}
              disabled={aiLoading}
              style={{
                width: "100%", padding: "12px", borderRadius: 8,
                background: aiLoading ? D.muted : D.bk, color: "#fff",
                border: "none", cursor: aiLoading ? "wait" : "pointer",
                fontSize: 12, fontWeight: 700,
              }}
            >
              {aiLoading ? "COACHING IN PROGRESS..." : "✨ GET AN AI-PERSONALIZED PLAN"}
            </button>
            <div style={{ fontSize: 10, color: D.muted, marginTop: 6, textAlign: "center" }}>
              Sends your goal and answers (nothing else) to Claude via MindVault's secure proxy
            </div>
            {aiError && (
              <div style={{
                marginTop: 8, padding: 10, borderRadius: 8, fontSize: 11,
                background: "#ffe6e6", color: "#a33",
              }}>
                {aiError}
              </div>
            )}
          </div>
        )}

        {aiPlan && (
          <div style={{
            background: D.bk, color: "#F0EDE5", borderRadius: 12,
            padding: 16, marginBottom: 16, fontSize: 12, lineHeight: 1.7,
            whiteSpace: "pre-wrap",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", marginBottom: 8, color: D.yl }}>
              ✨ YOUR PERSONALIZED PLAN
            </div>
            {aiPlan}
            <button
              onClick={() => setAiPlan(null)}
              style={{
                display: "block", marginTop: 12, padding: "6px 10px",
                borderRadius: 6, border: "1px solid #444", background: "transparent",
                color: D.muted, fontSize: 10, cursor: "pointer",
              }}
            >
              DISMISS
            </button>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {candidates.map((atom, idx) => (
            <details
              key={idx}
              open={expandedCard === idx}
              style={{
                border: `1px solid ${D.border}`, borderRadius: 12,
                padding: 16, cursor: "pointer", background: D.surf,
              }}
              onToggle={() => setExpandedCard(expandedCard === idx ? null : idx)}
            >
              <summary
                style={{
                  listStyle: "none",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: D.bk, marginBottom: 4 }}>
                    {atom.title}
                  </div>
                  <div style={{ fontSize: 11, color: D.muted }}>
                    {atom.approach || atom.goalTitle}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 18, fontWeight: 900,
                    color: atom.score > 70 ? D.gr : D.yl,
                    minWidth: 40, textAlign: "center",
                  }}
                >
                  {atom.score}
                </div>
              </summary>

              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${D.border}` }}>
                {atom.notes?.length > 0 && (
                  <div style={{
                    background: D.bg, borderRadius: 8, padding: 10,
                    marginBottom: 12, fontSize: 11, color: D.bk, lineHeight: 1.5,
                  }}>
                    {atom.notes.map((note, i) => (
                      <div key={i}>💡 {note}</div>
                    ))}
                  </div>
                )}

                {["full", "reduced", "minimum"].map(variant => (
                  <div key={variant} style={{ fontSize: 12, marginBottom: 8, color: D.bk }}>
                    <strong style={{ textTransform: "capitalize" }}>{variant}:</strong> {atom[variant]}
                    {atom.recommendedVariant === variant && (
                      <span style={{
                        marginLeft: 6, fontSize: 10, fontWeight: 700,
                        background: D.gr, color: "#fff", borderRadius: 4,
                        padding: "1px 6px",
                      }}>
                        START HERE
                      </span>
                    )}
                  </div>
                ))}

                {atom.starter && (
                  <div style={{
                    background: "#EAF5EE", border: "1px solid #CDE8D6",
                    borderRadius: 8, padding: 10, marginTop: 4, marginBottom: 8,
                    fontSize: 11, color: "#2F5D3F", lineHeight: 1.5,
                  }}>
                    🌱 <strong>Getting started:</strong> {atom.starter}
                  </div>
                )}

                <div style={{ fontSize: 11, color: D.muted, marginBottom: 12, marginTop: 8 }}>
                  <div><strong>Cue:</strong> {atom.cue?.time || "Flexible"} • {atom.cue?.context || atom.cue?.location}</div>
                  <div><strong>Frequency:</strong> {atom.cadence}</div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => handleEditCandidate(atom)}
                    style={{
                      flex: 1, padding: "10px", borderRadius: 8,
                      background: D.yl, border: "none", cursor: "pointer",
                      fontSize: 11, fontWeight: 700, color: D.bk,
                    }}
                  >
                    EDIT & CREATE
                  </button>
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // STEP 3: EDITING
  if (step === "editing" && editingCandidate) {
    return (
      <AtomizerEditForm
        candidate={editingCandidate}
        onSubmit={handleSaveFromEdit}
        onCancel={() => {
          setEditingCandidate(null);
          setStep("candidates");
        }}
      />
    );
  }

  return null;
}

// ────────────────────────────────────────────────────────────
// Edit form for candidates

function AtomizerEditForm({ candidate, onSubmit, onCancel }) {
  // Scale the starting duration ladder down when personalization
  // recommends starting smaller (beginner, low commitment, tight schedule).
  const variantScale = { full: 1, reduced: 0.5, minimum: 0.25 }[candidate.recommendedVariant] || 1;
  const baseDuration = Math.max(5, Math.round(candidate.ratings.timeRequired * 10 * variantScale));

  const [title, setTitle] = useState(candidate.title);
  const [durationFull, setDurationFull] = useState(baseDuration);
  const [durationReduced, setDurationReduced] = useState(Math.max(3, Math.ceil(baseDuration * 0.5)));
  const [durationMinimum, setDurationMinimum] = useState(Math.max(2, Math.ceil(baseDuration * 0.25)));
  const [difficulty, setDifficulty] = useState(candidate.ratings.difficulty);
  const [enjoyment, setEnjoyment] = useState(candidate.ratings.enjoyment);
  const [impact, setImpact] = useState(candidate.ratings.impact);
  const [alignment, setAlignment] = useState(candidate.ratings.alignment);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert("Title is required");
      return;
    }

    setSaving(true);
    try {
      const habitData = {
        title: title.trim(),
        category: candidate.goalTitle.toLowerCase().replace(/ /g, "-"),
        description: `${candidate.goalTitle}. Full: ${candidate.full}`,
        cue: {
          time: candidate.cue?.time || null,
          location: candidate.cue?.location || "",
          context: candidate.cue?.context || "",
        },
        durations: {
          full: parseInt(durationFull) || 30,
          reduced: parseInt(durationReduced) || 15,
          minimum: parseInt(durationMinimum) || 5,
        },
        ratings: {
          difficulty: parseInt(difficulty),
          timeRequired: Math.ceil((parseInt(durationFull) || 30) / 10),
          enjoyment: parseInt(enjoyment),
          impact: parseInt(impact),
          alignment: parseInt(alignment),
        },
      };

      await onSubmit(habitData, candidate.cadence);
    } catch (err) {
      console.error("Error:", err);
      alert("Failed to create habit");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: "0 auto", paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
        <button
          onClick={onCancel}
          style={{
            background: "transparent", border: "none",
            cursor: "pointer", fontSize: 14, color: D.muted,
            fontWeight: 700,
          }}
        >
          ← BACK
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: D.bk, margin: "0 0 0 8px", flex: 1 }}>
          Customize Habit
        </h2>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: D.bk }}>
          TITLE
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 8,
            border: `1px solid ${D.border}`, fontSize: 14, boxSizing: "border-box",
          }}
        />
      </div>

      <div style={{
        background: D.bg, border: `1px solid ${D.border}`,
        borderRadius: 12, padding: 16, marginBottom: 16,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: D.bk, textTransform: "uppercase" }}>
          DURATIONS (minutes)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 4, color: D.bk }}>Full</label>
            <input
              type="number"
              value={durationFull}
              onChange={(e) => setDurationFull(parseInt(e.target.value) || 0)}
              style={{ width: "100%", padding: "6px", borderRadius: 6, border: `1px solid ${D.border}`, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 4, color: D.bk }}>Reduced</label>
            <input
              type="number"
              value={durationReduced}
              onChange={(e) => setDurationReduced(parseInt(e.target.value) || 0)}
              style={{ width: "100%", padding: "6px", borderRadius: 6, border: `1px solid ${D.border}`, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 4, color: D.bk }}>Min</label>
            <input
              type="number"
              value={durationMinimum}
              onChange={(e) => setDurationMinimum(parseInt(e.target.value) || 0)}
              style={{ width: "100%", padding: "6px", borderRadius: 6, border: `1px solid ${D.border}`, boxSizing: "border-box" }}
            />
          </div>
        </div>
      </div>

      <div style={{
        background: D.bg, border: `1px solid ${D.border}`,
        borderRadius: 12, padding: 16, marginBottom: 16,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: D.bk, textTransform: "uppercase" }}>
          RATINGS (1–10)
        </div>
        {[
          ["Difficulty", difficulty, setDifficulty],
          ["Enjoyment", enjoyment, setEnjoyment],
          ["Impact", impact, setImpact],
          ["Alignment", alignment, setAlignment],
        ].map(([label, value, setter]) => (
          <div key={label} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12, color: D.bk }}>
              <span>{label}</span>
              <span style={{ fontWeight: 700 }}>{value}</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={value}
              onChange={(e) => setter(parseInt(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleSubmit}
          disabled={saving || !title.trim()}
          style={{
            flex: 1, padding: "12px", borderRadius: 8,
            background: saving || !title.trim() ? D.muted : D.yl,
            border: "none", cursor: saving || !title.trim() ? "not-allowed" : "pointer",
            fontSize: 12, fontWeight: 700, color: D.bk,
          }}
        >
          {saving ? "CREATING..." : "CREATE HABIT"}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: "12px 16px", borderRadius: 8,
            border: `1px solid ${D.border}`, background: "transparent",
            cursor: "pointer", fontSize: 12, color: D.muted,
          }}
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}
