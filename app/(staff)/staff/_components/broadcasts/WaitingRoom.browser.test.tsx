import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { refused } from "@/lib/form-result";
import { waitingRoomCopy } from "@/lib/broadcasts/waiting-room-copy";
import { staffTime } from "@/lib/staff-time";
import { RefusalPlace } from "../ui/ResultForm";
import SupporterWaitingRoom from "./SupporterWaitingRoom";
import WaitingRoom, { type WaitingRoomActions } from "./WaitingRoom";
import { WaitingRoomExample } from "./WaitingRoom.gallery.client";
import {
  exampleAsked,
  exampleCounts,
  exampleDismissed,
  exampleHeld,
  exampleLetIn,
  exampleLetInByStaff,
  exampleLink,
} from "./WaitingRoom.examples";

// The page's address, which the place a page says things at its top reads (RefusalPlace).
vi.mock("next/navigation", () => ({
  usePathname: () => "/staff/supporters/waiting-room",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({}),
}));

const copy = waitingRoomCopy.page;

/** Actions that each give `answer`, recording their forms. */
const actions = (answer: Awaited<ReturnType<WaitingRoomActions["letIn"]>> = { ok: true }) => ({
  letIn: vi.fn<WaitingRoomActions["letIn"]>(async () => answer),
  dismiss: vi.fn<WaitingRoomActions["dismiss"]>(async () => ({ ok: true })),
  setLink: vi.fn<WaitingRoomActions["setLink"]>(async () => refused("not-a-link")),
});

describe("WaitingRoom", () => {
  it("shows the link, the tabs with their counts, and someone held: their chat, why, and the buttons, which send their id", async () => {
    const sent = actions();
    await render(
      <RefusalPlace>
        <WaitingRoom state="held" people={[exampleHeld]} counts={exampleCounts} link={exampleLink} actions={sent} />
      </RefusalPlace>,
    );
    await expect.element(page.getByText(exampleLink.link)).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: `${copy.tabs["let-in"]} 37` }))
      .toHaveAttribute("href", "/staff/supporters/waiting-room?show=let-in");
    await expect.element(page.getByRole("heading", { name: "Sam" })).toBeVisible();
    await expect.element(page.getByText("07700 900456 · ⁂ from footer", { exact: false })).toBeVisible();
    await expect.element(page.getByText(exampleHeld.heldWhy!, { exact: false })).toBeVisible();
    await expect.element(page.getByText("voice")).toBeVisible();
    await page.getByRole("button", { name: copy.letIn }).click();
    await expect.poll(() => sent.letIn.mock.calls.length).toBe(1);
    expect(sent.letIn.mock.calls[0][0].get("id")).toBe("1");
    await page.getByRole("button", { name: copy.dismiss }).click();
    await expect.poll(() => sent.dismiss.mock.calls.length).toBe(1);
  });

  it("says why it couldn't let someone in, and why a link wasn't taken", async () => {
    const sent = actions(refused("no-link"));
    await render(
      <RefusalPlace>
        <WaitingRoom state="asked" people={[exampleAsked]} counts={{ ...exampleCounts, held: 0 }} actions={sent} />
      </RefusalPlace>,
    );
    await expect.element(page.getByText(copy.link.none)).toBeVisible();
    // Nobody held: that tab has no count.
    await expect.element(page.getByRole("link", { name: copy.tabs.held, exact: true })).toBeVisible();
    await page.getByRole("button", { name: copy.letIn }).click();
    await expect.element(page.getByText(copy.refused["no-link"])).toBeVisible();
    await page.getByRole("textbox", { name: copy.link.label }).fill("https://example.com/x");
    await page.getByRole("button", { name: copy.link.save }).click();
    await expect.element(page.getByText(copy.refused["not-a-link"])).toBeVisible();
  });

  it("says who let someone in, the check or a staff member, and that the link waits, with their supporter page", async () => {
    await render(
      <WaitingRoom
        state="let-in"
        people={[exampleLetIn, exampleLetInByStaff]}
        counts={exampleCounts}
        link={exampleLink}
        actions={actions()}
      />,
    );
    await expect.element(page.getByText(copy.letInByCheck(staffTime(exampleLetIn.decidedAt!)))).toBeVisible();
    await expect.element(page.getByText(copy.linkWaiting)).toBeVisible();
    await expect.element(page.getByRole("heading", { name: "06 12 34 56 78" })).not.toBeInTheDocument();
    await expect.element(page.getByRole("heading", { name: "+33612345678" })).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: copy.supporter }).first())
      .toHaveAttribute("href", "/staff/supporters/7");
    expect(page.getByRole("button", { name: copy.letIn }).elements()).toHaveLength(0);
  });

  it("says who dismissed someone, and that there's nobody on an empty tab", async () => {
    await render(<WaitingRoomExample state="dismissed" people={[exampleDismissed]} link={exampleLink} />);
    await expect.element(page.getByText("Crypto Gains")).toBeVisible();
    await render(<WaitingRoomExample state="held" people={[]} />);
    await expect.element(page.getByText(copy.none.held)).toBeVisible();
  });
});

describe("SupporterWaitingRoom", () => {
  it("shows a supporter's chat, linking to the tab they're on; and nothing for someone who didn't come through it", async () => {
    const { container, rerender } = await render(<SupporterWaitingRoom person={exampleLetIn} />);
    await expect.element(page.getByRole("heading", { name: copy.chat })).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: copy.tabs["let-in"] }))
      .toHaveAttribute("href", "/staff/supporters/waiting-room?show=let-in");
    await rerender(<SupporterWaitingRoom />);
    expect(container.textContent).toBe("");
  });
});
