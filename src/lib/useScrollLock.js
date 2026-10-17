import { useEffect } from "react";

// Locks the page behind a full-screen overlay.
//
// WHY NOT `document.body.style.overflow = "hidden"`:
// iOS Safari — and the standalone PWA in particular — keeps letting touch
// drags scroll the document even when body overflow is hidden. The overlay
// looks frozen while the page slides around underneath it, which with
// `apple-mobile-web-app-status-bar-style: black-translucent` shifts the whole
// screen. Pinning the body with `position: fixed` and restoring the scroll
// offset afterwards is the technique that actually holds.
//
// Locks are reference-counted so an overlay opened on top of another overlay
// (a game over the games list, a modal over a sheet) does not release the lock
// early when the inner one closes.

let lockCount = 0;
let savedScrollY = 0;
let savedStyle = null;

function applyLock() {
  const body = document.body;
  savedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  savedStyle = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overflow: body.style.overflow,
  };
  body.style.position = "fixed";
  body.style.top = `-${savedScrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
}

function releaseLock() {
  const body = document.body;
  if (savedStyle) Object.assign(body.style, savedStyle);
  savedStyle = null;
  // Restoring the offset has to happen after the body is unpinned, or the
  // browser has nowhere to scroll to and the user is bounced to the top.
  window.scrollTo(0, savedScrollY);
}

/**
 * @param {boolean} active – lock while true. Defaults to true so a component
 *   that is only mounted when open can call it with no argument.
 */
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    lockCount += 1;
    if (lockCount === 1) applyLock();
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) releaseLock();
    };
  }, [active]);
}

/** Escape hatch for tests and teardown. */
export function __resetScrollLock() {
  lockCount = 0;
  releaseLock();
}
