import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { supportersSearch } from "@/lib/staff-search";
import { ChoosingBroadcastFrame, BroadcastSupporters } from "./BroadcastSupporters";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import { BroadcastSupportersExample, ChoosingBroadcastFrameExample } from "./BroadcastSupporters.gallery.client";

const copy = broadcastsCopy.broadcastPages;
const nothing = async () => {};

const button = (name: string | RegExp) => page.getByRole("button", { name });

describe("the supporters list", () => {
  const yes = supportersSearch({ contact: "email:newsletter:yes", near: "LS1" });
  const none = supportersSearch({ near: "LS1" });

  it("starts a broadcast to those found with a Consent filter answered yes, keeping who they are", async () => {
    await render(<BroadcastSupporters search={yes} total={430} action={nothing} />);
    await expect.element(button(copy.broadcastButton(430))).toBeVisible();
    expect(document.querySelector<HTMLInputElement>('input[name="contact"]')!.value).toBe("email:newsletter:yes");
    expect(document.querySelector<HTMLInputElement>('input[name="near"]')!.value).toBe("LS1");
  });

  it("isn't there without a Consent filter answered yes", async () => {
    await render(
      <div data-testid="here">
        <BroadcastSupporters search={none} total={1} action={nothing} />
      </div>,
    );
    await expect.element(page.getByTestId("here")).toBeEmptyDOMElement();
  });

  it("isn't there while choosing for a draft", async () => {
    const choosing = {
      id: 3,
      title: "Events",
      channel: "email" as const,
      topics: ["newsletter" as const],
      blank: false,
    };
    await render(
      <div data-testid="here">
        <BroadcastSupporters search={yes} total={430} action={nothing} choosing={choosing} />
      </div>,
    );
    await expect.element(page.getByTestId("here")).toBeEmptyDOMElement();
  });

  describe("choosing who a draft goes to", () => {
    const choosing = {
      id: 3,
      title: "Events",
      channel: "email" as const,
      topics: ["newsletter" as const],
      blank: false,
    };

    it("is only the page when it isn't", async () => {
      await render(
        <ChoosingBroadcastFrame search={yes} total={430} keep={nothing}>
          <p>The list</p>
        </ChoosingBroadcastFrame>,
      );
      await expect.element(page.getByText("The list")).toBeVisible();
      await expect.element(page.getByRole("region")).not.toBeInTheDocument();
    });

    it("names the draft, with Cancel, and keeps the filters from the bar", async () => {
      await render(
        <ChoosingBroadcastFrame choosing={choosing} search={yes} total={430} keep={nothing}>
          <p>The list</p>
        </ChoosingBroadcastFrame>,
      );
      await expect.element(page.getByText(copy.choosing("Events"))).toBeVisible();
      await expect.element(page.getByText(copy.choosingNew)).not.toBeInTheDocument();
      await expect
        .element(page.getByRole("link", { name: copy.choosingCancel }))
        .toHaveAttribute("href", "/staff/broadcasts/3");
      await expect.element(page.getByText(copy.choosingCount(430))).toBeVisible();
      await expect.element(button(copy.useThese(430))).toBeVisible();
    });

    it("says it's choosing for a new one, for a draft with nothing written yet", async () => {
      await render(
        <ChoosingBroadcastFrame choosing={{ ...choosing, blank: true }} search={yes} total={430} keep={nothing}>
          <p>The list</p>
        </ChoosingBroadcastFrame>,
      );
      await expect.element(page.getByText(copy.choosingNew)).toBeVisible();
      await expect.element(page.getByText(copy.choosing("Events"))).not.toBeInTheDocument();
    });
  });
});

describe("BroadcastSupporters' examples in the gallery", () => {
  it("draws the button, and the list choosing who a draft goes to", async () => {
    await render(
      <>
        <BroadcastSupportersExample />
        <ChoosingBroadcastFrameExample />
      </>,
    );
    await expect.element(button(copy.broadcastButton(430))).toBeVisible();
    await expect.element(page.getByRole("region", { name: copy.choosingLabel })).toBeVisible();
  });
});
