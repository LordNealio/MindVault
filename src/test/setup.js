// Test environment for component-level journey tests.
//
// fake-indexeddb gives the storage layer a real IndexedDB implementation, so
// these tests exercise the actual persistence path (save, resume, delete)
// rather than a mock that could drift from it.

import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

beforeEach(() => {
  try { localStorage.clear(); } catch { /* not always present */ }
  // jsdom implements neither of these, and the module calls both.
  if (typeof window !== "undefined") {
    // jsdom defines scrollTo but only to warn; replace it outright.
    window.scrollTo = () => {};
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
    if (!window.matchMedia) {
      window.matchMedia = (q) => ({
        matches: false, media: q, onchange: null,
        addEventListener: () => {}, removeEventListener: () => {},
        addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
      });
    }
    if (!URL.createObjectURL) URL.createObjectURL = () => "blob:mock";
    if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {};
  }
});

afterEach(() => {
  cleanup();
});

/**
 * Reset the module's stored sheet between tests.
 *
 * Uses the module's own delete API rather than deleteDatabase(): the latter
 * blocks while any connection is open, which is exactly the deadlock that
 * surfaced the missing connection handling in the storage layer.
 */
export async function resetBalanceDB() {
  // The screen autosaves on a 600ms debounce. Without draining it first, a save
  // scheduled by the previous test lands *after* this reset and the next test
  // starts with a stale sheet.
  await new Promise((r) => setTimeout(r, 700));
  const { deleteSheet } = await import("../lib/balanceSheet.js");
  await deleteSheet();
}
