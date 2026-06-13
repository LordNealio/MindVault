import { useState, useEffect } from "react";
import { getLatestVersion } from "../../lib/habitService.js";

const D = {
  bg: "#F0EDE5", bk: "#0A0A0A", muted: "#9B9589",
  yl: "#E8B84B", border: "#E8E4DA", surf: "#FAFAF7",
};

export function CheckInModal({ occurrence, habitId, onSubmit, onCancel }) {
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [mood, setMood] = useState("good");
  const [version, setVersion] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVersion();
  }, [habitId]);

  const loadVersion = async () => {
    try {
      const v = await getLatestVersion(habitId);
      setVersion(v);
      if (v) {
        setDuration(v.durations.full.toString());
      }
    } catch (err) {
      console.error("Failed to load version:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleVariantSelect = (variant) => {
    setSelectedVariant(variant);
    if (version) {
      setDuration(version.durations[variant].toString());
    }
  };

  const handleSubmit = () => {
    if (!selectedVariant) {
      alert("Please select a variant");
      return;
    }
    onSubmit(selectedVariant, null, parseInt(duration) || 0, notes, mood);
  };

  if (loading) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.5)", display: "flex",
        alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          background: D.surf, borderRadius: 16, padding: 24,
          maxWidth: 400, width: "90%", textAlign: "center",
        }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.5)", display: "flex",
      alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        background: D.surf, borderRadius: 16, padding: 24,
        maxWidth: 400, width: "100%", maxHeight: "90vh", overflowY: "auto",
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: D.bk }}>
          Complete This Habit?
        </h2>
        <div style={{ fontSize: 14, color: D.muted, marginBottom: 20 }}>
          {version?.title}
        </div>

        {/* Variant Selection */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: D.muted,
            letterSpacing: ".08em", marginBottom: 12, textTransform: "uppercase",
          }}>
            Choose Variant
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {["full", "reduced", "minimum"].map(variant => (
              <button
                key={variant}
                onClick={() => handleVariantSelect(variant)}
                style={{
                  flex: 1, padding: "12px", borderRadius: 8,
                  background: selectedVariant === variant ? D.yl : D.bg,
                  border: `1px solid ${D.border}`,
                  cursor: "pointer", fontSize: 11, fontWeight: 700,
                  color: selectedVariant === variant ? D.bk : D.muted,
                }}
              >
                {variant.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Form Fields */}
        {selectedVariant && (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 6, color: D.bk }}>
                Duration (min)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: 6,
                  border: `1px solid ${D.border}`, fontSize: 14, boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 6, color: D.bk }}>
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="How did it go? Any obstacles?"
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: 6,
                  border: `1px solid ${D.border}`, fontSize: 13,
                  minHeight: 80, fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 6, color: D.bk }}>
                Mood
              </label>
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: 6,
                  border: `1px solid ${D.border}`, fontSize: 13,
                }}
              >
                <option value="great">Great 🌟</option>
                <option value="good">Good ✨</option>
                <option value="ok">OK 👍</option>
                <option value="tough">Tough 😤</option>
                <option value="struggled">Struggled 😩</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleSubmit}
                style={{
                  flex: 1, padding: "12px", borderRadius: 8,
                  background: D.yl, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 700, color: D.bk,
                }}
              >
                ✓ SAVE
              </button>
              <button
                onClick={onCancel}
                style={{
                  padding: "12px 16px", borderRadius: 8,
                  border: `1px solid ${D.border}`, background: "transparent",
                  cursor: "pointer", fontSize: 12, color: D.muted,
                }}
              >
                ← CANCEL
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
