import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import BroadcastFor, { BroadcastContact, BroadcastWho } from "./BroadcastFor";
import {
  exampleBroadcastData,
  exampleBroadcastEmail,
  exampleBroadcastSent,
  exampleSupporterChoices,
} from "./BroadcastWriter.examples";
import { supportersCopy } from "../supporters/copy";
import { mailingsCopy } from "../mailings/copy";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import { BroadcastForExample } from "./BroadcastFor.gallery.client";

const { leavePage } = vi.hoisted(() => ({ leavePage: vi.fn() }));
vi.mock("@/lib/leave-page.client", () => ({ leavePage }));
afterEach(() => leavePage.mockClear());

const copy = broadcastsCopy.broadcastPages;
const nothing = async () => {};

function fakeActions() {
  let version = 4;
  const action = (answer: () => unknown) => vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => answer());
  return {
    save: action(() => ({ saved: true, version: ++version })),
    attach: action(() => ({ saved: true, version: ++version, attachments: [] })),
    detach: action(() => ({ saved: true, version: ++version, attachments: [] })),
    sendTest: action(() => ({ sent: true, id: "m", to: "me@pauseai.uk" })),
    schedule: action(() => ({ scheduled: true })),
    deleteDraft: vi.fn(async () => {}),
    changeConsent: action(() => true),
    setAboutEvents: action(() => true),
    create: vi.fn(async () => {}),
    submitTemplate: action(() => "submitted"),
    withdrawTemplate: action(() => true),
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

  // The labels of the band's facts.
  const terms = () => [...document.querySelector("dl")!.querySelectorAll("dt")].map((term) => term.textContent);

  it("shows one sent, the rest of its filters as pills, Only those, beside what they said yes to", async () => {
    await render(<BroadcastFor data={exampleBroadcastSent} actions={actions} />);
    await expect.element(page.getByText(copy.recipientsTitle)).toBeVisible();
    expect(terms()).toContain(copy.facts.onlyThose);
  });

  it("shows one sent to everyone who said yes as how many under what they said yes to, with no Only those", async () => {
    const written = {
      ...exampleBroadcastSent.written,
      filter: { list: "supporters" as const, params: { contact: "email:events:yes" } },
    };
    await render(<BroadcastFor data={{ ...exampleBroadcastSent, written }} actions={actions} />);
    const saidYes = page.getByText(copy.facts.saidYes, { exact: true }).element().parentElement!;
    expect(saidYes.textContent).toContain(mailingsCopy.campaigns.supporters(exampleBroadcastSent.summary.to));
    expect(terms()).not.toContain(copy.facts.onlyThose);
    await expect.element(page.getByText(copy.everyoneWhoSaidYes)).not.toBeInTheDocument();
  });

  it("says what they said yes to apart, and the other filters as pills, or everyone who did", async () => {
    const supporters = supportersCopy.supporters.subscriptions.consents;
    const view = await render(
      <>
        <p>
          <BroadcastContact params={{ contact: "text:events:yes" }} />
        </p>
        <p>
          <BroadcastContact params={{ contact: "email:events:yes" }} />
        </p>
        <p>
          <BroadcastContact params={{ contact: ["email:newsletter:yes", "email:events:yes"] }} />
        </p>
        <BroadcastWho params={{ contact: "email:newsletter:yes", near: "LS1" }} choices={exampleSupporterChoices} />
      </>,
    );
    await expect.element(page.getByText(supporters["text:events"])).toBeVisible();
    await expect.element(page.getByText(supporters["email:events"])).toBeVisible();
    await expect
      .element(
        page.getByText(staffVocabulary.filters.anyOf([supporters["email:newsletter"], supporters["email:events"]])),
      )
      .toBeVisible();
    const pills = page.getByRole("list", { name: mailingsCopy.mailingPages.whoLabel }).getByRole("listitem");
    await expect.element(pills.first()).toBeVisible();
    expect(pills.all().map((pill) => pill.element().textContent)).toHaveLength(1);
    await view.unmount();
    await render(<BroadcastWho params={{ contact: "text:events:yes" }} choices={exampleSupporterChoices} />);
    await expect.element(page.getByText(copy.everyoneWhoSaidYes)).toBeVisible();
  });
});

describe("BroadcastFor's example in the gallery", () => {
  it("draws a broadcast sent", async () => {
    await render(<BroadcastForExample />);
    await expect.element(page.getByText(mailingsCopy.mailingPages.states.sent, { exact: true }).first()).toBeVisible();
  });
});
