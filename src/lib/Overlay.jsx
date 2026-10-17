import { createPortal } from "react-dom";
import { useScrollLock } from "./useScrollLock.js";

/**
 * Full-screen overlay that is genuinely pinned to the viewport.
 *
 * WHY A PORTAL: `position: fixed` is only relative to the viewport when no
 * ancestor establishes a containing block. Any ancestor with a `transform`
 * (or filter / perspective / will-change / contain) captures fixed
 * descendants instead. This app animates screens in with
 * `animation: fadeUp … both`, and `both` keeps the final keyframe's
 * `transform: translateY(0)` applied forever — so a "fixed" overlay inside an
 * animated screen stretched to the full height of that screen rather than the
 * viewport. On a phone that put the breathing square and the Start button
 * below the fold.
 *
 * Rendering into document.body sidesteps the whole class of problem, whatever
 * a future ancestor happens to animate.
 */
export function Overlay({ children, zIndex = 650, background = "#F0EDE5", lockScroll = true, ...rest }) {
  useScrollLock(lockScroll);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0, right: 0, bottom: 0, left: 0,
        zIndex,
        background,
        display: "flex",
        flexDirection: "column",
        overscrollBehavior: "contain",
      }}
      {...rest}
    >
      {children}
    </div>,
    document.body
  );
}
