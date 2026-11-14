import { describe, expect, it } from "vitest";
import { CONTROLAI_STATEMENT_HTML } from "@/lib/server/fixtures/politician-lists";
import { nameSlug, statementSupporters } from "./controlai-statement";
import { officialProfile, bodyOf } from "./official-profiles";

describe("statementSupporters", () => {
  it("reads each supporter once from the links to their pages, by ID or by name", () => {
    expect(statementSupporters(CONTROLAI_STATEMENT_HTML)).toEqual([
      { body: "parliament", id: 90002, link: "https://members.parliament.uk/member/90002/contact" },
      { body: "parliament", id: 90101, link: "https://members.parliament.uk/member/90101/contact" },
      {
        body: "scottish-parliament",
        slug: "morag-example",
        link: "https://www.parliament.scot/msps/current-and-previous-msps/morag-example",
      },
      { body: "senedd", slug: "gwen-example", link: "https://senedd.wales/people/gwen-example-ms/" },
      {
        body: "ni-assembly",
        id: 93001,
        link: "https://aims.niassembly.gov.uk/mlas/details.aspx?&aff=1&per=93001&sel=1",
      },
    ]);
  });

  it("ignores every other link", () => {
    expect(
      statementSupporters('<a href="https://controlai.org/">x</a><a href="https://senedd.wales/about">y</a>'),
    ).toEqual([]);
  });
});

describe("nameSlug", () => {
  it("writes a name as the bodies' addresses do", () => {
    expect(nameSlug("Peredur Owen Griffiths")).toBe("peredur-owen-griffiths");
    expect(nameSlug("Fulton MacGregor")).toBe("fulton-macgregor");
    expect(nameSlug(" Siân O'Brien ")).toBe("sian-o-brien");
  });
});

describe("officialProfile", () => {
  it("is their page on their body's site, by their ID, or an MSP's by name", () => {
    expect(officialProfile({ house: "lords", officialId: 8, name: "Baroness May of Maidenhead" })).toBe(
      "https://members.parliament.uk/member/8",
    );
    expect(officialProfile({ house: "scottish-parliament", officialId: 1, name: "Morag Example" })).toBe(
      "https://www.parliament.scot/msps/current-and-previous-msps/morag-example",
    );
    expect(officialProfile({ house: "senedd", officialId: 5053, name: "Huw Irranca-Davies" })).toBe(
      "https://business.senedd.wales/mgUserInfo.aspx?UID=5053",
    );
    expect(officialProfile({ house: "ni-assembly", officialId: 93001, name: "Aoife Example" })).toBe(
      "https://aims.niassembly.gov.uk/mlas/details.aspx?per=93001",
    );
  });

  it("is nothing without an ID, or for someone in no body", () => {
    expect(officialProfile({ house: "commons", officialId: null, name: "Rita Retired" })).toBeUndefined();
    expect(officialProfile({ house: "other", officialId: 1, name: "Someone" })).toBeUndefined();
    expect(bodyOf("other")).toBeUndefined();
    expect(bodyOf("commons")).toBe("parliament");
  });
});
