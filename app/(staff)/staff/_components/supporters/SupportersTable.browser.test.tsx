import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { registrationStatus, type SupporterRow } from "@/lib/supporters/supporters";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { subscriptionWords } from "./SubscriptionBadges";
import { supporterBadgeWords } from "./SupporterBadges";
import { supporterWords } from "./SupporterFilters";
import SupportersTable, { supporterColumns, supporterContact } from "./SupportersTable";
import { exampleBlockedPermissions, exampleSupporterRows } from "./SupportersTable.examples";
import { supportersSearch } from "@/lib/staff-search";
import { downloads } from "@/tests/browser/staff";
import { supportersCopy } from "./copy";

describe("SupportersTable", () => {
  it("lists each supporter with a link to their page, their newest email and phone, badges and dates, and pages", async () => {
    const copy = supportersCopy.supporters;
    const search = supportersSearch({ q: "j", page: "2" });
    await render(
      <SupportersTable
        search={search}
        page={{
          supporters: exampleSupporterRows,
          total: 120,
          pages: 3,
        }}
      />,
    );
    await expect.element(page.getByText(copy.total(120))).toBeVisible();
    // No email or phone column without the Subscriptions filter.
    expect(page.getByText(copy.columns.email, { exact: true }).all()).toHaveLength(0);
    expect(await downloads()).toEqual([
      "/staff/supporters/download?q=j&format=csv",
      "/staff/supporters/download?q=j&format=json",
      "/staff/supporters/download?q=j&format=vcf",
    ]);
    await userEvent.keyboard("{Escape}");
    await expect
      .element(page.getByRole("link", { name: "Jane Example" }))
      .toHaveAttribute("href", "/staff/supporters/7");
    await expect.element(page.getByRole("link", { name: copy.noName })).toHaveAttribute("href", "/staff/supporters/8");
    await expect.element(page.getByRole("cell", { name: "1 Mar 2026" }).first()).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: staffVocabulary.paging.previous }))
      .toHaveAttribute("href", "/staff/supporters?q=j");
    await expect
      .element(page.getByRole("link", { name: staffVocabulary.paging.next }))
      .toHaveAttribute("href", "/staff/supporters?q=j&page=3");
  });

  it("says where each is, faint when it's only from an event", async () => {
    const [jane, sam] = exampleSupporterRows;
    await render(
      <SupportersTable
        search={supportersSearch({})}
        page={{
          supporters: [
            { ...jane, place: { name: "Leeds", basis: "postcode", given: "LS1", country: "england" } },
            { ...sam, place: { name: "Oxford", basis: "event", given: "AI risk talk", country: null } },
          ],
          total: 2,
          pages: 1,
        }}
      />,
    );
    await expect.element(page.getByRole("cell", { name: "Leeds" })).toBeVisible();
    expect(page.getByText("Oxford").element().className).toMatch(/muted/);
  });

  it("adds how each stands at the events the Event filter finds, named when several, and when each wrote in its campaign", async () => {
    const copy = supportersCopy.supporters;
    const [jane, sam] = exampleSupporterRows;
    const rows = [
      {
        ...jane,
        registrations: [
          { event: "Leeds meetup", status: "approved" },
          { event: "Oxford talk", status: "waitlist" },
        ],
        wroteAt: new Date("2026-10-03T09:00:00Z"),
      },
      sam,
    ];
    const search = supportersSearch({ event: ["evt-1", "evt-2", "!evt-3"], campaign: "support-sobel-bill" });
    await render(<SupportersTable search={search} page={{ supporters: rows, total: 2, pages: 1 }} />);
    await expect.element(page.getByText(copy.columns.registrations, { exact: true })).toBeVisible();
    await expect.element(page.getByText("Oxford talk:")).toBeVisible();
    await expect
      .element(page.getByRole("listitem").filter({ hasText: "Oxford talk:" }))
      .toHaveTextContent(`Oxford talk: ${registrationStatus("waitlist")}`);
    await expect.element(page.getByText(copy.columns.wrote, { exact: true })).toBeVisible();
    await expect.element(page.getByRole("cell", { name: "3 Oct 2026" })).toBeVisible();
    // A download has them too.
    const text = (columns: ReturnType<typeof supporterColumns>, key: string, row: (typeof rows)[number]) =>
      columns.find((c) => c.key === key)!.text!(row);
    const columns = supporterColumns(search);
    expect(text(columns, "registrations", rows[0])).toBe(
      `Leeds meetup: ${copy.detail.registered}; Oxford talk: ${registrationStatus("waitlist")}`,
    );
    expect(text(columns, "registrations", rows[1])).toBe("");
    expect(text(columns, "wrote", rows[0])).toEqual(new Date("2026-10-03T09:00:00Z"));
    expect(text(columns, "wrote", rows[1])).toBeNull();
    // With one event, its status alone.
    expect(text(supporterColumns(supportersSearch({ event: "evt-1" })), "registrations", rows[0])).toBe(
      `${copy.detail.registered}; ${registrationStatus("waitlist")}`,
    );
    // Neither filter, only an event left out, those who didn't write, or a campaign we don't have: neither column.
    for (const params of [
      {},
      { event: "!evt-1" },
      { campaign: "support-sobel-bill", wrote: "no" },
      { campaign: "no-such-campaign" },
    ]) {
      const keys = supporterColumns(supportersSearch(params)).map((c) => c.key);
      expect(keys).not.toContain("registrations");
      expect(keys).not.toContain("wrote");
    }
    // The Nation filter leaving one out, or finding two, adds their nation after where they are; one found fixes it.
    for (const nation of [["!scotland"], ["wales", "scotland"]]) {
      const keys = supporterColumns(supportersSearch({ nation })).map((c) => c.key);
      expect(keys.indexOf("nation")).toBe(keys.indexOf("place") + 1);
    }
    expect(supporterColumns(supportersSearch({ nation: "wales" })).map((c) => c.key)).not.toContain("nation");
    const nation = supporterColumns(supportersSearch({ nation: "!scotland" })).find((c) => c.key === "nation")!;
    const cardiff = {
      ...rows[0],
      place: { name: "Cardiff", basis: "city" as const, given: "Cardiff", country: "wales" },
    };
    expect(nation.text!(cardiff)).toBe(staffVocabulary.countries.wales);
    expect(nation.cell(cardiff)).toBe(staffVocabulary.countries.wales);
    expect(nation.text!({ ...rows[0], place: null })).toBeNull();
  });

  it("sorts by a heading, reversing when clicked again, and marks the current one", async () => {
    const copy = supportersCopy.supporters;
    await render(
      <SupportersTable
        search={supportersSearch({ activity: "letter", sort: "events", dir: "desc" })}
        page={{ supporters: [exampleSupporterRows[0]], total: 1, pages: 1 }}
      />,
    );
    const events = page.getByRole("link", { name: copy.columns.events });
    await expect.element(events).toHaveAttribute("href", "/staff/supporters?activity=letter&sort=events&dir=asc");
    expect(events.element().closest("th")!.getAttribute("aria-sort")).toBe("descending");
    await expect
      .element(page.getByRole("link", { name: copy.columns.name }))
      .toHaveAttribute("href", "/staff/supporters?activity=letter&sort=name&dir=asc");
  });

  it("on the first of one page, has no paging, and says when nobody is found", async () => {
    const { rerender } = await render(
      <SupportersTable
        search={supportersSearch({})}
        page={{ supporters: [exampleSupporterRows[0]], total: 1, pages: 1 }}
      />,
    );
    await expect.element(page.getByRole("link", { name: "Jane Example" })).toBeVisible();
    expect(page.getByRole("link", { name: staffVocabulary.paging.next }).all()).toHaveLength(0);
    await rerender(
      <SupportersTable
        search={supportersSearch({ page: "2" })}
        page={{ supporters: [exampleSupporterRows[0]], total: 101, pages: 3 }}
      />,
    );
    await expect
      .element(page.getByRole("link", { name: staffVocabulary.paging.previous }))
      .toHaveAttribute("href", "/staff/supporters");
    await expect
      .element(page.getByRole("link", { name: staffVocabulary.paging.next }))
      .toHaveAttribute("href", "/staff/supporters?page=3");
    const nobody = { supporters: [], total: 0, pages: 1 };
    await rerender(<SupportersTable search={supportersSearch({})} page={nobody} />);
    await expect.element(page.getByRole("table").getByText(supportersCopy.supporters.none)).toBeVisible();
    await expect.element(page.getByText(supportersCopy.supporters.total(0))).toBeVisible();
    // Nothing is on, so there's nothing to clear.
    const clear = () => page.getByRole("table").getByRole("link", { name: staffVocabulary.resetFilters });
    expect(clear().all()).toHaveLength(0);
    // A search that finds nobody has the way to clear it, in the row.
    await rerender(<SupportersTable search={supportersSearch({ q: "nobody", sort: "name" })} page={nobody} />);
    await expect.element(clear()).toHaveAttribute("href", "/staff/supporters");
    // Not while choosing who a broadcast goes to, which the filters are for.
    await rerender(<SupportersTable search={supportersSearch({ q: "nobody", broadcast: "5" })} page={nobody} />);
    expect(clear().all()).toHaveLength(0);
  });
});

describe("the supporters list's Email and Phone columns", () => {
  const search = (contact: string[]) => {
    const { filter, ...typed } = supportersSearch({ contact });
    void filter;
    return typed;
  };
  const text = (columns: ReturnType<typeof supporterColumns>, key: string, row: SupporterRow) =>
    columns.find((c) => c.key === key)!.text!(row);

  it("shows neither without the Consent filter, and with it, the addresses and numbers whose answer it finds", async () => {
    expect(supporterColumns(search([])).map((c) => c.key)).not.toEqual(expect.arrayContaining(["email"]));
    expect(supporterColumns(search(["!email:newsletter:yes"])).map((c) => c.key)).not.toContain("email");
    // A value it can't read finds nothing to show.
    expect(supporterColumns(search(["email:nonsense"])).map((c) => c.key)).not.toContain("email");
    // An answer, a topic's any answer, and a reason; each channel's column, of its own.
    const contact = ["email:events:no", "text:events", "email:newsletter:asked"];
    const columns = supporterColumns(search(contact));
    const [jane] = exampleSupporterRows;
    expect(text(columns, "email", jane)).toBe("jane@example.com");
    expect(text(columns, "phone", jane)).toBe("+447700900001");
    expect(text(columns, "email", { ...jane, permissions: exampleBlockedPermissions })).toBe("gus@example.com");
    expect(text(columns, "phone", { ...jane, permissions: exampleBlockedPermissions })).toBe("");
    await render(<SupportersTable search={search(contact)} page={{ supporters: [jane], total: 1, pages: 1 }} />);
    await expect.element(page.getByRole("cell", { name: "jane@example.com" })).toBeVisible();
    // A download keeps the number whole; the page shows it without the country code.
    await expect.element(page.getByRole("cell", { name: "07700 900001" })).toBeVisible();
  });

  it("links a number by the way it's a yes by: to WhatsApp for texts, else to ring it", async () => {
    const [, sam] = exampleSupporterRows;
    const [, , text] = sam.permissions;
    const row = (permissions: SupporterRow["permissions"]) => ({ ...sam, permissions });
    const { rerender } = await render(
      <SupportersTable
        search={search(["text:volunteering", "call:volunteering"])}
        page={{ supporters: [row([text, { ...text, way: "call" }])], total: 1, pages: 1 }}
      />,
    );
    await expect
      .element(page.getByRole("link", { name: "07700 900003" }))
      .toHaveAttribute("href", "https://wa.me/447700900003");
    await rerender(
      <SupportersTable
        search={search(["call:volunteering"])}
        page={{ supporters: [row([{ ...text, way: "call" }])], total: 1, pages: 1 }}
      />,
    );
    await expect.element(page.getByRole("link", { name: "07700 900003" })).toHaveAttribute("href", "tel:+447700900003");
  });
});

describe("the supporters list's Consent reason column", () => {
  const search = (contact: string[]) => supportersSearch({ contact });
  const reasons = supportersCopy.supporters.detail.permissions;
  const column = (contact: string[]) => supporterColumns(search(contact)).find((c) => c.key === "consentReason");

  it("is there only with the Consent filter, finding some rather than leaving them out", () => {
    expect(column([])).toBeUndefined();
    expect(column(["!email:events:no"])).toBeUndefined();
    expect(column(["email:nonsense"])).toBeUndefined();
    expect(column(["email:events:no"])!.label).toBe(supportersCopy.supporters.columns.consentReason);
    expect(column(["text:events"])).toBeDefined();
  });

  it("says why for each answer the filter finds, an address's before a number's, a line each", async () => {
    const [jane] = exampleSupporterRows;
    const contact = ["email:events:no", "text:events:no"];
    const unsubscribed = reasons.reasons.unsubscribed("12 Oct 2026", reasons.sources.luma);
    // Jane's address and her number, each unsubscribed from Luma's calendar; her yes for our forms isn't there.
    expect(column(contact)!.text!(jane)).toBe(`${unsubscribed}; ${unsubscribed}`);
    expect(column(["email:events:no"])!.text!(jane)).toBe(unsubscribed);
    // A yes has its reason too.
    expect(column(["email:newsletter:yes"])!.text!(jane)).toBe(
      reasons.reasons.asked("15 Oct 2026", reasons.sources["email-your-mp"]),
    );
    // A blocked address's: what blocked it.
    expect(column(contact)!.text!({ ...jane, permissions: exampleBlockedPermissions })).toBe(
      reasons.blockedBecause.complaint("5 Oct 2026"),
    );
    // The filter on another topic finds none of hers.
    expect(column(["email:newsletter:no"])!.text!(jane)).toBe("");
    await render(<SupportersTable search={search(contact)} page={{ supporters: [jane], total: 1, pages: 1 }} />);
    await expect
      .element(page.getByText(supportersCopy.supporters.columns.consentReason, { exact: true }))
      .toBeVisible();
    expect(page.getByText(unsubscribed).all()).toHaveLength(2);
  });
});

describe("the supporters list in words: its downloads, cards and filters", () => {
  it("supporters: what they are, what they get, and as cards, with what they have", () => {
    const [jane, sam, gus] = exampleSupporterRows;
    expect(
      supporterBadgeWords({
        ...sam,
        lumaContact: true,
        events: 1,
        letters: 1,
        sources: [...sam.sources, "march-2026-11"],
      }),
    ).toBe(
      Object.values({
        m: supportersCopy.supporters.badges.member,
        c: supportersCopy.supporters.badges.lumaContact,
        r: supportersCopy.supporters.badges.registered,
        l: supportersCopy.supporters.badges.letter,
        march: supportersCopy.supporters.badges.march,
      }).join("; "),
    );
    expect(subscriptionWords(sam.permissions)).toBe(
      (["email:newsletter", "email:events", "text:volunteering"] as const)
        .map((consent) => supportersCopy.supporters.subscriptions.consents[consent])
        .join("; "),
    );
    expect(subscriptionWords(gus.permissions)).toBe("");
    const placed = {
      ...jane,
      phone: "+447700900001",
      place: { name: "Leeds", basis: "postcode" as const, given: "LS1", country: "england" },
    };
    // Without the Subscriptions filter, a card has no address or number.
    expect(supporterContact({ contact: [] })(placed)).toMatchObject({
      emails: [],
      phones: [],
      address: { locality: "Leeds", country: staffVocabulary.countries.england },
    });
  });

  it("says a supporters search's Near as typed when it wasn't looked up, and each filter by its chip's words", () => {
    const search = supportersSearch({ q: "jo", near: "LS1", activity: "member" });
    expect(supporterWords(search, { events: [], mps: [] })).toEqual([
      `${staffVocabulary.search}: jo`,
      `${supportersCopy.supporters.filters.near}: LS1`,
      `${supportersCopy.supporters.columns.badges}: ${supportersCopy.supporters.badges.member}`,
    ]);
  });
});
