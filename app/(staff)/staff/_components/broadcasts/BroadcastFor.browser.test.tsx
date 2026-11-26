import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import BroadcastFor, { BroadcastContact, BroadcastWho } from "./BroadcastFor";
import {
  exampleBroadcastData,
  exampleBroadcastEmail,
  exampleBroadcastSent,
  exampleSupporterChoices,
} from "./BroadcastWriter.examples";
import { mailingsCopy } from "../mailings/copy";
import { supportersCopy } from "../supporters/copy";

const lists = supportersCopy.supporters.filters.lists;
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import { BroadcastForExample } from "./BroadcastFor.gallery.client";

const { leavePage } = vi.hoisted(() => ({ leavePage: vi.fn() }));
vi.mock("@/lib/leave-page.client", () => ({ leavePage }));
afterEach(() => leavePage.mockClear());

const copy = broadcastsCopy.broadcastPages;
const nothing = async () => ({ ok: true as const });

function fakeActions() {
  let version = 4;
  const action = (answer: () => unknown) => vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => answer());
  return {
    save: action(() => ({ ok: true, version: ++version })),
    attach: action(() => ({ ok: true, version: ++version, attachments: [] })),
    detach: action(() => ({ ok: true, version: ++version, attachments: [] })),
    sendTest: action(() => ({ ok: true, to: "me@pauseai.uk" })),
    schedule: action(() => ({ ok: true, scheduled: true })),
    deleteDraft: vi.fn(async () => ({ ok: true })),
    changeConsent: action(() => ({ ok: true, version: 5 })),
    create: vi.fn(async () => ({ ok: true })),
    submitTemplate: action(() => ({ ok: true, taken: true })),
    withdrawTemplate: action(() => ({ ok: true })),
    deleteTemplate: action(() => ({ ok: true })),
    linkCard: action(() => ({ ok: true, card: null })),
    findPlaces: action(() => ({ ok: true, places: [] })),
  };
}

describe("BroadcastFor", () => {
  const actions = {
    ...fakeActions(),
    stop: nothing,
    reschedule: nothing,
    resume: nothing,
  } as unknown as Parameters<typeof BroadcastFor>[0]["actions"];

  it("shows a draft to write", async () => {
    await render(
      <BroadcastFor
        data={{ kind: "draft", draft: exampleBroadcastEmail, ...exampleBroadcastData }}
        actions={actions}
      />,
    );
    await expect.element(page.getByRole("heading", { name: copy.sections.write })).toBeVisible();
  });

  // The band's fact of who it's to: its label, its pills or everyone who said yes, and what they said yes to under.
  const to = () => page.getByText(copy.facts.to(exampleBroadcastSent.summary.to)).element().parentElement!;

  it("shows one sent to so many, the rest of its filters as pills, what they said yes to under them", async () => {
    await render(<BroadcastFor data={exampleBroadcastSent} actions={actions} />);
    await expect.element(page.getByText(copy.recipientsTitle)).toBeVisible();
    expect(to().querySelector("ul")).not.toBeNull();
    expect(to().textContent).toContain(copy.onList(lists.updates, "email"));
  });

  it("shows one sent to everyone who said yes as that, with no pills", async () => {
    const written = {
      ...exampleBroadcastSent.written,
      filter: { list: "supporters" as const, params: { contact: "email:events:yes" } },
    };
    await render(<BroadcastFor data={{ ...exampleBroadcastSent, written }} actions={actions} />);
    expect(to().textContent).toContain(copy.everyoneOnList);
    expect(to().querySelector("ul")).toBeNull();
  });

  it("names the list it went to in few words, one from before the lists as the one covering it, and the other filters as pills, or everyone who did", async () => {
    const view = await render(
      <>
        <p>
          <BroadcastContact params={{ contact: "text:newsletter:yes text:events:yes" }} />
        </p>
        <p>
          <BroadcastContact
            params={{ contact: ["email:newsletter:yes", "email:events:yes", "email:volunteering:yes"] }}
          />
        </p>
        <BroadcastWho params={{ contact: "email:newsletter:yes", near: "LS1" }} choices={exampleSupporterChoices} />
      </>,
    );
    await expect.element(page.getByText(copy.onList(lists["updates-luma"], "text"))).toBeVisible();
    await expect.element(page.getByText(copy.onList(lists["updates-luma"], "email"))).toBeVisible();
    const pills = page.getByRole("list", { name: mailingsCopy.mailingPages.whoLabel }).getByRole("listitem");
    await expect.element(pills.first()).toBeVisible();
    expect(pills.all()).toHaveLength(1);
    await view.unmount();
    await render(<BroadcastWho params={{ contact: "text:events:yes" }} choices={exampleSupporterChoices} />);
    await expect.element(page.getByText(copy.everyoneOnList)).toBeVisible();
  });
});

describe("BroadcastFor's example in the gallery", () => {
  it("draws a broadcast sent", async () => {
    await render(<BroadcastForExample />);
    await expect.element(page.getByText(mailingsCopy.mailingPages.states.sent, { exact: true }).first()).toBeVisible();
  });
});
