// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BalanceSheetScreen } from "../BalanceSheetScreen.jsx";
import { loadSheet, SECTIONS } from "../../../lib/balanceSheet.js";
import { resetBalanceDB } from "../../../test/setup.js";

// Component-level journey tests (audit T2).
//
// These drive the real components against a real IndexedDB implementation, so
// consent, autosave, resume, and delete exercise the actual persistence path.
// They are not full browser E2E: the PIN gate, PWA standalone behaviour, and
// print rendering sit outside this module and are verified manually.

const mount = () => render(<BalanceSheetScreen />);

const openIntro = async (user) => {
  await user.click(await screen.findByRole("button", { name: /start my balance sheet/i }));
};

/** Consent and land on the first section. */
const consentAndStart = async (user) => {
  await openIntro(user);
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: /^start$/i }));
  await screen.findByRole("button", { name: /add a resource/i });
};

describe("baseline journey", () => {
  beforeEach(async () => { await resetBalanceDB(); });

  it("blocks entry until consent is given, then records it", async () => {
    const user = userEvent.setup();
    mount();
    await openIntro(user);

    expect(screen.getByRole("button", { name: /tick the box to start/i })).toBeDisabled();

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /^start$/i }));

    await waitFor(async () => {
      const saved = await loadSheet();
      expect(saved?.consent?.granted).toBe(true);
      expect(saved.consent.statement).toMatch(/not a test, a diagnosis, or a monitored service/i);
      expect(saved.consent.version).toBe(1);
    });
  });

  it("walks every section without requiring a single answer", async () => {
    const user = userEvent.setup();
    mount();
    await consentAndStart(user);

    for (let i = 1; i < SECTIONS.length; i++) {
      await user.click(await screen.findByRole("button", { name: /next →/i }));
    }
    expect(await screen.findByRole("button", { name: /see my summary/i })).toBeInTheDocument();
  });

  it("records 'prefer not to answer' as a real choice, not a blank", async () => {
    const user = userEvent.setup();
    mount();
    await consentAndStart(user);

    await user.click(screen.getByRole("button", { name: /add a resource/i }));
    const declines = await screen.findAllByRole("button", { name: /^prefer not to answer$/i });
    await user.click(declines[0]);

    await waitFor(async () => {
      const saved = await loadSheet();
      const strength = saved.assets[0].strength;
      expect(strength.state).toBe("prefer_not_to_answer");
      expect(strength.value).toBeNull();       // never coerced to 0
      expect(strength.anchors).toBeTruthy();   // still versioned
    }, { timeout: 4000 });
  });

  it("saves partway, exits, and resumes with the answer intact", async () => {
    const user = userEvent.setup();
    const view = mount();
    await consentAndStart(user);

    await user.click(screen.getByRole("button", { name: /add a resource/i }));
    await user.type(await screen.findByLabelText(/what is it\?/i), "My brother");

    await waitFor(async () => {
      expect((await loadSheet())?.assets?.[0]?.description).toBe("My brother");
    }, { timeout: 4000 });

    await user.click(screen.getByRole("button", { name: /save and exit/i }));
    await screen.findByRole("button", { name: /continue my balance sheet/i });

    // Fresh mount, as if the app had been closed and reopened
    view.unmount();
    mount();
    await user.click(await screen.findByRole("button", { name: /continue my balance sheet/i }));
    expect(await screen.findByDisplayValue("My brother")).toBeInTheDocument();
  });

  it("deletes everything on confirmation and returns to a clean start", async () => {
    const user = userEvent.setup();
    mount();
    await consentAndStart(user);

    await user.click(screen.getByRole("button", { name: /add a resource/i }));
    await user.type(await screen.findByLabelText(/what is it\?/i), "Something private");
    await waitFor(async () => {
      expect((await loadSheet())?.assets?.[0]?.description).toBe("Something private");
    }, { timeout: 4000 });

    await user.click(screen.getByRole("button", { name: /skip to summary/i }));
    await user.click(await screen.findByRole("button", { name: /delete everything/i }));

    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();   // two-step
    await user.click(screen.getByRole("button", { name: /yes, permanently delete/i }));

    await waitFor(async () => expect(await loadSheet()).toBeNull());
    expect(await screen.findByRole("button", { name: /start my balance sheet/i })).toBeInTheDocument();
  });
});
