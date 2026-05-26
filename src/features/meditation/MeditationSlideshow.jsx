import { useState } from "react";

const D = {
  bg: "#F0EDE5",
  white: "#FAFAF7",
  bk: "#0A0A0A",
  border: "#E8E4DA",
  muted: "#9B9589",
  yl: "#E8B84B",
};

const MEDITATIONS = [
  "9TXhHykNUyA",
  "oeQfRtiY-ZM",
];

export function MeditationSlideshow() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextVideo = () =>
    setCurrentIndex((i) => (i + 1) % MEDITATIONS.length);
  const prevVideo = () =>
    setCurrentIndex((i) => (i - 1 + MEDITATIONS.length) % MEDITATIONS.length);

  const videoId = MEDITATIONS[currentIndex];

  return (
    <div>
      {/* Video Player */}
      <div
        style={{
          position: "relative",
          width: "100%",
          paddingBottom: "56.25%",
          background: D.bk,
          borderRadius: 8,
          overflow: "hidden",
          marginBottom: 10,
        }}
      >
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`}
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
            padding: "8px 12px",
            background: D.white,
            border: `1px solid ${D.border}`,
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 10,
            fontWeight: 600,
            color: D.bk,
            fontFamily: "'Unbounded', monospace",
            transition: "all .2s",
          }}
          onMouseEnter={(e) => (e.target.style.background = D.yl)}
          onMouseLeave={(e) => (e.target.style.background = D.white)}
        >
          ← Prev
        </button>

        <span
          style={{
            fontSize: 10,
            color: D.muted,
            fontFamily: "'Unbounded', monospace",
            fontWeight: 600,
          }}
        >
          {currentIndex + 1} / {MEDITATIONS.length}
        </span>

        <button
          onClick={nextVideo}
          style={{
            padding: "8px 12px",
            background: D.white,
            border: `1px solid ${D.border}`,
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 10,
            fontWeight: 600,
            color: D.bk,
            fontFamily: "'Unbounded', monospace",
            transition: "all .2s",
          }}
          onMouseEnter={(e) => (e.target.style.background = D.yl)}
          onMouseLeave={(e) => (e.target.style.background = D.white)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
