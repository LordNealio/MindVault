import { useState } from "react";
import { createHabit } from "../../lib/habitService.js";
import { searchGoals } from "../../lib/atomizer-rules.js";
import { HabitFormScreen } from "./HabitFormScreen.jsx";

const D = {
  bg: "#F0EDE5", bk: "#0A0A0A", muted: "#9B9589",
  yl: "#E8B84B", border: "#E8E4DA", surf: "#FAFAF7",
  gr: "#3DD68C",
};

export function AtomizerFlow({ onHabitCreated, onCancel }) {
  const [step, setStep] = useState("input"); // input | candidates | editing
  const [goalText, setGoalText] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [expandedCard, setExpandedCard] = useState(null);

  const handleSearchGoals = () => {
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

    atoms.sort((a, b) => b.score - a.score);
    setCandidates(atoms.slice(0, 10));
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
          Enter a goal and we'll suggest habit templates tailored to your needs.
        </p>
        <textarea
          value={goalText}
          onChange={(e) => setGoalText(e.target.value)}
          placeholder="e.g. Get stronger, Read more, Exercise daily, Learn to code..."
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
            SEARCH TEMPLATES
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
  // STEP 2: CANDIDATES
  if (step === "candidates") {
    return (
      <div style={{ padding: 20, maxWidth: 600, margin: "0 auto", paddingBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
          <button
            onClick={() => setStep("input")}
            style={{
              background: "transparent", border: "none",
              cursor: "pointer", fontSize: 14, color: D.muted,
              fontWeight: 700,
            }}
          >
            ← BACK
          </button>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: D.bk, margin: "0 0 0 8px", flex: 1 }}>
            Habit Templates
          </h2>
          <span style={{ fontSize: 12, color: D.muted }}>
            {candidates.length} found
          </span>
        </div>

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
                    {atom.goalTitle}
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
                <div style={{ fontSize: 12, marginBottom: 8, color: D.bk }}>
                  <strong>Full:</strong> {atom.full}
                </div>
                <div style={{ fontSize: 12, marginBottom: 8, color: D.bk }}>
                  <strong>Reduced:</strong> {atom.reduced}
                </div>
                <div style={{ fontSize: 12, marginBottom: 12, color: D.bk }}>
                  <strong>Minimum:</strong> {atom.minimum}
                </div>

                <div style={{ fontSize: 11, color: D.muted, marginBottom: 12 }}>
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
  const [title, setTitle] = useState(candidate.title);
  const [durationFull, setDurationFull] = useState(candidate.ratings.timeRequired * 10);
  const [durationReduced, setDurationReduced] = useState(Math.ceil((candidate.ratings.timeRequired * 10) * 0.5));
  const [durationMinimum, setDurationMinimum] = useState(Math.ceil((candidate.ratings.timeRequired * 10) * 0.25));
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
