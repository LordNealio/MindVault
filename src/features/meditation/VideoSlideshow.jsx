import { useState } from "react";

const D = {
  bg: "#F0EDE5",
  white: "#FAFAF7",
  bk: "#0A0A0A",
  border: "#E8E4DA",
  muted: "#9B9589",
  yl: "#E8B84B",
};

const VIDEOS = [
  "QHkXvPq2pQE",
  "APzcnuCi58A",
  "aOM1tR_r2PE",
  "dpvvbKh400g",
  "FrhfOHmjc8A",
  "bHPRrQp2tf0",
  "dK7a16M98e8",
  "3h3Uvu8KWF4",
  "fSmudreuHS0",
  "HekZLSZ2mpU",
  "CG5lkaVSAiQ",
  "ol7hG4F8GI8",
];

export function VideoSlideshow({ defaultIndex = 0, inline = false }) {
  const [isOpen, setIsOpen] = useState(inline ? true : false);
  const [currentIndex, setCurrentIndex] = useState(defaultIndex);

  const nextVideo = () =>
    setCurrentIndex((i) => (i + 1) % VIDEOS.length);
  const prevVideo = () =>
    setCurrentIndex((i) => (i - 1 + VIDEOS.length) % VIDEOS.length);

  const videoId = VIDEOS[currentIndex];

  return (
    <div
      style={{
        marginTop: 24,
        paddingTop: 20,
        borderTop: `1px solid ${D.border}`,
      }}
    >
      {/* Collapse Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "8px 0",
          fontSize: 14,
          fontWeight: 600,
          color: D.bk,
          fontFamily: "'Unbounded', monospace",
        }}
      >
        Visualization Practices
        <span
          style={{
            display: "inline-block",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform .2s",
            fontSize: 12,
          }}
        >
          ▾
        </span>
      </button>

      {/* Expanded Content */}
      {isOpen && (
        <div
          style={{
            marginTop: 16,
            animation: "fadeUp .2s cubic-bezier(.16,1,.3,1) both",
          }}
        >
          {/* Video Player */}
          <div
            style={{
              position: "relative",
              width: "100%",
              paddingBottom: "56.25%",
              background: D.bk,
              borderRadius: 12,
              overflow: "hidden",
              marginBottom: 12,
            }}
          >
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}`}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                border: "none",
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>

          {/* Controls */}
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <button
              onClick={prevVideo}
              style={{
                padding: "10px 16px",
                background: D.white,
                border: `1px solid ${D.border}`,
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                color: D.bk,
                fontFamily: "'Unbounded', monospace",
                transition: "all .2s",
              }}
              onMouseEnter={(e) =>
                (e.target.style.background = D.yl)
              }
              onMouseLeave={(e) =>
                (e.target.style.background = D.white)
              }
            >
              ← Previous
            </button>

            <span
              style={{
                fontSize: 11,
                color: D.muted,
                fontFamily: "'Unbounded', monospace",
                fontWeight: 600,
              }}
            >
              {currentIndex + 1} / {VIDEOS.length}
            </span>

            <button
              onClick={nextVideo}
              style={{
                padding: "10px 16px",
                background: D.white,
                border: `1px solid ${D.border}`,
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                color: D.bk,
                fontFamily: "'Unbounded', monospace",
                transition: "all .2s",
              }}
              onMouseEnter={(e) =>
                (e.target.style.background = D.yl)
              }
              onMouseLeave={(e) =>
                (e.target.style.background = D.white)
              }
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
