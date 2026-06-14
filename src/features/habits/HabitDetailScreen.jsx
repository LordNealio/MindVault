import { useState, useEffect } from "react";
import {
  getHabit, getHabitVersions, getOccurrencesByHabit,
  getHabitNotes, getSOPsByHabit, archiveHabit,
  createHabitNote, createSOP, updateSOP,
} from "../../lib/habitService.js";
import { HabitFormScreen } from "./HabitFormScreen.jsx";

const D = {
  bg: "#F0EDE5", bk: "#0A0A0A", muted: "#9B9589",
  yl: "#E8B84B", border: "#E8E4DA", surf: "#FAFAF7",
  gr: "#3DD68C", rd: "#C1121F",
};

export function HabitDetailScreen({ habitId, onClose, onUpdate }) {
  const [habit, setHabit] = useState(null);
  const [versions, setVersions] = useState([]);
  const [tab, setTab] = useState("overview");
  const [occurrences, setOccurrences] = useState([]);
  const [notes, setNotes] = useState([]);
  const [sops, setSOPs] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHabitDetails();
  }, [habitId]);

  const loadHabitDetails = async () => {
    try {
      setLoading(true);
      const h = await getHabit(habitId);
      setHabit(h);

      const v = await getHabitVersions(habitId);
      setVersions(v);

      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const occs = await getOccurrencesByHabit(habitId, ninetyDaysAgo, new Date());
      setOccurrences(occs.sort((a, b) => new Date(b.dueAt) - new Date(a.dueAt)));

      const n = await getHabitNotes(habitId);
      setNotes(n);

      const s = await getSOPsByHabit(habitId);
      setSOPs(s);
    } catch (err) {
      console.error("Failed to load habit details:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!window.confirm("Archive this habit? It will be hidden from your list.")) return;
    try {
      await archiveHabit(habitId);
      onUpdate?.();
      onClose();
    } catch (err) {
      console.error("Failed to archive habit:", err);
      alert("Failed to archive habit");
    }
  };

  const handleSaveEdit = async () => {
    await loadHabitDetails();
    setIsEditing(false);
    onUpdate?.();
  };

  if (isEditing) {
    return (
      <HabitFormScreen
        habitId={habitId}
        onSave={handleSaveEdit}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  if (loading || !habit) {
    return (
      <div style={{ padding: 20, color: D.muted, textAlign: "center" }}>
        Loading habit...
      </div>
    );
  }

  const latestVersion = versions[versions.length - 1];

  return (
    <div style={{ padding: 20, maxWidth: 700, margin: "0 auto", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, marginBottom: 4, color: D.bk }}>
            {habit.title}
          </h1>
          <div style={{ fontSize: 12, color: D.muted }}>
            {habit.category} • Version {latestVersion?.versionNo || 1}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "transparent", border: "none",
            fontSize: 18, cursor: "pointer", color: D.muted,
          }}
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, borderBottom: `1px solid ${D.border}`, overflowX: "auto" }}>
        {["overview", "timeline", "notes", "sops", "versions"].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 12px", borderRadius: "0 0 6px 6px",
              background: tab === t ? D.yl : "transparent",
              border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              color: tab === t ? D.bk : D.muted,
              whiteSpace: "nowrap",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "overview" && latestVersion && (
        <OverviewTab habit={habit} version={latestVersion} onEdit={() => setIsEditing(true)} onArchive={handleArchive} />
      )}
      {tab === "timeline" && <TimelineTab occurrences={occurrences} />}
      {tab === "notes" && <NotesTab habitId={habitId} notes={notes} onNoteAdded={loadHabitDetails} />}
      {tab === "sops" && <SOPsTab habitId={habitId} sops={sops} onSOPAdded={loadHabitDetails} />}
      {tab === "versions" && <VersionsTab versions={versions} />}
    </div>
  );
}

function OverviewTab({ habit, version, onEdit, onArchive }) {
  const renderRating = (label, value) => (
    <div key={label} style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, display: "flex", justifyContent: "space-between", marginBottom: 4, color: D.bk }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700 }}>{value}/10</span>
      </div>
      <div style={{ background: D.border, height: 6, borderRadius: 3 }}>
        <div style={{ background: D.yl, height: "100%", width: `${(value / 10) * 100}%` }} />
      </div>
    </div>
  );

  return (
    <div>
      {habit.description && (
        <div style={{
          background: D.surf, border: `1px solid ${D.border}`,
          borderRadius: 12, padding: 16, marginBottom: 20,
        }}>
          <div style={{ fontSize: 12, color: D.muted, lineHeight: 1.6 }}>
            {habit.description}
          </div>
        </div>
      )}

      <div style={{
        background: "#fff9e6", border: `1px solid ${D.yl}`, borderRadius: 12,
        padding: 16, marginBottom: 20,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: D.bk, textTransform: "uppercase" }}>
          Ratings
        </div>
        {renderRating("Difficulty", version.ratings.difficulty)}
        {renderRating("Time Required", version.ratings.timeRequired)}
        {renderRating("Enjoyment", version.ratings.enjoyment)}
        {renderRating("Impact", version.ratings.impact)}
        {renderRating("Alignment", version.ratings.alignment)}
      </div>

      <div style={{
        background: D.bg, border: `1px solid ${D.border}`, borderRadius: 12,
        padding: 16, marginBottom: 20,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: D.bk, textTransform: "uppercase" }}>
          Details
        </div>
        <div style={{ fontSize: 13, marginBottom: 8, color: D.bk }}>
          <strong>Frequency:</strong> {version.rrule}
        </div>
        <div style={{ fontSize: 13, marginBottom: 8, color: D.bk }}>
          <strong>Cue:</strong> {version.cue?.time || "Flexible"} • {version.cue?.context || version.cue?.location || "Anytime"}
        </div>
        <div style={{ fontSize: 13, color: D.bk }}>
          <strong>Duration:</strong> {version.durations.full}m (full), {version.durations.reduced}m (reduced), {version.durations.minimum}m (min)
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onEdit}
          style={{
            flex: 1, padding: "12px", borderRadius: 8,
            background: D.yl, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 700, color: D.bk,
          }}
        >
          EDIT HABIT
        </button>
        <button
          onClick={onArchive}
          style={{
            padding: "12px 16px", borderRadius: 8,
            border: `1px solid ${D.rd}`, background: "transparent",
            cursor: "pointer", fontSize: 12, color: D.rd,
          }}
        >
          ARCHIVE
        </button>
      </div>
    </div>
  );
}

function TimelineTab({ occurrences }) {
  if (occurrences.length === 0) {
    return <div style={{ color: D.muted, textAlign: "center", padding: 40 }}>No activity yet</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {occurrences.map(occ => (
        <div
          key={occ.id}
          style={{
            border: `1px solid ${D.border}`, borderRadius: 8, padding: 12,
            background: occ.status === "completed" ? D.gr + "15" : occ.status === "skipped" ? "#f5f5f5" : D.surf,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: D.bk }}>
            {new Date(occ.dueAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </div>
          <div style={{ fontSize: 13, color: D.bk, marginBottom: 4 }}>
            {occ.status === "completed" ? `✓ Completed (${occ.variant})` : occ.status === "skipped" ? "- Skipped" : "○ Pending"}
          </div>
          {occ.notes && <div style={{ fontSize: 12, color: D.muted, marginTop: 6 }}>{occ.notes}</div>}
          {occ.mood && <div style={{ fontSize: 11, color: D.muted, marginTop: 4 }}>Mood: {occ.mood}</div>}
        </div>
      ))}
    </div>
  );
}

function NotesTab({ habitId, notes, onNoteAdded }) {
  const [showForm, setShowForm] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [noteType, setNoteType] = useState("reflection");
  const [saving, setSaving] = useState(false);

  const handleAddNote = async () => {
    if (!noteBody.trim()) return;
    try {
      setSaving(true);
      await createHabitNote(habitId, null, noteType, noteBody, null, [], true);
      setNoteBody("");
      setNoteType("reflection");
      setShowForm(false);
      onNoteAdded();
    } catch (err) {
      console.error("Failed to add note:", err);
      alert("Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  if (notes.length === 0 && !showForm) {
    return (
      <div style={{ color: D.muted, textAlign: "center", padding: 40 }}>
        <div style={{ marginBottom: 16 }}>No notes yet</div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            padding: "10px 16px", borderRadius: 8,
            background: D.yl, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 700, color: D.bk,
          }}
        >
          ADD NOTE
        </button>
      </div>
    );
  }

  return (
    <div>
      {showForm && (
        <div style={{
          border: `1px solid ${D.border}`, borderRadius: 12, padding: 16,
          background: D.surf, marginBottom: 16,
        }}>
          <select
            value={noteType}
            onChange={(e) => setNoteType(e.target.value)}
            style={{
              width: "100%", padding: "8px", marginBottom: 8, borderRadius: 6,
              border: `1px solid ${D.border}`, fontSize: 12,
            }}
          >
            <option value="reflection">Reflection</option>
            <option value="lesson_learned">Lesson Learned</option>
            <option value="optimization">Optimization Idea</option>
            <option value="success_log">Success Log</option>
            <option value="friction_log">Friction Log</option>
          </select>
          <textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Write your note..."
            style={{
              width: "100%", padding: "8px", borderRadius: 6,
              border: `1px solid ${D.border}`, minHeight: 80,
              fontFamily: "inherit", boxSizing: "border-box",
              marginBottom: 8, fontSize: 12,
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleAddNote}
              disabled={!noteBody.trim() || saving}
              style={{
                flex: 1, padding: "10px", borderRadius: 6,
                background: D.yl, border: "none", cursor: "pointer",
                fontSize: 11, fontWeight: 700, color: D.bk,
              }}
            >
              {saving ? "SAVING..." : "SAVE"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              style={{
                flex: 1, padding: "10px", borderRadius: 6,
                border: `1px solid ${D.border}`, background: "transparent",
                cursor: "pointer", fontSize: 11, color: D.muted,
              }}
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          style={{
            width: "100%", padding: "10px", marginBottom: 16, borderRadius: 8,
            background: D.yl, border: "none", cursor: "pointer",
            fontSize: 11, fontWeight: 700, color: D.bk,
          }}
        >
          + ADD NOTE
        </button>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {notes.map(note => (
          <div
            key={note.id}
            style={{
              border: `1px solid ${D.border}`, borderRadius: 8, padding: 12, background: D.bg,
            }}
          >
            <div style={{ fontSize: 11, color: D.muted, fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>
              {note.noteType.replace(/_/g, " ")} • {new Date(note.createdAt).toLocaleDateString()}
            </div>
            <div style={{ fontSize: 13, color: D.bk, lineHeight: 1.5 }}>{note.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SOPsTab({ habitId, sops, onSOPAdded }) {
  const [showForm, setShowForm] = useState(false);
  const [sopTitle, setSOPTitle] = useState("");
  const [sopBody, setSOPBody] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAddSOP = async () => {
    if (!sopTitle.trim() || !sopBody.trim()) return;
    try {
      setSaving(true);
      await createSOP(habitId, sopTitle, sopBody, []);
      setSOPTitle("");
      setSOPBody("");
      setShowForm(false);
      onSOPAdded();
    } catch (err) {
      console.error("Failed to add SOP:", err);
      alert("Failed to save SOP");
    } finally {
      setSaving(false);
    }
  };

  if (sops.length === 0 && !showForm) {
    return (
      <div style={{ color: D.muted, textAlign: "center", padding: 40 }}>
        <div style={{ marginBottom: 16 }}>No SOPs yet</div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            padding: "10px 16px", borderRadius: 8,
            background: D.yl, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 700, color: D.bk,
          }}
        >
          CREATE SOP
        </button>
      </div>
    );
  }

  return (
    <div>
      {showForm && (
        <div style={{
          border: `1px solid ${D.border}`, borderRadius: 12, padding: 16,
          background: D.surf, marginBottom: 16,
        }}>
          <input
            type="text"
            value={sopTitle}
            onChange={(e) => setSOPTitle(e.target.value)}
            placeholder="SOP Title"
            style={{
              width: "100%", padding: "8px", marginBottom: 8, borderRadius: 6,
              border: `1px solid ${D.border}`, fontSize: 12, boxSizing: "border-box",
            }}
          />
          <textarea
            value={sopBody}
            onChange={(e) => setSOPBody(e.target.value)}
            placeholder="Standard Operating Procedure..."
            style={{
              width: "100%", padding: "8px", borderRadius: 6,
              border: `1px solid ${D.border}`, minHeight: 120,
              fontFamily: "inherit", boxSizing: "border-box",
              marginBottom: 8, fontSize: 12,
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleAddSOP}
              disabled={!sopTitle.trim() || !sopBody.trim() || saving}
              style={{
                flex: 1, padding: "10px", borderRadius: 6,
                background: D.yl, border: "none", cursor: "pointer",
                fontSize: 11, fontWeight: 700, color: D.bk,
              }}
            >
              {saving ? "SAVING..." : "SAVE"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              style={{
                flex: 1, padding: "10px", borderRadius: 6,
                border: `1px solid ${D.border}`, background: "transparent",
                cursor: "pointer", fontSize: 11, color: D.muted,
              }}
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          style={{
            width: "100%", padding: "10px", marginBottom: 16, borderRadius: 8,
            background: D.yl, border: "none", cursor: "pointer",
            fontSize: 11, fontWeight: 700, color: D.bk,
          }}
        >
          + CREATE SOP
        </button>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {sops.map(sop => (
          <div
            key={sop.id}
            style={{
              border: `1px solid ${D.border}`, borderRadius: 8, padding: 12, background: D.bg,
            }}
          >
            <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0, marginBottom: 8, color: D.bk }}>
              {sop.title}
            </h4>
            <div style={{ fontSize: 12, color: D.muted, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {sop.body}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VersionsTab({ versions }) {
  if (versions.length === 0) {
    return <div style={{ color: D.muted, textAlign: "center", padding: 40 }}>No version history</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[...versions].reverse().map(version => (
        <div
          key={version.id}
          style={{
            border: `1px solid ${D.border}`, borderRadius: 8, padding: 12, background: D.bg,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: D.bk }}>
            Version {version.versionNo} • {new Date(version.createdAt).toLocaleDateString()}
          </div>
          <div style={{ fontSize: 11, color: D.muted, marginBottom: 8 }}>
            {version.changeReason || "Version created"}
          </div>
          <div style={{ fontSize: 12, color: D.bk }}>
            <strong>{version.title}</strong> • {version.rrule}
          </div>
        </div>
      ))}
    </div>
  );
}
