// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BalanceSheetScreen } from "../BalanceSheetScreen.jsx";
import { SECTIONS, AI_GOVERNANCE_APPROVED, MONITORING_STATEMENT } from "../../../lib/balanceSheet.js";
import { resetBalanceDB } from "../../../test/setup.js";

// Audit P0-2, P0-3, P0-4, S8. These are the release blockers; they get their
// own suite so a regression here is unmistakable.

const mount = () => render(<BalanceSheetScreen accessToken="test-token" />);

const consentAndStart = async (user) => {
  await user.click(await screen.findByRole("button", { name: /start my balance sheet/i }));
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: /^start$/i }));
  await screen.findByRole("button", { name: /add a resource/i });
};

describe("safety and consent", () => {
  beforeEach(async () => { await resetBalanceDB(); });

  it("offers a way to get help on the landing screen", async () => {
    mount();
    expect(await screen.findByRole("button", { name: /get help/i })).toBeInTheDocument();
  });

  it("keeps help reachable on EVERY step of the flow", async () => {
    const user = userEvent.setup();
    mount();
    await consentAndStart(user);

    for (let i = 0; i < SECTIONS.length; i++) {
      expect(
        screen.queryByRole("button", { name: /get help/i }),
        `help missing on step ${i + 1} (${SECTIONS[i].label})`
      ).toBeInTheDocument();
      const next = screen.queryByRole("button", { name: /next →/i });
      if (next) await user.click(next);
    }
  });

  it("opens a help sheet that names an emergency route and can be dismissed", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole("button", { name: /get help/i }));

    const dialog = await screen.findByRole("dialog", { name: /get help now/i });
    expect(dialog).toHaveTextContent(/local emergency number/i);
    expect(dialog).toHaveTextContent(/not a crisis service/i);

    await user.click(screen.getByRole("button", { name: /close/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("states plainly that nothing is monitored", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole("button", { name: /start my balance sheet/i }));
    expect(screen.getByText(/no one reviews these answers/i)).toBeInTheDocument();
    expect(MONITORING_STATEMENT).toMatch(/not monitored|no one reviews/i);
  });

  it("frames itself as a prototype and never claims validation", async () => {
    mount();
    await screen.findByRole("button", { name: /start my balance sheet/i });
    const body = document.body.textContent;
    expect(body).toMatch(/research-informed prototype/i);
    expect(body).not.toMatch(/clinically (proven|validated)/i);
  });

  it("does not offer to send anything to AI while governance is unapproved", async () => {
    const user = userEvent.setup();
    mount();
    await consentAndStart(user);
    await user.click(screen.getByRole("button", { name: /skip to summary/i }));

    await screen.findByText(/help me organize my answers/i);
    expect(AI_GOVERNANCE_APPROVED).toBe(false);
    expect(screen.getByText(/turned off pending review/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /review what would be sent/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /i consent — send this text/i })).not.toBeInTheDocument();
  });
});

// Audit P0-1 at the component level: the user must be warned, not reassured.
describe("save failure is surfaced, never silent", () => {
  beforeEach(async () => { await resetBalanceDB(); vi.resetModules(); });

  it("warns and offers a download instead of claiming the answers are saved", async () => {
    vi.doMock("../../../lib/balanceSheet.js", async (importOriginal) => {
      const actual = await importOriginal();
      return {
        ...actual,
        saveSheet: vi.fn().mockRejectedValue(
          Object.assign(new Error("Could not save. IndexedDB: blocked. Local storage: QuotaExceededError."),
            { name: "BalanceSheetSaveError" })
        ),
      };
    });
    const { BalanceSheetScreen: Screen } = await import("../BalanceSheetScreen.jsx");

    const user = userEvent.setup();
    render(<Screen />);
    await user.click(await screen.findByRole("button", { name: /start my balance sheet/i }));
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /^start$/i }));

    const alert = await screen.findByRole("alert", {}, { timeout: 4000 });
    expect(alert).toHaveTextContent(/not saved/i);
    expect(alert).toHaveTextContent(/will be lost/i);
    expect(within(alert).getByRole("button", { name: /download my answers/i })).toBeInTheDocument();

    // and it must not simultaneously claim success
    expect(screen.queryByText(/^Saved \d/)).not.toBeInTheDocument();
    vi.doUnmock("../../../lib/balanceSheet.js");
  });
});
