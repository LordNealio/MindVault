import { useState, useEffect } from "react";
import { listHabits, getLatestVersion } from "../../lib/habitService.js";
import { HabitFormScreen } from "./HabitFormScreen.jsx";
import { TodayHabitsScreen } from "./TodayHabitsScreen.jsx";

const D = {
  bg: "#F0EDE5", bk: "#0A0A0A", muted: "#9B9589",
  yl: "#E8B84B", border: "#E8E4DA", gr: "#3DD68C", surf: "#FAFAF7",
};

export function HabitsListScreen() {
  const [view, setView] = useState("today"); // "today", "list", "create", "edit"
  const [habits, setHabits] = useState([]);
  const [versionMap, setVersionMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [editingHabitId, setEditingHabitId] = useState(null);

  useEffect(() => {
    if (view === "list" || view === "edit") {
      loadHabits();
    }
  }, [view]);

  const loadHabits = async () => {
    try {
      setLoading(true);
      const allHabits = await listHabits(false); // only active habits
      setHabits(allHabits);

      // Load latest versions for each habit
      const vMap = {};
      for (const habit of allHabits) {
        try {
          const version = await getLatestVersion(habit.id);
          vMap[habit.id] = version;
        } catch (err) {
          console.error(`Failed to load version for habit ${habit.id}:`, err);
        }
      }
      setVersionMap(vMap);
    } catch (err) {
      console.error("Failed to load habits:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingHabitId(null);
    setView("create");
  };

  const handleEditHabit = (habitId) => {
    setEditingHabitId(habitId);
    setView("edit");
  };

  const handleSaveHabit = async () => {
    await loadHabits();
    setView("list");
  };

  // ────────────────────────────────────────────────────────────
  // TODAY VIEW - shows pending habits
  if (view === "today") {
    return (
      <div>
        <TodayHabitsScreen />
        <div style={{
          position: "fixed", bottom: 80, right: 20, left: 20,
          display: "flex", gap: 8, maxWidth: "calc(480px - 40px)",
          margin: "0 auto",
        }}>
          <button
            onClick={() => setView("list")}
            style={{
              flex: 1, padding: "12px", borderRadius: 8,
              background: D.surf, border: `1px solid ${D.border}`,
              cursor: "pointer", fontSize: 11, fontWeight: 700,
              color: D.bk,
            }}
          >
            VIEW ALL
          </button>
          <button
            onClick={handleCreateNew}
            style={{
              flex: 1, padding: "12px", borderRadius: 8,
              background: D.yl, border: "none",
              cursor: "pointer", fontSize: 11, fontWeight: 700,
              color: D.bk,
            }}
          >
            + NEW HABIT
          </button>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // LIST VIEW - shows all habits
  if (view === "list") {
    return (
      <div style={{ padding: 20, maxWidth: 600, margin: "0 auto", paddingBottom: 100 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: D.bk, margin: 0 }}>All Habits</h2>
          <button
            onClick={handleCreateNew}
            style={{
              padding: "8px 12px", borderRadius: 8,
              background: D.yl, border: "none",
              cursor: "pointer", fontSize: 11, fontWeight: 700,
              color: D.bk,
            }}
          >
            + NEW
          </button>
        </div>

        {loading ? (
          <div style={{ color: D.muted, textAlign: "center", padding: 40 }}>
            Loading habits...
          </div>
        ) : habits.length === 0 ? (
          <div style={{
            textAlign: "center", padding: 40, color: D.muted,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🌱</div>
            <div style={{ fontSize: 14, marginBottom: 8 }}>No habits yet</div>
            <div style={{ fontSize: 12, marginBottom: 16 }}>
              Create your first habit to get started
            </div>
            <button
              onClick={handleCreateNew}
              style={{
                padding: "10px 16px", borderRadius: 8,
                background: D.yl, border: "none",
                cursor: "pointer", fontSize: 12, fontWeight: 700,
                color: D.bk,
              }}
            >
              CREATE HABIT
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {habits.map(habit => {
              const version = versionMap[habit.id];
              return (
                <div
                  key={habit.id}
                  onClick={() => handleEditHabit(habit.id)}
                  style={{
                    border: `1px solid ${D.border}`, borderRadius: 12,
                    padding: 16, background: D.surf, cursor: "pointer",
                    transition: "all .15s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = D.yl}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = D.border}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: D.bk, margin: 0, marginBottom: 4 }}>
                        {habit.title}
                      </h3>
                      <div style={{ fontSize: 12, color: D.muted, marginBottom: 8 }}>
                        {habit.category} • {version?.rrule.split(";")[0] || "Custom"}
                      </div>
                      {version?.cue?.context && (
                        <div style={{ fontSize: 11, color: D.muted }}>
                          {version.cue.context || version.cue.location}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditHabit(habit.id);
                      }}
                      style={{
                        padding: "6px 10px", borderRadius: 6,
                        background: "transparent", border: `1px solid ${D.border}`,
                        cursor: "pointer", fontSize: 11, color: D.muted,
                      }}
                    >
                      EDIT
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // CREATE/EDIT VIEW - form screen
  if (view === "create" || view === "edit") {
    return (
      <HabitFormScreen
        habitId={view === "edit" ? editingHabitId : null}
        onSave={handleSaveHabit}
        onCancel={() => setView("list")}
      />
    );
  }

  return null;
}
