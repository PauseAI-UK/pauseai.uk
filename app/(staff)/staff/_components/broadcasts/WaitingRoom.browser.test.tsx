import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { refused } from "@/lib/form-result";
import { cameFromWords, waitingRoomCopy } from "@/lib/broadcasts/waiting-room-copy";
import { staffTime } from "@/lib/staff-time";
import { RefusalPlace } from "../ui/ResultForm";
import WaitingRoom, { CommunityLinkButton, type WaitingRoomActions } from "./WaitingRoom";
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
        <WaitingRoom state="held" people={[exampleHeld]} counts={exampleCounts} actions={sent} />
      </RefusalPlace>,
    );
    await expect
      .element(page.getByRole("link", { name: `${copy.tabs["let-in"]} 37` }))
      .toHaveAttribute("href", "/staff/supporters/waiting-room?show=let-in");
    await expect.element(page.getByRole("heading", { name: "Sam" })).toBeVisible();
    await expect.element(page.getByText(`07700 900456 · ${cameFromWords("footer")}`, { exact: false })).toBeVisible();
    await expect.element(page.getByText(exampleHeld.heldWhy!, { exact: false })).toBeVisible();
    await expect.element(page.getByText("voice")).toBeVisible();
    await page.getByRole("button", { name: copy.letIn }).click();
    await expect.poll(() => sent.letIn.mock.calls.length).toBe(1);
    expect(sent.letIn.mock.calls[0][0].get("id")).toBe("1");
    await page.getByRole("button", { name: copy.dismiss }).click();
    await expect.poll(() => sent.dismiss.mock.calls.length).toBe(1);
  });

  it("says why it couldn't let someone in", async () => {
    const sent = actions(refused("no-link"));
    await render(
      <RefusalPlace>
        <WaitingRoom state="asked" people={[exampleAsked]} counts={{ ...exampleCounts, held: 0 }} actions={sent} />
      </RefusalPlace>,
    );
    // Nobody held: that tab has no count.
    await expect.element(page.getByRole("link", { name: copy.tabs.held, exact: true })).toBeVisible();
    await page.getByRole("button", { name: copy.letIn }).click();
    await expect.element(page.getByText(copy.refused["no-link"])).toBeVisible();
  });

  it("says who let someone in, the check or a staff member, and that the link waits, with their supporter page", async () => {
    await render(
      <WaitingRoom
        state="let-in"
        people={[exampleLetIn, exampleLetInByStaff]}
        counts={exampleCounts}
        actions={actions()}
      />,
    );
    await expect.element(page.getByText(copy.letInByCheck(staffTime(exampleLetIn.decidedAt!)))).toBeVisible();
    await expect.element(page.getByText(copy.linkNotSent)).toBeVisible();
    await expect.element(page.getByRole("heading", { name: "06 12 34 56 78" })).not.toBeInTheDocument();
    await expect.element(page.getByRole("heading", { name: "+33612345678" })).toBeVisible();
    await expect.element(page.getByRole("link", { name: "Jane" })).toHaveAttribute("href", "/staff/supporters/7");
    expect(page.getByRole("button", { name: copy.letIn }).elements()).toHaveLength(0);
  });

  it("says when the check couldn't say why someone was held", async () => {
    await render(
      <WaitingRoom
        state="held"
        people={[{ ...exampleHeld, heldWhy: null }]}
        counts={exampleCounts}
        actions={actions()}
      />,
    );
    await expect.element(page.getByText(copy.heldUnasked, { exact: false })).toBeVisible();
  });

  it("says who dismissed someone, and that there's nobody on an empty tab", async () => {
    await render(<WaitingRoomExample state="dismissed" people={[exampleDismissed]} link={exampleLink} />);
    await expect.element(page.getByText("Crypto Gains")).toBeVisible();
    await render(<WaitingRoomExample state="held" people={[]} />);
    await expect.element(page.getByText(copy.none.held)).toBeVisible();
  });
});

describe("CommunityLinkButton", () => {
  it("opens on the link, without its https://, and who set it; refuses one that isn't a link, and closes once one's saved", async () => {
    const setLink = vi
      .fn<WaitingRoomActions["setLink"]>()
      .mockResolvedValueOnce(refused("not-a-link"))
      .mockResolvedValueOnce({ ok: true });
    await render(
      <RefusalPlace>
        <CommunityLinkButton link={exampleLink} setLink={setLink} />
      </RefusalPlace>,
    );
    await page.getByRole("button", { name: copy.link.title }).click();
    await expect.element(page.getByText("chat.whatsapp.com/ExampleInvite", { exact: true })).toBeVisible();
    const field = page.getByRole("textbox", { name: copy.link.label });
    await field.fill("https://example.com/x");
    await page.getByRole("button", { name: copy.link.save }).click();
    await expect.element(page.getByText(copy.refused["not-a-link"])).toBeVisible();
    await field.fill("https://chat.whatsapp.com/New");
    await page.getByRole("button", { name: copy.link.save }).click();
    // Saved, the bubble closes.
    await expect.poll(() => document.querySelector("[popover]")?.matches(":popover-open")).toBe(false);
    expect(setLink.mock.calls[1][0].get("link")).toBe("https://chat.whatsapp.com/New");
  });

  it("asks for a link while none is set", async () => {
    await render(<CommunityLinkButton setLink={vi.fn()} />);
    await page.getByRole("button", { name: copy.link.set }).click();
    await expect.element(page.getByRole("textbox", { name: copy.link.label })).toBeVisible();
  });
});
