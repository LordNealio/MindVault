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
  const [step, setStep] = useState(1);
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

  const STEPS = [
    { num: 1, label: "Basics", icon: "📋" },
    { num: 2, label: "Schedule", icon: "📅" },
    { num: 3, label: "Duration", icon: "⏱️" },
    { num: 4, label: "Trigger", icon: "🔔" },
    { num: 5, label: "Impact", icon: "⭐" },
  ];

  const canProceed = () => {
    if (step === 1) return title.trim().length > 0;
    if (step === 2) return rrulePreset !== "custom" || customRrule.trim().length > 0;
    return true;
  };

  const renderStepContent = () => {
    switch (step) {
      case 1: // Basics
        return (
          <div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 8, color: D.bk }}>
                HABIT NAME
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Morning Meditation"
                autoFocus
                style={{
                  width: "100%", padding: "12px", borderRadius: 8,
                  border: `1px solid ${D.border}`, fontSize: 14, boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 8, color: D.bk }}>
                CATEGORY
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: "100%", padding: "12px", borderRadius: 8,
                  border: `1px solid ${D.border}`, fontSize: 14, boxSizing: "border-box",
                }}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 8, color: D.bk }}>
                WHY? (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Why is this habit important to you?"
                style={{
                  width: "100%", padding: "12px", borderRadius: 8,
                  border: `1px solid ${D.border}`, fontSize: 13, minHeight: 80,
                  fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
            </div>
          </div>
        );

      case 2: // Schedule
        return (
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 12, color: D.bk }}>
              HOW OFTEN?
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
              {Object.entries(RRULE_PRESETS).map(([key, _]) => (
                <button
                  key={key}
                  onClick={() => setRrulePreset(key)}
                  style={{
                    padding: "12px", borderRadius: 8,
                    background: rrulePreset === key ? D.yl : D.surf,
                    border: `1px solid ${rrulePreset === key ? D.yl : D.border}`,
                    cursor: "pointer", fontSize: 13, fontWeight: 600, color: D.bk,
                  }}
                >
                  {key === "daily" && "Daily"}
                  {key === "3x-week" && "3x per week"}
                  {key === "2x-week" && "2x per week"}
                  {key === "weekly" && "Weekly"}
                  {key === "biweekly" && "Every 2 weeks"}
                  {key === "monthly" && "Monthly"}
                  {key === "custom" && "Custom"}
                </button>
              ))}
            </div>

            {rrulePreset === "custom" && (
              <div style={{ marginTop: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 8, color: D.bk }}>
                  CUSTOM PATTERN (RFC 5545)
                </label>
                <input
                  type="text"
                  value={customRrule}
                  onChange={(e) => setCustomRrule(e.target.value)}
                  placeholder="e.g. FREQ=WEEKLY;BYDAY=MO,WE,FR"
                  style={{
                    width: "100%", padding: "12px", borderRadius: 8,
                    border: `1px solid ${D.border}`, fontSize: 12, boxSizing: "border-box",
                  }}
                />
              </div>
            )}
          </div>
        );

      case 3: // Duration
        return (
          <div>
            <div style={{ fontSize: 12, color: D.muted, marginBottom: 16 }}>
              How long do you plan to spend on this habit?
            </div>
            {[
              { label: "Full Version", val: durationFull, set: setDurationFull },
              { label: "Reduced (when short on time)", val: durationReduced, set: setDurationReduced },
              { label: "Minimum (absolute bare minimum)", val: durationMinimum, set: setDurationMinimum },
            ].map(({ label, val, set }) => (
              <div key={label} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12, color: D.bk }}>
                  <span style={{ fontWeight: 600 }}>{label}</span>
                  <span>{val} min</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="180"
                  value={val}
                  onChange={(e) => set(parseInt(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
            ))}
          </div>
        );

      case 4: // Cue
        return (
          <div>
            <div style={{ fontSize: 12, color: D.muted, marginBottom: 16 }}>
              When & where will you do this habit?
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 8, color: D.bk }}>
                TIME (Optional)
              </label>
              <input
                type="time"
                value={cueTime}
                onChange={(e) => setCueTime(e.target.value)}
                style={{
                  width: "100%", padding: "12px", borderRadius: 8,
                  border: `1px solid ${D.border}`, boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 8, color: D.bk }}>
                LOCATION (Optional)
              </label>
              <input
                type="text"
                value={cueLocation}
                onChange={(e) => setCueLocation(e.target.value)}
                placeholder="e.g. Home, Gym, Office"
                style={{
                  width: "100%", padding: "12px", borderRadius: 8,
                  border: `1px solid ${D.border}`, boxSizing: "border-box", fontSize: 13,
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 8, color: D.bk }}>
                CONTEXT (Optional)
              </label>
              <input
                type="text"
                value={cueContext}
                onChange={(e) => setCueContext(e.target.value)}
                placeholder="e.g. After coffee, Before bed"
                style={{
                  width: "100%", padding: "12px", borderRadius: 8,
                  border: `1px solid ${D.border}`, boxSizing: "border-box", fontSize: 13,
                }}
              />
            </div>
          </div>
        );

      case 5: // Ratings
        return (
          <div>
            <div style={{ fontSize: 12, color: D.muted, marginBottom: 16 }}>
              Rate how you feel about this habit (1 = low, 10 = high)
            </div>
            {[
              ["Difficulty", difficulty, setDifficulty],
              ["Time Required", time, setTime],
              ["Enjoyment", enjoyment, setEnjoyment],
              ["Impact", impact, setImpact],
              ["Alignment with Goals", alignment, setAlignment],
            ].map(([label, value, setter]) => (
              <div key={label} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12, color: D.bk }}>
                  <span style={{ fontWeight: 600 }}>{label}</span>
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
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 500, margin: "0 auto", paddingBottom: 40 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: D.bk }}>
        {habitId ? "Edit Habit" : "Create New Habit"}
      </h2>
      <div style={{ fontSize: 12, color: D.muted, marginBottom: 20 }}>
        Step {step} of {STEPS.length}
      </div>

      {error && (
        <div style={{
          background: "#ffe6e6", color: D.rd, padding: 12,
          borderRadius: 8, marginBottom: 16, fontSize: 12,
        }}>
          {error}
        </div>
      )}

      {/* Progress bar */}
      <div style={{ marginBottom: 20, display: "flex", gap: 4 }}>
        {STEPS.map(s => (
          <div
            key={s.num}
            style={{
              flex: 1, height: 4, borderRadius: 2,
              background: s.num <= step ? D.yl : D.border,
            }}
          />
        ))}
      </div>

      {/* Step content */}
      <div style={{ minHeight: 200, marginBottom: 20 }}>
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", gap: 8 }}>
        {step > 1 && (
          <button
            onClick={() => setStep(step - 1)}
            style={{
              padding: "12px 16px", borderRadius: 8,
              border: `1px solid ${D.border}`, background: "transparent",
              cursor: "pointer", fontSize: 12, fontWeight: 600, color: D.bk,
            }}
          >
            ← BACK
          </button>
        )}
        {step < 5 && (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            style={{
              flex: 1, padding: "12px", borderRadius: 8,
              background: canProceed() ? D.yl : D.muted,
              border: "none", cursor: canProceed() ? "pointer" : "not-allowed",
              fontSize: 12, fontWeight: 700, color: D.bk,
            }}
          >
            NEXT →
          </button>
        )}
        {step === 5 && (
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
            {saving ? "SAVING..." : habitId ? "UPDATE" : "CREATE"}
          </button>
        )}
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
