import { useState, useEffect } from "react";
import { calculateMetrics, clearMetrics, exportMetricsJSON } from "../lib/metrics.js";

// Design tokens matching MindVault theme
const D = {
  bg: "#F0EDE5",
  surf: "#FAFAF7",
  bk: "#0A0A0A",
  border: "#E8E4DA",
  muted: "#9B9589",
  yl: "#E8B84B",
  rd: "#C1121F",
  gr: "#3DD68C",
  bl: "#1D3557",
};

function MetricsCard({ label, value, unit = "", variant = "default" }) {
  const bgColor = variant === "highlight" ? D.yl : D.surf;
  const textColor = variant === "highlight" ? D.bk : D.bk;

  return (
    <div
      style={{
        background: bgColor,
        border: `1px solid ${D.border}`,
        borderRadius: 12,
        padding: 16,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontFamily: "'Unbounded', monospace",
          fontWeight: 700,
          letterSpacing: ".08em",
          color: D.muted,
          marginBottom: 8,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 32,
          fontFamily: "'Unbounded', monospace",
          fontWeight: 900,
          color: textColor,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {unit && (
        <div style={{ fontSize: 10, color: D.muted, marginTop: 4 }}>
          {unit}
        </div>
      )}
    </div>
  );
}

function FeatureBreakdown({ data }) {
  const entries = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const maxValue = Math.max(...entries.map(e => e[1]));

  return (
    <div style={{ marginTop: 24 }}>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: D.bk,
          fontFamily: "'Unbounded', monospace",
          marginBottom: 16,
        }}
      >
        Top Features (Last 30 Days)
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {entries.map(([feature, count]) => (
          <div key={feature}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
                fontSize: 12,
              }}
            >
              <span style={{ color: D.bk, fontWeight: 600 }}>{feature}</span>
              <span style={{ color: D.muted }}>{count}</span>
            </div>
            <div
              style={{
                background: D.border,
                height: 6,
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  background: D.yl,
                  height: "100%",
                  width: `${(count / maxValue) * 100}%`,
                  transition: "width .3s",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OnboardingFunnel({ screens, completionRate }) {
  const screenLabels = {
    onboarding_screen_0: "Welcome",
    onboarding_screen_1: "Meditation",
    onboarding_screen_2: "Journal",
    onboarding_screen_3: "Home Screen",
    onboarding_screen_4: "Privacy",
    onboarding_screen_5: "Enter App",
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: D.bk,
          fontFamily: "'Unbounded', monospace",
          marginBottom: 16,
        }}
      >
        Onboarding Funnel
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Object.entries(screenLabels).map(([key, label]) => {
          const count = screens[key] || 0;
          const isComplete = key === "onboarding_screen_5";
          return (
            <div
              key={key}
              style={{
                background: isComplete ? D.gr + "15" : D.surf,
                border: `1px solid ${D.border}`,
                borderRadius: 8,
                padding: 10,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 12, color: D.bk, fontWeight: 500 }}>
                {label}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: isComplete ? D.gr : D.muted,
                  fontWeight: 600,
                }}
              >
                {count}
              </span>
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 12,
          padding: 10,
          background: D.bl + "08",
          borderRadius: 8,
          fontSize: 12,
          color: D.bk,
        }}
      >
        <strong>Completion Rate:</strong> {completionRate}%
      </div>
    </div>
  );
}

export function MetricsScreen({ onClose }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const data = await calculateMetrics();
      setMetrics(data);
    } catch (err) {
      console.error("Failed to load metrics:", err);
    }
    setLoading(false);
  };

  const handleExportMetrics = async () => {
    try {
      const data = await exportMetricsJSON();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mindvault-metrics-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export metrics:", err);
    }
  };

  const handleClearMetrics = () => {
    if (
      window.confirm(
        "Are you sure? This will permanently delete all metrics data. This action cannot be undone."
      )
    ) {
      clearMetrics().then(() => {
        loadMetrics();
      });
    }
  };

  const formatDuration = (ms) => {
    if (!ms) return "0s";
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.round(seconds / 60);
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          background: D.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ color: D.muted }}>Loading metrics...</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          background: D.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ color: D.muted }}>No metrics available yet</div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: D.bg,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px 20px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${D.border}`,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'Unbounded', monospace",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: ".08em",
              color: D.bk,
              marginBottom: 4,
            }}
          >
            METRICS DASHBOARD
          </div>
          <div
            style={{
              fontSize: 11,
              color: D.muted,
            }}
          >
            Local usage analytics (last 30 days)
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "rgba(0,0,0,.07)",
            border: "none",
            fontSize: 18,
            cursor: "pointer",
            color: D.muted,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 20, paddingTop: 24, maxWidth: 900, margin: "0 auto", width: "100%" }}>
        {/* Summary Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <MetricsCard
            label="Days Active"
            value={metrics.summary.daysActive}
            unit="this month"
          />
          <MetricsCard
            label="Entries This Week"
            value={metrics.daily.todayEntries}
          />
          <MetricsCard
            label="Avg Session"
            value={formatDuration(metrics.summary.avgSessionDurationMs)}
          />
          <MetricsCard
            label="App Opens Today"
            value={metrics.daily.todayOpens}
            variant="highlight"
          />
        </div>

        {/* Feature Breakdown */}
        {Object.keys(metrics.usage.featureBreakdown).length > 0 && (
          <FeatureBreakdown data={metrics.usage.featureBreakdown} />
        )}

        {/* Onboarding Funnel */}
        <OnboardingFunnel
          screens={metrics.onboarding.screens}
          completionRate={metrics.onboarding.completionRate}
        />

        {/* Settings */}
        <div
          style={{
            marginTop: 32,
            paddingTop: 20,
            borderTop: `1px solid ${D.border}`,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: D.bk,
              fontFamily: "'Unbounded', monospace",
              marginBottom: 12,
              letterSpacing: ".06em",
              textTransform: "uppercase",
            }}
          >
            Privacy & Export
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={handleExportMetrics}
              style={{
                padding: "10px 14px",
                background: D.surf,
                border: `1px solid ${D.border}`,
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
                color: D.bk,
                fontFamily: "'Unbounded', monospace",
                transition: "all .2s",
              }}
              onMouseEnter={(e) => (e.target.style.background = D.yl)}
              onMouseLeave={(e) => (e.target.style.background = D.surf)}
            >
              ↓ Export JSON
            </button>
            <button
              onClick={handleClearMetrics}
              style={{
                padding: "10px 14px",
                background: D.surf,
                border: `1px solid ${D.rd}`,
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
                color: D.rd,
                fontFamily: "'Unbounded', monospace",
                transition: "all .2s",
              }}
              onMouseEnter={(e) => (e.target.style.background = D.rd + "15")}
              onMouseLeave={(e) => (e.target.style.background = D.surf)}
            >
              🗑 Clear All Metrics
            </button>
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 10,
              color: D.muted,
              lineHeight: 1.6,
            }}
          >
            All metrics are stored locally in your browser. No data is sent to servers
            without your explicit consent. You can export your metrics as JSON or clear
            all data at any time.
          </div>
        </div>
      </div>
    </div>
  );
}
