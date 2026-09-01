import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { saveSheet, emptySheet } from "../balanceSheet.js";

// Audit P0-1 regression. The original implementation swallowed every storage
// error and resolved as if the write succeeded, so the UI displayed "Saved"
// while nothing had been written. These tests exist so that can never return.

const withGlobals = (idb, ls) => {
  globalThis.indexedDB = idb;
  globalThis.localStorage = ls;
};

describe("saveSheet failure reporting", () => {
  let originalIdb, originalLs;
  beforeEach(() => {
    originalIdb = globalThis.indexedDB;
    originalLs = globalThis.localStorage;
  });
  afterEach(() => {
    globalThis.indexedDB = originalIdb;
    globalThis.localStorage = originalLs;
  });

  it("rejects when IndexedDB is unavailable AND localStorage throws", async () => {
    withGlobals(undefined, {
      setItem: () => { const e = new Error("QuotaExceededError"); e.name = "QuotaExceededError"; throw e; },
      getItem: () => null,
      removeItem: () => {},
    });
    await expect(saveSheet(emptySheet())).rejects.toThrow(/Could not save/i);
  });

  it("names both failing stores so the user can be told what happened", async () => {
    withGlobals(undefined, {
      setItem: () => { throw new Error("boom"); },
      getItem: () => null, removeItem: () => {},
    });
    const err = await saveSheet(emptySheet()).catch(e => e);
    expect(err.name).toBe("BalanceSheetSaveError");
    expect(err.message).toMatch(/IndexedDB/i);
    expect(err.message).toMatch(/[Ll]ocal storage/);
  });

  it("falls back to localStorage and flags the result as degraded", async () => {
    const store = {};
    withGlobals(undefined, {
      setItem: (k, v) => { store[k] = v; },
      getItem: (k) => store[k] ?? null,
      removeItem: (k) => { delete store[k]; },
    });
    const res = await saveSheet(emptySheet());
    expect(res.degraded).toBe(true);
    expect(res.storedIn).toBe("localstorage");
    expect(Object.keys(store)).toHaveLength(1);
  });

  it("does not report success without writing anything", async () => {
    let wrote = false;
    withGlobals(undefined, {
      setItem: () => { throw new Error("nope"); },
      getItem: () => null, removeItem: () => {},
    });
    const res = await saveSheet(emptySheet()).catch(() => null);
    expect(res).toBeNull();
    expect(wrote).toBe(false);
  });
});
