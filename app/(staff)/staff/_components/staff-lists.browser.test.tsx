import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { type DownloadColumn } from "@/lib/staff-list";
import { staffCopy } from "@/lib/content/staff-interface";
import { blockColumns } from "./EmailBlocksTable";
import { exampleBlock, exampleComplaint, exampleGmailBlock } from "./EmailBlocksTable.examples";
import { politicianWords } from "./PoliticianFilters";
import PoliticianTable, { politicianColumns, politicianContact } from "./PoliticianTable";
import { exampleAsks, examplePolitician, emptyPoliticiansSearch } from "./PoliticianTable.examples";
import { subscriptionWords } from "./SubscriptionBadges";
import { supporterBadgeWords } from "./SupporterBadges";
import { supporterWords } from "./SupporterFilters";
import { supporterContact } from "./SupportersTable";
import { exampleSupporterRows } from "./SupportersTable.examples";
import { supportersSearch } from "@/lib/staff-search";

describe("each list's download values and contact cards", () => {
  const values = <Row,>(columns: DownloadColumn<Row>[], row: Row) =>
    Object.fromEntries(columns.filter((c) => c.text).map((c) => [c.key, c.text!(row)]));

  it("blocked addresses: whose, and the email that found them out, or nothing", () => {
    const columns = blockColumns(false);
    expect(values(columns, exampleBlock)).toMatchObject({
      whose: "Bouncy McTestface MP",
      sent: `${staffCopy.emails.letterTo} Bouncy McTestface MP`,
    });
    expect(values(columns, exampleComplaint).sent).toBe(staffCopy.emails.purposes["forwarded-reply"]);
    expect(values(columns, { ...exampleComplaint, politicians: exampleBlock.politicians }).whose).toBe(
      "Bouncy McTestface MP; Jane Example",
    );
    expect(values(columns, { ...exampleComplaint, supporters: [{ id: 8, name: null }] }).whose).toBe(
      staffCopy.supporters.noName,
    );
    expect(values(columns, { ...exampleComplaint, purpose: null }).sent).toBeNull();
    // After its reason, in brackets, who told us.
    expect(values(columns, exampleBlock).reason).toBe(`${exampleBlock.reason} (${staffCopy.emails.from.postmark})`);
    expect(values(columns, exampleGmailBlock).reason).toBe(
      `${exampleGmailBlock.reason} (${staffCopy.emails.from.gmail})`,
    );
  });

  it("politicians: every column, and as cards, with what they have", async () => {
    const rows = [
      {
        ...examplePolitician,
        firstActivityAt: new Date("2026-09-01T00:00:00Z"),
        lastActivityAt: new Date("2026-10-01T00:00:00Z"),
      },
      {
        ...examplePolitician,
        id: 8,
        constituency: null,
        house: "lords" as const,
        email: null,
        party: "",
        country: null,
        status: "retired" as const,
      },
    ];
    // The Nation filter leaving one out adds their nation, after the constituency.
    const byNation = politicianColumns(exampleAsks, { status: "any", nation: ["!scotland"] });
    const keys = byNation.map((c) => c.key);
    expect(keys.indexOf("country")).toBe(keys.indexOf("constituency") + 1);
    const nation = byNation.find((c) => c.key === "country")!;
    expect(nation.text!(rows[0])).toBe(staffCopy.countries[examplePolitician.country!]);
    expect(nation.cell(rows[0])).toBe(staffCopy.countries[examplePolitician.country!]);
    expect(nation.text!(rows[1])).toBeNull();
    const columns = politicianColumns(exampleAsks, { status: "any" });
    expect(values(columns, rows[0])).toMatchObject({
      house: staffCopy.houses.commons,
      party: examplePolitician.party,
      status: staffCopy.personStatuses.in_office,
      constituency: examplePolitician.constituency,
      emailsToThem: 4,
      emailsFromThem: 1,
      first: new Date("2026-09-01T00:00:00Z"),
      active: new Date("2026-10-01T00:00:00Z"),
    });
    // The markers in words, each one they have; none for one with none.
    const { flags } = staffCopy.politicians;
    const marked = {
      ...rows[0],
      importantTarget: true,
      personalConnection: true,
      airtableRemovedAt: new Date("2026-10-20"),
      isTest: true,
    };
    expect(values(columns, marked).marked).toBe(
      `${flags.important}; ${flags.connection}; ${flags.removed}; ${flags.test}`,
    );
    expect(values(columns, { ...rows[0], importantTarget: false }).marked).toBe("");
    // On the page, the days of their first and last activity; none for one without.
    await render(<PoliticianTable politicians={rows} asks={exampleAsks} search={{ status: "any" }} />);
    await expect.element(page.getByRole("cell", { name: "1 Sept 2026" })).toBeVisible();
    await expect.element(page.getByRole("cell", { name: "1 Oct 2026" })).toBeVisible();
    expect(String(values(columns, rows[0]).asks)).toContain(": ");
    const card = politicianContact(exampleAsks);
    expect(card(rows[0])).toMatchObject({ emails: [examplePolitician.email], title: examplePolitician.party });
    const { emailsToThem, emailsFromThem } = staffCopy.politicians.columns;
    expect(card(rows[0]).note).toEqual(expect.arrayContaining([`${emailsToThem}: 4`, `${emailsFromThem}: 1`]));
    expect(card(rows[1])).toMatchObject({ emails: [], title: null, address: { country: null } });
  });

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
        m: staffCopy.supporters.badges.member,
        c: staffCopy.supporters.badges.lumaContact,
        r: staffCopy.supporters.badges.registered,
        l: staffCopy.supporters.badges.letter,
        march: staffCopy.supporters.badges.march,
      }).join("; "),
    );
    expect(subscriptionWords(sam.permissions)).toBe(
      (["email:newsletter", "email:events", "text:volunteering"] as const)
        .map((consent) => staffCopy.supporters.subscriptions.consents[consent])
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
      address: { locality: "Leeds", country: staffCopy.countries.england },
    });
  });
});

describe("the lists' filters in words, for their titles", () => {
  it("says a supporters search's Near as typed when it wasn't looked up, and each filter by its chip's words", () => {
    const search = supportersSearch({ q: "jo", near: "LS1", activity: "member" });
    expect(supporterWords(search, { events: [], mps: [] })).toEqual([
      `${staffCopy.search}: jo`,
      `${staffCopy.supporters.filters.near}: LS1`,
      `${staffCopy.supporters.columns.badges}: ${staffCopy.supporters.badges.member}`,
    ]);
  });

  it("says the politicians' house first, or nothing for all of them", () => {
    const parties = ["Labour"];
    expect(politicianWords({ ...emptyPoliticiansSearch, house: "lords", party: ["Labour"] }, parties, [])).toEqual([
      staffCopy.houses.lords,
      `${staffCopy.fields.party}: Labour`,
    ]);
    expect(politicianWords(emptyPoliticiansSearch, parties, [])).toEqual([""]);
  });
});
