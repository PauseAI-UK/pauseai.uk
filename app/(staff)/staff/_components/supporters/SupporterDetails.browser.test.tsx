import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { campaigns } from "@/lib/content/email-your-mp";
import SupporterDetails from "./SupporterDetails";
import { exampleMemberDetails, exampleSupporter, exampleSupporterDetails } from "./SupportersTable.examples";
import { supportersCopy } from "./copy";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { lettersCopy } from "../letters/copy";

/** Opens every folded part of the page, such as a supporter's history. */
function openHistory() {
  for (const details of document.querySelectorAll("details")) details.open = true;
}

describe("SupporterDetails", () => {
  it("lists their events by when each starts, latest first, one no longer copied last, undated", async () => {
    const [registered] = exampleSupporterDetails.activity.filter((a) => a.kind === "luma-registered");
    const activity = [
      { ...registered, title: "Earlier", eventAt: new Date("2026-09-01T18:00:00Z") },
      { ...registered, title: "Gone", eventAt: null },
      { ...registered, title: "Later", eventAt: new Date("2026-11-01T18:00:00Z") },
    ];
    await render(<SupporterDetails supporter={{ ...exampleSupporterDetails, activity }} />);
    const events = page.getByRole("region", { name: supportersCopy.supporters.detail.eventsTitle, exact: false });
    expect(
      [...events.element().querySelectorAll("tbody tr")].map((tr) =>
        [...(tr as HTMLTableRowElement).cells].slice(2).map((td) => td.textContent),
      ),
    ).toEqual([
      ["Later", "1 Nov 2026"],
      ["Earlier", "1 Sept 2026"],
      ["Gone", "–"],
    ]);
  });

  it("shows the band, whether we can contact them, their events and letters, then the history and all we hold", async () => {
    const copy = supportersCopy.supporters;
    const first = await render(<SupporterDetails supporter={exampleSupporterDetails} />);
    await expect.element(page.getByRole("heading", { level: 1, name: "Jane Example" })).toBeVisible();
    // In the band over the card: where she is, from her postcode, on a map; her MP; when she was active, and
    // how she first came; and how many events and letters, as plain numbers, the tables being just below.
    const band = page.getByText(copy.detail.theirMp).element().closest("[class^=_band_]")!;
    expect(band.querySelector("svg circle")).not.toBeNull();
    await expect.element(page.getByText("Manchester, England", { exact: true })).toBeVisible();
    await expect.element(page.getByText(copy.detail.placeFrom.postcode("M1 1AE"), { exact: true })).toBeVisible();
    expect(band.querySelector("a[href='/staff/politicians/1']")!.textContent).toBe("Polly Placeholder");
    expect(band.textContent).toContain("Manchester Central · Labour (Co-op)");
    expect(band.textContent).toContain(copy.detail.firstCame.luma);
    const counts = band.querySelector("[class*=counts]")!;
    expect(counts.querySelector("a")).toBeNull();
    expect([...counts.children].map((count) => count.textContent)).toEqual([
      `1 ${copy.detail.eventsCounted(1)}`,
      `1 ${copy.detail.lettersCounted(1)}`,
    ]);
    // Everything we hold, folded at the foot: each value as a source gave it, what it is, from where, and when.
    openHistory();
    const held = [...document.getElementById("everything")!.closest("details")!.querySelectorAll("tbody tr")].map(
      (tr) => [...(tr as HTMLTableRowElement).cells].map((td) => td.textContent),
    );
    expect(held).toContainEqual(["1 Mar 2026", copy.detail.emails, "jane@example.com", copy.sources.luma]);
    expect(held.map(([, what, value]) => [what, value])).toEqual(
      expect.arrayContaining([
        [copy.detail.postcode, "M1 1AE"],
        // Her number, given to Luma, is one we may not use since she unsubscribed: marked, and no link.
        [copy.detail.phone, `07700 900001 ${copy.detail.unusable}`],
      ]),
    );
    await expect.element(page.getByRole("link", { name: "07700 900001" })).not.toBeInTheDocument();
    // Beside the profile, her events and her letters, a table each.
    // The event she registered for and hosts is two rows, one event in the band.
    const events = page.getByRole("region", { name: copy.detail.eventsTitle, exact: false });
    await expect
      .element(events.getByRole("link", { name: "PauseAI Manchester Social" }).first())
      .toHaveAttribute("href", "https://luma.com/fixture-manchester-social");
    // When she registered or became host, her part in it, which event, and when it is.
    const eventRows = () =>
      [...events.element().querySelectorAll("tbody tr")].map((tr) =>
        [...(tr as HTMLTableRowElement).cells].map((td) => td.textContent),
      );
    expect(eventRows()).toEqual([
      ["20 Sept 2026", copy.detail.registered, "PauseAI Manchester Social", "1 Oct 2026"],
      ["10 Aug 2026", copy.detail.host, "PauseAI Manchester Social", "1 Oct 2026"],
    ]);
    const letters = page.getByRole("region", { name: copy.detail.lettersTitle });
    await expect
      .element(letters.getByRole("link", { name: "Polly Placeholder" }))
      .toHaveAttribute("href", "/staff/politicians/1");
    await expect
      .element(letters.getByRole("link", { name: staffVocabulary.letterAndReplies(1) }))
      .toHaveAttribute("href", "/staff/letters/12");
    // So does the same letter in the history.
    expect(document.querySelector('a[href="/staff/letters/99"]')).not.toBeNull();
    // Beside the facts, whether we'd contact her about each topic: by email, and by the phone she gave Luma.
    const subscriptions = page.getByRole("region", { name: copy.detail.listsTitle });
    await expect
      .element(
        subscriptions.getByText(
          copy.detail.permissions.reasons.unsubscribed("12 Oct 2026", copy.detail.permissions.sources.luma),
          {
            exact: false,
          },
        ),
      )
      .toHaveLength(2);
    // When we've known her, the year said once, as both days are in it.
    await expect.element(page.getByText("1 Mar – 12 Oct 2026", { exact: true })).toBeVisible();
    // The history, folded until opened: what, linked, with a status only when it isn't approved.
    const history = page.getByRole("list", { name: copy.detail.activityTitle });
    await expect
      .element(history.getByRole("link", { name: "PauseAI Manchester Social" }).first())
      .toHaveAttribute("href", "https://luma.com/fixture-manchester-social");
    expect(history.element().textContent).toContain(`${copy.detail.kinds["luma-hosted"]} PauseAI Manchester Social`);
    expect(history.element().textContent).not.toContain("approved");
    // A letter: the MP links to their page, the campaign to its public page, and the letter's status follows.
    await expect
      .element(history.getByRole("link", { name: "Polly Placeholder" }).first())
      .toHaveAttribute("href", "/staff/politicians/1");
    await expect
      .element(history.getByRole("link", { name: campaigns[0].title }).first())
      .toHaveAttribute("href", `/staff/campaigns/${campaigns[0].slug}`);
    expect(history.element().textContent).toContain(
      `${copy.detail.kinds.letter} Polly Placeholder ${copy.detail.about} ${campaigns[0].title} · ${lettersCopy.letters.status.sent}`,
    );

    await expect.element(history.getByText(copy.lists["events"], { exact: false })).toBeVisible();
    await expect.element(history.getByText(copy.detail.kinds["luma-contact"], { exact: false })).toBeVisible();

    // A letter for a campaign nobody runs any more, with no page to link: its name and status as stored.
    await first.rerender(
      <SupporterDetails
        supporter={{
          ...exampleSupporterDetails,
          activity: [
            {
              source: "email-your-mp",
              at: new Date("2026-10-05T09:00:00Z"),
              kind: "letter",
              title: "old-campaign",
              campaignTitle: "Old campaign, from pauseai.info",
              detail: "Gone MP",
              href: null,
              status: "mislaid",
            },
          ],
        }}
      />,
    );
    openHistory();
    const old = page.getByRole("list", { name: copy.detail.activityTitle });
    expect(old.element().textContent).toContain(
      `${copy.detail.kinds.letter} Gone MP ${copy.detail.about} Old campaign, from pauseai.info · mislaid`,
    );
    // Only the campaign's name links, as this one's letter can't be found; its status stays plain.
    expect(
      old
        .getByRole("link")
        .all()
        .map((link) => link.element().getAttribute("href")),
    ).toEqual(["/staff/campaigns/old-campaign"]);

    // The same postcode, typed differently by two sources.
    await first.unmount();
    const { unmount } = await render(
      <SupporterDetails
        supporter={{
          ...exampleSupporterDetails,
          summary: exampleSupporter,
          contacts: [
            {
              source: "email-your-mp",
              at: new Date("2026-10-05T09:00:00Z"),
              phone: null,
              postcode: "m11ae",
              latitude: null,
              longitude: null,
              city: null,
            },
            {
              source: "luma",
              at: new Date("2026-09-20T10:00:00Z"),
              phone: null,
              postcode: "M1  1AE",
              latitude: null,
              longitude: null,
              city: null,
            },
          ],
        }}
      />,
    );
    // Everything we hold has each as its source gave it, oldest first, in the usual form.
    openHistory();
    const postcodes = [...document.getElementById("everything")!.closest("details")!.querySelectorAll("tbody tr")]
      .map((tr) => [...(tr as HTMLTableRowElement).cells].map((td) => td.textContent))
      .filter(([, what]) => what === copy.detail.postcode);
    expect(postcodes).toEqual([
      ["20 Sept 2026", copy.detail.postcode, "M1 1AE", copy.sources.luma],
      ["5 Oct 2026", copy.detail.postcode, "M1 1AE", copy.sources["email-your-mp"]],
    ]);
    await unmount();
  });

  it("puts what it's given to erase them at the end of everything we hold", async () => {
    await render(<SupporterDetails supporter={exampleSupporterDetails} erase={<button type="button">Erase</button>} />);
    openHistory();
    expect(
      page.getByRole("button", { name: "Erase" }).element().closest("details")!.querySelector("#everything"),
    ).not.toBeNull();
  });

  it("copes with a supporter who has no name, nothing given and no activity, and with unknown statuses, lists and campaigns", async () => {
    const copy = supportersCopy.supporters;
    await render(
      <SupporterDetails
        supporter={{
          mp: null,
          letters: [
            {
              id: 5,
              sentAt: null,
              mpName: "An MP",
              politicianId: 9,
              isTest: false,
              campaign: "gone-campaign",
              campaignTitle: "Gone campaign",
              status: "odd",
              replies: 0,
            },
          ],
          summary: {
            ...exampleSupporter,
            name: null,
            lumaContact: false,
            events: 0,
            letters: 0,
            firstSeenAt: null,
            lastActiveAt: null,
          },
          identities: [{ source: "luma", email: "x@example.com", name: "", seenAt: null }],
          contacts: [],
          activity: [
            {
              source: "luma",
              at: new Date("2026-01-01T00:00:00Z"),
              kind: "luma-registered",
              title: "Thing",
              campaignTitle: null,
              detail: "waitlist",
              href: null,
              status: null,
            },
            {
              source: "luma",
              at: new Date("2026-01-01T00:00:00Z"),
              kind: "luma-registered",
              title: "Other",
              campaignTitle: null,
              detail: "session",
              href: null,
              status: null,
            },
            {
              source: "luma",
              at: new Date("2026-01-01T00:00:00Z"),
              kind: "luma-registered",
              title: "Bare",
              campaignTitle: null,
              detail: null,
              href: null,
              status: null,
            },
            {
              source: "x",
              at: new Date("2026-01-02T00:00:00Z"),
              kind: "opted-out",
              title: "other-list",
              campaignTitle: null,
              detail: null,
              href: null,
              status: null,
            },
            {
              source: "staff",
              at: new Date("2026-01-02T00:00:00Z"),
              kind: "opted-out",
              title: "newsletter",
              campaignTitle: null,
              detail: "x@example.com",
              href: null,
              status: null,
              how: "At a stall",
              recordedBy: "jo@pauseai.uk",
            },
            {
              source: "reply",
              at: new Date("2026-01-02T00:00:00Z"),
              kind: "opted-out",
              title: "events",
              campaignTitle: null,
              detail: "x@example.com",
              href: null,
              status: null,
              how: null,
              recordedBy: "sam@pauseai.uk",
              thread: "/staff/broadcasts/3/7",
            },
            {
              source: "reply",
              at: new Date("2026-01-02T00:00:00Z"),
              kind: "opted-out",
              title: "volunteering",
              campaignTitle: null,
              detail: "x@example.com",
              href: null,
              status: null,
              how: null,
              recordedBy: "lee@pauseai.uk",
              thread: null,
            },
            {
              source: "link",
              at: new Date("2026-01-02T00:00:00Z"),
              kind: "opted-out",
              title: "newsletter",
              campaignTitle: null,
              detail: "y@example.com",
              href: null,
              status: null,
              thread: "/staff/broadcasts/3/8",
            },
            {
              source: "x",
              at: new Date("2026-01-02T00:00:00Z"),
              kind: "resubscribed",
              title: null,
              campaignTitle: null,
              detail: "x@example.com",
              href: null,
              status: null,
            },
            {
              source: "email-your-mp",
              at: new Date("2026-01-03T00:00:00Z"),
              kind: "letter",
              title: "gone-campaign",
              campaignTitle: "Gone campaign",
              detail: "An MP",
              href: null,
              status: "sent",
            },
            {
              source: "email-your-mp",
              at: new Date("2026-01-03T00:00:00Z"),
              kind: "letter",
              title: null,
              campaignTitle: null,
              detail: "No campaign MP",
              href: null,
              status: null,
            },
            {
              source: "email-your-mp",
              at: new Date("2026-01-04T00:00:00Z"),
              kind: "letter-replied",
              title: null,
              campaignTitle: null,
              detail: null,
              href: null,
              status: null,
            },
          ],
          permissions: [],
        }}
      />,
    );
    await expect.element(page.getByRole("heading", { level: 1, name: copy.noName })).toBeVisible();
    openHistory();
    await expect.element(page.getByText(copy.sources.luma, { exact: true }).first()).toBeVisible();
    await expect.element(page.getByText("Thing", { exact: false }).first()).toBeVisible();
    await expect.element(page.getByText(copy.detail.statuses.waitlist, { exact: false }).first()).toBeVisible();
    await expect.element(page.getByText("other-list", { exact: false })).toBeVisible();
    // An opt-out staff recorded says who, and how the person told them, or that it was their reply.
    await expect
      .element(page.getByText(copy.detail.toldStaff("jo@pauseai.uk", "At a stall"), { exact: false }))
      .toBeVisible();
    await expect
      .element(page.getByText(copy.detail.fromReply("sam@pauseai.uk").trim(), { exact: false }))
      .toBeVisible();
    // "their reply" links to it, in its thread, where it's kept.
    await expect
      .element(page.getByRole("link", { name: copy.detail.theirReply }))
      .toHaveAttribute("href", "/staff/broadcasts/3/7");
    await expect
      .element(page.getByText(copy.detail.fromReply("lee@pauseai.uk").trim(), { exact: false }))
      .toBeVisible();
    // One by an email's link: the email it came from.
    await expect
      .element(page.getByRole("link", { name: copy.detail.theEmail }))
      .toHaveAttribute("href", "/staff/broadcasts/3/8");
    await expect.element(page.getByText("Gone campaign", { exact: false }).first()).toBeVisible();
    // A letter's status, as stored when it's no status we know, beside the link to its page.
    await expect.element(page.getByText("odd", { exact: false }).first()).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: staffVocabulary.theLetter }).last())
      .toHaveAttribute("href", "/staff/letters/5");
  });

  it("says where they are and what it's from, and nothing when we don't know", async () => {
    const copy = supportersCopy.supporters;
    const place = (basis: "postcode" | "city" | "event", given: string) => ({
      ...exampleSupporterDetails,
      summary: { ...exampleSupporter, place: { name: "Leicester", basis, given, country: "england" } },
    });
    const { rerender } = await render(<SupporterDetails supporter={place("postcode", "LE1 1AA")} />);
    await expect.element(page.getByText("Leicester, England", { exact: true })).toBeVisible();
    await expect.element(page.getByText(copy.detail.placeFrom.postcode("LE1 1AA"), { exact: true })).toBeVisible();
    await rerender(<SupporterDetails supporter={place("event", "PauseAI Leicester meetup")} />);
    await expect
      .element(page.getByText(copy.detail.placeFrom.event("PauseAI Leicester meetup"), { exact: true }))
      .toBeVisible();
    await rerender(<SupporterDetails supporter={place("city", "Leicester")} />);
    await expect.element(page.getByText(copy.detail.placeFrom.city(""), { exact: true })).toBeVisible();
    await rerender(
      <SupporterDetails
        supporter={{
          ...exampleSupporterDetails,
          summary: { ...exampleSupporter, place: { name: null, basis: "city", given: "x", country: null } },
        }}
      />,
    );
    expect(page.getByText(copy.detail.place, { exact: true }).all()).toHaveLength(0);
  });

  it("puts the place on a map of the UK, a dot on the coast's line, when it's in the UK and we know where", async () => {
    const at = (latitude?: number | null, longitude?: number | null) => ({
      ...exampleSupporterDetails,
      summary: {
        ...exampleSupporter,
        place: { name: "Leeds", basis: "city" as const, given: "Leeds", country: "england", latitude, longitude },
      },
    });
    const map = () => document.querySelector("[class^=_band_] > svg");
    const { rerender } = await render(<SupporterDetails supporter={at(53.8, -1.55)} />);
    expect(map()!.querySelector("path")!.getAttribute("d")).toMatch(/^M/);
    const dot = map()!.querySelector("circle")!;
    // Leeds is in the north of England: below the middle of the map's height, right of its middle.
    expect(Number(dot.getAttribute("cy"))).toBeGreaterThan(50);
    expect(Number(dot.getAttribute("cx"))).toBeGreaterThan(30);
    const box = map()!.getBoundingClientRect();
    expect(box.height).toBeGreaterThan(box.width);
    for (const [latitude, longitude] of [
      [40.7, -74],
      [null, -1.55],
      [53.8, null],
      [undefined, undefined],
    ]) {
      await rerender(<SupporterDetails supporter={at(latitude, longitude)} />);
      expect(map()).toBeNull();
    }
  });

  it("leaves out of the band what it doesn't know: a nation, an MP's party, how they first came", async () => {
    const copy = supportersCopy.supporters;
    await render(
      <SupporterDetails
        supporter={{
          ...exampleSupporterDetails,
          summary: { ...exampleSupporter, place: { name: "Douglas", basis: "city", given: "Douglas", country: null } },
          mp: { id: 2, name: "Ivy Independent", constituency: "Somewhere", party: "" },
          identities: [],
          activity: [],
        }}
      />,
    );
    await expect.element(page.getByText("Douglas", { exact: true })).toBeVisible();
    await expect.element(page.getByText("Somewhere", { exact: true })).toBeVisible();
    expect(document.body.textContent).not.toContain(copy.detail.firstCame.luma);
  });

  it("says a member first came by joining PauseAI", async () => {
    const copy = supportersCopy.supporters;
    await render(
      <SupporterDetails
        supporter={{
          ...exampleSupporterDetails,
          identities: [
            { source: "civicrm", email: "jane@example.com", name: "Jane", seenAt: new Date("2026-03-01T10:00:00Z") },
          ],
        }}
      />,
    );
    expect(document.body.textContent).toContain(copy.detail.firstCame.civicrm);
  });

  it("says each year when we've known them across two, and one day when it's all they were seen", async () => {
    const known = (first: string, last: string) => (
      <SupporterDetails
        supporter={{
          ...exampleSupporterDetails,
          summary: { ...exampleSupporter, firstSeenAt: new Date(first), lastActiveAt: new Date(last) },
        }}
      />
    );
    const { rerender } = await render(known("2025-12-01T12:00:00Z", "2026-01-05T12:00:00Z"));
    await expect.element(page.getByText("1 Dec 2025 – 5 Jan 2026", { exact: true })).toBeVisible();
    await rerender(known("2026-02-14T09:00:00Z", "2026-02-14T17:00:00Z"));
    await expect.element(page.getByText("14 Feb 2026", { exact: true })).toBeVisible();
  });

  it("counts only what there is any of: events, letters, broadcasts sent and notes, or no box at all", async () => {
    const copy = supportersCopy.supporters;
    const nothing = { ...exampleSupporterDetails, activity: [], letters: [] };
    const counts = () =>
      [...(document.querySelector("[class*=counts]")?.children ?? [])].map((count) => count.textContent);
    const { rerender } = await render(<SupporterDetails supporter={nothing} />);
    expect(counts()).toEqual([]);
    await rerender(<SupporterDetails supporter={nothing} sentAndNoted={{ broadcasts: 3, notes: 1 }} />);
    expect(counts()).toEqual([`3 ${copy.detail.broadcastsCounted(3)}`, `1 ${copy.detail.notesCounted(1)}`]);
  });

  it("says when there are no events or letters", async () => {
    await render(<SupporterDetails supporter={{ ...exampleSupporterDetails, activity: [], letters: [] }} />);
    await expect.element(page.getByText(supportersCopy.supporters.detail.noEvents)).toBeVisible();
    await expect.element(page.getByText(supportersCopy.supporters.detail.noLetters)).toBeVisible();
  });

  it("with no history, still opens it, its count 0, to say so", async () => {
    await render(<SupporterDetails supporter={{ ...exampleSupporterDetails, activity: [] }} />);
    const title = supportersCopy.supporters.detail.activityTitle;
    const history = page.getByRole("heading", { name: title }).element().closest("details")!;
    expect(history.querySelector("summary")!.textContent).toBe(`${title} 0`);
    history.open = true;
    await expect.element(page.getByText(supportersCopy.supporters.detail.noActivity)).toBeVisible();
  });

  it("holds every value as each source gave it, a kind at a time, oldest first, one with no date before them", async () => {
    const copy = supportersCopy.supporters;
    await render(
      <SupporterDetails
        supporter={{
          ...exampleSupporterDetails,
          identities: [
            {
              source: "email-your-mp",
              email: "jane@example.com",
              name: "Jane",
              seenAt: new Date("2026-10-05T09:00:00Z"),
            },
            { source: "luma", email: "jane@example.com", name: "", seenAt: new Date("2026-03-01T10:00:00Z") },
            { source: "luma", email: "jane@example.com", name: "", seenAt: null },
            { source: "email-your-mp", email: "old@example.com", name: "", seenAt: null },
          ],
          contacts: [],
          activity: [],
        }}
      />,
    );
    openHistory();
    const held = [...document.getElementById("everything")!.closest("details")!.querySelectorAll("tbody tr")].map(
      (tr) => [...(tr as HTMLTableRowElement).cells].map((td) => td.textContent),
    );
    const letter = copy.sources["email-your-mp"];
    // A name only where a source gave one; every email, each as its source gave it.
    expect(held).toEqual([
      ["5 Oct 2026", copy.detail.held.name, "Jane", letter],
      ["", copy.detail.emails, "jane@example.com", copy.sources.luma],
      ["", copy.detail.emails, "old@example.com", letter],
      ["1 Mar 2026", copy.detail.emails, "jane@example.com", copy.sources.luma],
      ["5 Oct 2026", copy.detail.emails, "jane@example.com", letter],
    ]);
  });
});

describe("SupporterDetails, a march sign-up", () => {
  const copy = supportersCopy.supporters;
  const entry = {
    source: "march-2026-11",
    at: new Date("2026-10-20T10:00:00Z"),
    kind: "form-entry" as const,
    title: "march-2026-11",
    campaignTitle: null,
    detail: "nl",
    href: null,
    status: "skipped",
  };

  it("says the form in the history, the link they came by and what Luma said, where there's either", async () => {
    await render(
      <SupporterDetails
        supporter={{
          ...exampleMemberDetails,
          activity: [
            entry,
            { ...entry, detail: null },
            { ...entry, detail: null, status: null, title: "a-new-form" },
            { ...entry, detail: null, status: null, title: null },
            { ...entry, detail: "Flyering", status: null, title: "paper-signup" },
          ],
        }}
      />,
    );
    openHistory();
    const lines = page
      .getByRole("list", { name: copy.detail.activityTitle })
      .getByRole("listitem")
      .all()
      .map((item) => item.element().textContent!.replace(/^\d+ \w+ \d{4}, \d\d:\d\d/, ""));
    const form = `${copy.detail.kinds["form-entry"]} ${copy.sources["march-2026-11"]}`;
    expect(lines).toEqual([
      `${form} · ${copy.detail.cameFrom("nl")} · ${copy.detail.luma.skipped}`,
      `${form} · ${copy.detail.luma.skipped}`,
      `${copy.detail.kinds["form-entry"]} a-new-form`,
      `${copy.detail.kinds["form-entry"]} `,
      `${copy.detail.kinds["form-entry"]} ${copy.sources["paper-signup"]} · Flyering`,
    ]);
  });
});

describe("SupporterDetails, a member", () => {
  const copy = supportersCopy.supporters;
  const joined = exampleMemberDetails.activity[0];

  it("says their city, whether we'd contact them about each topic, and how they joined in the history", async () => {
    await render(<SupporterDetails supporter={exampleMemberDetails} />);
    openHistory();
    const held = [...document.getElementById("everything")!.closest("details")!.querySelectorAll("tbody tr")].map(
      (tr) => [...(tr as HTMLTableRowElement).cells].map((td) => td.textContent),
    );
    expect(held).toContainEqual(["10 Jul 2026", copy.detail.city, "Cardiff", copy.sources.civicrm]);
    await expect
      .element(
        page.getByText(
          copy.detail.permissions.reasons.subscribed("10 Nov 2026", copy.detail.permissions.sources.civicrm),
          {
            exact: false,
          },
        ),
      )
      .toBeVisible();
    const history = page.getByRole("list", { name: copy.detail.activityTitle });
    // CiviCRM gives the day they joined, with no time.
    expect(history.element().textContent).toContain(
      `10 Jul 2026${copy.detail.kinds["member-joined"]} ${copy.detail.intents.volunteer}`,
    );
  });

  it("words a join with less to say, and their leaving to the minute", async () => {
    await render(
      <SupporterDetails
        supporter={{
          ...exampleMemberDetails,
          activity: [
            { ...joined, title: "none" },
            { ...joined, title: null },
            { ...joined, kind: "member-left", title: null },
          ],
        }}
      />,
    );
    openHistory();
    const history = page.getByRole("list", { name: copy.detail.activityTitle });
    const lines = history
      .getByRole("listitem")
      .all()
      .map((item) => item.element().textContent);
    expect(lines).toEqual([
      `10 Jul 2026${copy.detail.kinds["member-joined"]} `,
      `10 Jul 2026${copy.detail.kinds["member-joined"]} `,
      `10 Jul 2026, 00:00${copy.detail.kinds["member-left"]} `,
    ]);
  });
});
