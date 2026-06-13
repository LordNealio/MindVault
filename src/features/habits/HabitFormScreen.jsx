import { useState, useEffect } from "react";
import { createHabit, editHabitAndCreateVersion, getHabit, getLatestVersion } from "../../lib/habitService.js";

const D = {
  bg: "#F0EDE5", bk: "#0A0A0A", muted: "#9B9589",
  yl: "#E8B84B", border: "#E8E4DA", surf: "#FAFAF7", rd: "#C1121F",
};

const CATEGORIES = ["wellness", "learning", "productivity", "creativity", "relationships", "health", "finance"];

const RRULE_PRESETS = {
  daily: "FREQ=DAILY",
  "3x-week": "FREQ=WEEKLY;BYDAY=MO,WE,FR",
  weekly: "FREQ=WEEKLY;BYDAY=MO",
  "2x-week": "FREQ=WEEKLY;BYDAY=MO,FR",
  biweekly: "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO",
  monthly: "FREQ=MONTHLY;BYMONTHDAY=1",
};

export function HabitFormScreen({ habitId, onSave, onCancel }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("wellness");
  const [description, setDescription] = useState("");
  const [rrulePreset, setRrulePreset] = useState("daily");
  const [customRrule, setCustomRrule] = useState("");
  const [cueTime, setCueTime] = useState("");
  const [cueLocation, setCueLocation] = useState("");
  const [cueContext, setCueContext] = useState("");
  const [durationFull, setDurationFull] = useState(30);
  const [durationReduced, setDurationReduced] = useState(15);
  const [durationMinimum, setDurationMinimum] = useState(5);
  const [difficulty, setDifficulty] = useState(5);
  const [time, setTime] = useState(5);
  const [enjoyment, setEnjoyment] = useState(5);
  const [impact, setImpact] = useState(5);
  const [alignment, setAlignment] = useState(5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(habitId ? true : false);

  useEffect(() => {
    if (habitId) {
      loadHabitForEdit();
    }
  }, [habitId]);

  const loadHabitForEdit = async () => {
    try {
      const habit = await getHabit(habitId);
      const version = await getLatestVersion(habitId);

      setTitle(habit.title);
      setCategory(habit.category);
      setDescription(habit.description || "");

      // Set RRULE based on preset or custom
      const rrule = version.rrule;
      const preset = Object.entries(RRULE_PRESETS).find(([, val]) => val === rrule)?.[0];
      if (preset) {
        setRrulePreset(preset);
      } else {
        setRrulePreset("custom");
        setCustomRrule(rrule);
      }

      setCueTime(version.cue?.time || "");
      setCueLocation(version.cue?.location || "");
      setCueContext(version.cue?.context || "");
      setDurationFull(version.durations.full);
      setDurationReduced(version.durations.reduced);
      setDurationMinimum(version.durations.minimum);
      setDifficulty(version.ratings.difficulty);
      setTime(version.ratings.timeRequired);
      setEnjoyment(version.ratings.enjoyment);
      setImpact(version.ratings.impact);
      setAlignment(version.ratings.alignment);
    } catch (err) {
      console.error("Failed to load habit:", err);
      setError("Failed to load habit for editing");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    const rrule = rrulePreset === "custom" ? customRrule : RRULE_PRESETS[rrulePreset];
    if (!rrule) {
      setError("Please select a recurrence pattern");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const habitData = {
        title: title.trim(),
        category,
        description,
        measurementType: "boolean",
        cue: {
          time: cueTime || null,
          location: cueLocation,
          context: cueContext,
        },
        durations: {
          full: parseInt(durationFull) || 30,
          reduced: parseInt(durationReduced) || 15,
          minimum: parseInt(durationMinimum) || 5,
        },
        ratings: {
          difficulty: parseInt(difficulty) || 5,
          timeRequired: parseInt(time) || 5,
          enjoyment: parseInt(enjoyment) || 5,
          impact: parseInt(impact) || 5,
          alignment: parseInt(alignment) || 5,
        },
      };

      if (habitId) {
        // Edit mode: create new version
        await editHabitAndCreateVersion(habitId, habitData, rrule, "User edit");
      } else {
        // Create mode
        await createHabit(habitData, rrule);
      }

      onSave();
    } catch (err) {
      setError(err.message || "Failed to save habit");
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 20, color: D.muted, textAlign: "center" }}>
        Loading habit...
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: "0 auto", paddingBottom: 40 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: D.bk }}>
        {habitId ? "Edit Habit" : "Create New Habit"}
      </h2>

      {error && (
        <div style={{
          background: "#ffe6e6", color: D.rd, padding: 12,
          borderRadius: 8, marginBottom: 16, fontSize: 12,
        }}>
          {error}
        </div>
      )}

      {/* Title */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: D.bk }}>
          HABIT TITLE
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Morning Meditation"
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 8,
            border: `1px solid ${D.border}`, fontSize: 14, boxSizing: "border-box",
          }}
        />
      </div>

      {/* Category & Description */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: D.bk }}>
            CATEGORY
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 8,
              border: `1px solid ${D.border}`, fontSize: 14, boxSizing: "border-box",
            }}
          >
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: D.bk }}>
          DESCRIPTION (Optional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Why is this habit important?"
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 8,
            border: `1px solid ${D.border}`, fontSize: 13, minHeight: 60,
            fontFamily: "inherit", boxSizing: "border-box",
          }}
        />
      </div>

      {/* RRULE Preset */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: D.bk }}>
          RECURRENCE PATTERN
        </label>
        <select
          value={rrulePreset}
          onChange={(e) => setRrulePreset(e.target.value)}
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 8,
            border: `1px solid ${D.border}`, fontSize: 14, boxSizing: "border-box",
          }}
        >
          <option value="daily">Daily</option>
          <option value="3x-week">3x per week (Mon/Wed/Fri)</option>
          <option value="2x-week">2x per week (Mon/Fri)</option>
          <option value="weekly">Weekly (Monday)</option>
          <option value="biweekly">Biweekly (Monday)</option>
          <option value="monthly">Monthly (1st)</option>
          <option value="custom">Custom RRULE</option>
        </select>
      </div>

      {rrulePreset === "custom" && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: D.bk }}>
            CUSTOM RRULE
          </label>
          <input
            type="text"
            value={customRrule}
            onChange={(e) => setCustomRrule(e.target.value)}
            placeholder="e.g. FREQ=WEEKLY;BYDAY=TU,TH"
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 8,
              border: `1px solid ${D.border}`, fontSize: 12, boxSizing: "border-box",
            }}
          />
          <div style={{ fontSize: 11, color: D.muted, marginTop: 6 }}>
            RFC 5545 format. Example: FREQ=WEEKLY;BYDAY=MO,WE,FR
          </div>
        </div>
      )}

      {/* CUE */}
      <div style={{
        background: D.bg, border: `1px solid ${D.border}`,
        borderRadius: 12, padding: 16, marginBottom: 16,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: D.bk }}>
          CUE (When & Where)
        </div>
        <input
          type="time"
          value={cueTime}
          onChange={(e) => setCueTime(e.target.value)}
          style={{
            width: "100%", padding: "8px", marginBottom: 8, borderRadius: 6,
            border: `1px solid ${D.border}`, boxSizing: "border-box",
          }}
        />
        <input
          type="text"
          value={cueLocation}
          onChange={(e) => setCueLocation(e.target.value)}
          placeholder="Location (e.g. Home, Gym)"
          style={{
            width: "100%", padding: "8px", marginBottom: 8, borderRadius: 6,
            border: `1px solid ${D.border}`, boxSizing: "border-box", fontSize: 13,
          }}
        />
        <input
          type="text"
          value={cueContext}
          onChange={(e) => setCueContext(e.target.value)}
          placeholder="Context (e.g. After coffee, Before bed)"
          style={{
            width: "100%", padding: "8px", borderRadius: 6,
            border: `1px solid ${D.border}`, boxSizing: "border-box", fontSize: 13,
          }}
        />
      </div>

      {/* DURATIONS */}
      <div style={{
        background: D.bg, border: `1px solid ${D.border}`,
        borderRadius: 12, padding: 16, marginBottom: 16,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: D.bk }}>
          DURATIONS (minutes)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 4, color: D.bk }}>Full</label>
            <input
              type="number"
              value={durationFull}
              onChange={(e) => setDurationFull(parseInt(e.target.value) || 0)}
              style={{
                width: "100%", padding: "6px", borderRadius: 6,
                border: `1px solid ${D.border}`, boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 4, color: D.bk }}>Reduced</label>
            <input
              type="number"
              value={durationReduced}
              onChange={(e) => setDurationReduced(parseInt(e.target.value) || 0)}
              style={{
                width: "100%", padding: "6px", borderRadius: 6,
                border: `1px solid ${D.border}`, boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 4, color: D.bk }}>Min</label>
            <input
              type="number"
              value={durationMinimum}
              onChange={(e) => setDurationMinimum(parseInt(e.target.value) || 0)}
              style={{
                width: "100%", padding: "6px", borderRadius: 6,
                border: `1px solid ${D.border}`, boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      </div>

      {/* RATINGS */}
      <div style={{
        background: D.bg, border: `1px solid ${D.border}`,
        borderRadius: 12, padding: 16, marginBottom: 16,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: D.bk }}>
          RATINGS (1–10)
        </div>
        {[
          ["Difficulty", difficulty, setDifficulty],
          ["Time Required", time, setTime],
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

      {/* ACTIONS */}
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
          {saving ? "SAVING..." : habitId ? "UPDATE HABIT" : "CREATE HABIT"}
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
