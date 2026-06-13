import { useState, useEffect } from "react";
import { getOccurrencesForDate, completeOccurrence, skipOccurrence, getHabit, getLatestVersion } from "../../lib/habitService.js";
import { CheckInModal } from "./CheckInModal.jsx";

const D = {
  bg: "#F0EDE5", bk: "#0A0A0A", muted: "#9B9589",
  yl: "#E8B84B", border: "#E8E4DA", gr: "#3DD68C", surf: "#FAFAF7",
};

export function TodayHabitsScreen() {
  const [occurrences, setOccurrences] = useState([]);
  const [habitMap, setHabitMap] = useState({});
  const [versionMap, setVersionMap] = useState({});
  const [selectedOccurrence, setSelectedOccurrence] = useState(null);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTodayOccurrences();
  }, []);

  const loadTodayOccurrences = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const occs = await getOccurrencesForDate(today);
      setOccurrences(occs);

      // Pre-load habit and version metadata
      const hMap = {};
      const vMap = {};
      for (const occ of occs) {
        if (!hMap[occ.habitId]) {
          const habit = await getHabit(occ.habitId);
          hMap[occ.habitId] = habit;

          const version = await getLatestVersion(occ.habitId);
          vMap[occ.habitId] = version;
        }
      }
      setHabitMap(hMap);
      setVersionMap(vMap);
    } catch (err) {
      console.error("Failed to load today's habits:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteClick = (occ) => {
    setSelectedOccurrence(occ);
    setShowCheckInModal(true);
  };

  const handleCheckInSubmit = async (variant, actualValue, actualDurationMin, notes, mood) => {
    try {
      await completeOccurrence(
        selectedOccurrence.id,
        variant,
        actualValue,
        actualDurationMin,
        notes,
        mood
      );
      setShowCheckInModal(false);
      setSelectedOccurrence(null);
      await loadTodayOccurrences();
    } catch (err) {
      console.error("Failed to complete occurrence:", err);
    }
  };

  const handleSkip = async (occurrenceId) => {
    try {
      await skipOccurrence(occurrenceId);
      await loadTodayOccurrences();
    } catch (err) {
      console.error("Failed to skip occurrence:", err);
    }
  };

  const pending = occurrences.filter(o => o.status === "pending");
  const completed = occurrences.filter(o => o.status === "completed");

  if (loading) {
    return (
      <div style={{ padding: 20, color: D.muted, textAlign: "center" }}>
        Loading habits...
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: "0 auto", paddingBottom: 40 }}>
      {pending.length === 0 && completed.length === 0 ? (
        <div style={{
          textAlign: "center", padding: 40, color: D.muted,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌱</div>
          <div style={{ fontSize: 14, marginBottom: 8 }}>No habits scheduled for today</div>
          <div style={{ fontSize: 12 }}>Create your first habit or adjust your schedule</div>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{
                fontSize: 12, fontWeight: 700, color: D.muted,
                letterSpacing: ".08em", marginBottom: 12, textTransform: "uppercase",
              }}>
                Pending ({pending.length})
              </div>
              {pending.map(occ => {
                const habit = habitMap[occ.habitId];
                const version = versionMap[occ.habitId];
                if (!habit || !version) return null;
                return (
                  <div
                    key={occ.id}
                    style={{
                      border: `1px solid ${D.border}`, borderRadius: 12,
                      padding: 16, marginBottom: 12, background: D.surf,
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                      {habit.title}
                    </div>
                    <div style={{ fontSize: 12, color: D.muted, marginBottom: 12 }}>
                      {version.cue?.time && `${version.cue.time} • `}
                      {version.cue?.context || version.cue?.location || "Flexible"}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => handleCompleteClick(occ)}
                        style={{
                          flex: 1, padding: "10px 12px", borderRadius: 8,
                          background: D.yl, border: "none", cursor: "pointer",
                          fontSize: 11, fontWeight: 700, color: D.bk,
                        }}
                      >
                        COMPLETE
                      </button>
                      <button
                        onClick={() => handleSkip(occ.id)}
                        style={{
                          padding: "10px 12px", borderRadius: 8,
                          border: `1px solid ${D.border}`, background: "transparent",
                          cursor: "pointer", fontSize: 11, color: D.muted,
                        }}
                      >
                        SKIP
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <div style={{
                fontSize: 12, fontWeight: 700, color: D.muted,
                letterSpacing: ".08em", marginBottom: 12, textTransform: "uppercase",
              }}>
                Completed Today ({completed.length})
              </div>
              {completed.map(occ => {
                const habit = habitMap[occ.habitId];
                return (
                  <div
                    key={occ.id}
                    style={{
                      padding: "8px 12px", borderRadius: 8,
                      background: D.gr + "15", marginBottom: 8,
                      fontSize: 12, color: D.bk,
                    }}
                  >
                    ✓ {habit?.title} ({occ.variant})
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {showCheckInModal && selectedOccurrence && (
        <CheckInModal
          occurrence={selectedOccurrence}
          habitId={selectedOccurrence.habitId}
          onSubmit={handleCheckInSubmit}
          onCancel={() => setShowCheckInModal(false)}
        />
      )}
    </div>
  );
}
