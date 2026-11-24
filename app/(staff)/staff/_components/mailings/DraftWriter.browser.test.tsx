import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { DraftTitle, TestSent } from "./DraftWriter";
import { DraftFootExample, DraftTitleExample } from "./DraftWriter.gallery.client";

describe("DraftWriter's examples in the gallery", () => {
  it("draws a draft's title and foot", async () => {
    await render(
      <>
        <DraftTitleExample />
        <DraftFootExample />
      </>,
    );
    await expect.element(page.getByRole("button", { name: "Schedule 412 emails" }).first()).toBeVisible();
  });

  it("leaves the draft's foot as it was when Schedule is refused", async () => {
    await render(<DraftFootExample />);
    const schedule = page.getByRole("button", { name: "Schedule 412 emails" }).first();
    await schedule.click();
    await expect.element(schedule).toBeEnabled();
  });
});

describe("DraftTitle", () => {
  it("puts the title in the window's tab too, as it changes", async () => {
    const { rerender } = await render(<DraftTitle title="Our March" />);
    expect(document.title).toBe(staffVocabulary.tabTitle("Our March"));
    await rerender(<DraftTitle title="Our March in London" />);
    expect(document.title).toBe(staffVocabulary.tabTitle("Our March in London"));
  });

  it("shows the bar once the title has scrolled off the top, not while it's still below the window", async () => {
    // The observer, told where the title is, as the browser would tell it.
    let seen: (entries: Partial<IntersectionObserverEntry>[]) => void = () => {};
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: typeof seen) {
          seen = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    try {
      await render(<DraftTitle title="Our March" />);
      const bar = () => document.querySelector("h1")!.previousElementSibling!;
      const at = (top: number) => seen([{ intersectionRatio: 0, boundingClientRect: { top } as DOMRectReadOnly }]);
      // Out of sight above the window, then below it, not yet reached.
      at(-100);
      await expect.poll(() => bar().hasAttribute("data-shown")).toBe(true);
      at(5000);
      await expect.poll(() => bar().hasAttribute("data-shown")).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("TestSent", () => {
  it("says nothing before a test copy goes, then how it went, a tick by one sent", async () => {
    const { rerender } = await render(<TestSent sent={false} />);
    // There from the start for screen readers, taking no room while it's empty.
    expect(document.querySelector("[role=status]")!.textContent).toBe("");
    await rerender(<TestSent line="Sent to jane.smith@example.com." sent />);
    await expect.element(page.getByRole("status")).toHaveTextContent("Sent to jane.smith@example.com.");
    expect(page.getByRole("status").element().querySelector("svg")).not.toBeNull();
    await rerender(<TestSent line="It couldn't be sent." sent={false} />);
    await expect.element(page.getByRole("status")).toHaveTextContent("It couldn't be sent.");
    expect(page.getByRole("status").element().querySelector("svg")).toBeNull();
  });
});
