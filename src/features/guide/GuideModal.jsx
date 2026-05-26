import { GuideSection } from "./GuideSection.jsx";

const D = {
  bg:"#F0EDE5", white:"#FAFAF7", bk:"#0A0A0A",
  border:"#E8E4DA", muted:"#9B9589", yl:"#E8B84B",
};

export function GuideModal({ onClose }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 900,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "flex-end",
        padding: 0,
      }}
      onClick={onClose}
    >
      {/* Slide-up sheet */}
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          margin: "0 auto",
          background: D.bg,
          borderRadius: "20px 20px 0 0",
          maxHeight: "90vh",
          overflowY: "auto",
          animation: "slideUp .3s cubic-bezier(.16,1,.3,1) both",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            position: "sticky",
            top: 0,
            background: D.bg,
            padding: "20px 20px 14px",
            borderBottom: `1px solid ${D.border}`,
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <div
              style={{
                fontFamily: "'Unbounded', monospace",
                fontSize: 16,
                fontWeight: 900,
                color: D.bk,
              }}
            >
              MindWrite Guide
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
          <p
            style={{
              fontSize: 11,
              color: D.muted,
              margin: 0,
              fontStyle: "italic",
            }}
          >
            A guide to the philosophy, tools, and practices inside MindWrite.
          </p>
        </div>

        {/* Sections */}
        <div style={{ padding: "20px 20px 40px" }}>
          <GuideSection title="Welcome" defaultOpen={true}>
            <p>
              MindWrite is designed as a private space for reflection, awareness, creativity, and long-term pattern recognition.
              <br /><br />
              It is not social media.<br />
              It is not productivity theater.
              <br /><br />
              The goal is not constant optimization.<br />
              The goal is greater awareness and intentional living.
            </p>
          </GuideSection>

          <GuideSection title="Meditation & Mental State">
            <p>
              The guided meditation experience is inspired by José Silva's relaxation and visualization practices.
              <br /><br />
              The purpose is not perfection.<br />
              The purpose is preparation.
              <br /><br />
              Many users use the meditation to:
            </p>
            <ul style={{ paddingLeft: 20, marginTop: 8, marginBottom: 8 }}>
              <li>Slow mental noise</li>
              <li>Relax the nervous system</li>
              <li>Improve visualization</li>
              <li>Create mental clarity</li>
              <li>Transition into a more reflective state</li>
            </ul>
          </GuideSection>

          <GuideSection title="Journaling Philosophy">
            <p>
              The quality of your reflection shapes the quality of your insights.
              <br /><br />
              Consistency matters more than perfection.
              <br /><br />
              MindWrite becomes more valuable over time as patterns, emotions, goals, thoughts, and recurring themes begin to connect across weeks and months.
              <br /><br />
              At the same time, do not become dependent on the process.
              <br /><br />
              The app is here to support life — not replace it.
            </p>
          </GuideSection>

          <GuideSection title="Your Vault">
            <p>
              The Vault is your long-term archive for thoughts, ideas, reflections, memories, uploads, voice notes, and insights.
              <br /><br />
              Over time, MindWrite may help surface recurring patterns and connections across your entries.
            </p>
          </GuideSection>

          <GuideSection title="Counsel Mode">
            <p>
              Counsel Mode uses AI-powered conversational lenses inspired by historical, philosophical, literary, and cultural figures.
              <br /><br />
              These lenses are intended for reflection, education, inspiration, perspective-taking, and creative exploration.
              <br /><br />
              They are not literal recreations or replacements for real individuals.
            </p>
          </GuideSection>

          <GuideSection title="AI &amp; Privacy">
            <p>
              Whenever possible, MindWrite stores content locally on your device.
              <br /><br />
              Some optional AI-powered features may send selected content to external AI services to generate responses or insights.
              <br /><br />
              You remain in control of what you choose to share.
            </p>
          </GuideSection>

          <GuideSection title="Automation Features">
            <p>
              Automation tools are experimental productivity and planning features designed to assist with workflows, organization, and creative execution.
              <br /><br />
              They are optional and intended to support—not control—your decision making.
            </p>
          </GuideSection>

          <GuideSection title="Best Practices">
            <p>
              <strong>- Write honestly</strong>
              <br />
              <strong>- Use consistently</strong>
              <br />
              <strong>- Don't force depth every day</strong>
              <br />
              <strong>- Spend time away from screens</strong>
              <br />
              <strong>- Reflect, then live</strong>
              <br /><br />
              MindWrite is a companion for awareness, not a replacement for reality.
            </p>
          </GuideSection>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
