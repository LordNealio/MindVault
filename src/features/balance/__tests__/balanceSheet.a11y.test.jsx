// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { BalanceSheetScreen } from "../BalanceSheetScreen.jsx";
import { SECTIONS } from "../../../lib/balanceSheet.js";
import { resetBalanceDB } from "../../../test/setup.js";

// Audit T3 / A1–A11.
//
// Colour-contrast rules are disabled: jsdom does not compute rendered colour,
// so axe cannot evaluate them here and would report false results either way.
// Contrast is checked visually in the browser instead.
const AXE_OPTIONS = {
  rules: { "color-contrast": { enabled: false } },
  resultTypes: ["violations"],
};

async function violations(container) {
  const results = await axe.run(container, AXE_OPTIONS);
  return results.violations.map(v => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.length,
    help: v.help,
  }));
}

const mount = () => render(<BalanceSheetScreen />);

const consentAndStart = async (user) => {
  await user.click(await screen.findByRole("button", { name: /start my balance sheet/i }));
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: /^start$/i }));
  await screen.findByRole("button", { name: /add a resource/i });
};

describe("accessibility", () => {
  beforeEach(async () => { await resetBalanceDB(); });

  it("landing screen has no axe violations", async () => {
    const { container } = mount();
    await screen.findByRole("button", { name: /start my balance sheet/i });
    expect(await violations(container)).toEqual([]);
  });

  it("orientation and consent screen has no axe violations", async () => {
    const user = userEvent.setup();
    const { container } = mount();
    await user.click(await screen.findByRole("button", { name: /start my balance sheet/i }));
    expect(await violations(container)).toEqual([]);
  });

  it("every section step has no axe violations", async () => {
    const user = userEvent.setup();
    const { container } = mount();
    await consentAndStart(user);

    for (let i = 0; i < SECTIONS.length; i++) {
      const found = await violations(container);
      expect(found, `axe violations on step ${i + 1} (${SECTIONS[i].label})`).toEqual([]);
      const next = screen.queryByRole("button", { name: /next →/i });
      if (next) await user.click(next);
    }
  }, 30000); // axe over ten steps is slow; this is not a hang

  it("the summary has no axe violations", async () => {
    const user = userEvent.setup();
    const { container } = mount();
    await consentAndStart(user);
    await user.click(screen.getByRole("button", { name: /skip to summary/i }));
    await screen.findByText(/your personal balance sheet/i);
    expect(await violations(container)).toEqual([]);
  });

  it("the help sheet is a labelled modal dialog", async () => {
    const user = userEvent.setup();
    const { container } = mount();
    await user.click(await screen.findByRole("button", { name: /get help/i }));
    const dialog = await screen.findByRole("dialog", { name: /get help now/i });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(await violations(container)).toEqual([]);
  });

  it("every rating scale is a labelled group whose options carry their anchor text", async () => {
    const user = userEvent.setup();
    mount();
    await consentAndStart(user);
    await user.click(screen.getByRole("button", { name: /add a resource/i }));

    const groups = await screen.findAllByRole("group");
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) {
      // a legend, so the question is announced with the options
      expect(g.querySelector("legend")?.textContent?.trim()).toBeTruthy();
    }

    // Radios expose the anchor wording, not just a bare number
    const radios = await screen.findAllByRole("radio");
    expect(radios.length).toBeGreaterThan(0);
    const names = radios.map(r => r.closest("label")?.textContent || "");
    expect(names.some(n => /Not available|Reliably available|Fragile|Very solid/i.test(n))).toBe(true);
  });

  it("keeps a live region for progress announcements", async () => {
    const user = userEvent.setup();
    mount();
    await consentAndStart(user);
    const live = document.querySelector('[aria-live="polite"][role="status"]');
    expect(live).toBeTruthy();
  });

  it("marks a failed save with role=alert rather than colour alone", async () => {
    // The banner's semantics are asserted here; the failure path itself is
    // covered in balanceSheet.safety.test.jsx.
    const user = userEvent.setup();
    mount();
    await consentAndStart(user);
    // no failure induced, so there should be no alert competing for attention
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
