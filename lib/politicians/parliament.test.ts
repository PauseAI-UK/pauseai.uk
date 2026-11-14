import { describe, expect, it } from "vitest";
import { PARLIAMENT_MEMBERS } from "@/lib/server/fixtures/politician-lists";
import { memberUrl, parliamentEnding, parliamentMembers, parliamentMembersUrl, parliamentProfile } from "./parliament";

describe("parliamentMembers", () => {
  it("reads each MP: name, seat, party, nation, emails trimmed and lowercased, websites, salutation by rule, any title recorded", () => {
    const [dora, polly, mo] = parliamentMembers(PARLIAMENT_MEMBERS.Commons);
    expect(dora).toEqual({
      officialId: 90001,
      house: "commons",
      name: "Ms Dora Dummy",
      constituency: "Hackney North and Stoke Newington",
      party: "Labour",
      country: "england",
      emails: ["mp90001.office@parliament.uk"],
      websites: [],
      salutation: "Ms Dummy",
      titled: true,
    });
    expect(polly).toMatchObject({ websites: ["https://www.polly.example"], salutation: "Ms Placeholder" });
    expect(polly).not.toHaveProperty("titled");
    expect(mo).toMatchObject({ salutation: "Mx Example", titled: true });
  });

  it("reads a Lord, alone in their House's answer, without a seat or nation", () => {
    expect(parliamentMembers(PARLIAMENT_MEMBERS.Lords)).toEqual([
      {
        officialId: 90101,
        house: "lords",
        name: "Lord Seedling of Example",
        constituency: null,
        party: "Crossbench",
        country: null,
        emails: ["contactholmember@parliament.uk"],
        websites: [],
        salutation: "Lord Seedling",
      },
    ]);
  });

  it("puts the email a member prefers first, then their parliamentary office's, and drops what isn't an address", () => {
    const [member] = parliamentMembers({
      Members: {
        Member: {
          "@Member_Id": "1",
          DisplayAs: "Sam Example",
          ListAs: "Example, Sam",
          Gender: null,
          Party: null,
          House: "Commons",
          MemberFrom: "Nowhere",
          Addresses: {
            Address: [
              { "@Type_Id": "4", Email: "constituency@example.org" },
              { "@Type_Id": "1", Email: "office@parliament.uk" },
              { "@Type_Id": "4", IsPreferred: "True", Email: "Preferred@Example.org" },
              { "@Type_Id": "4", Email: "not an address" },
              { "@Type_Id": "6", Address1: "Not a link" },
            ],
          },
        },
      },
    });
    expect(member).toMatchObject({
      emails: ["preferred@example.org", "office@parliament.uk", "constituency@example.org"],
      websites: [],
      party: "",
      country: null,
      salutation: null,
    });
  });

  it("reads a member with no addresses, and refuses an answer with no members", () => {
    const [member, mp] = parliamentMembers({
      Members: {
        Member: [
          { "@Member_Id": "2", DisplayAs: "Lord Quiet", ListAs: "Quiet, L.", House: "Lords" },
          { "@Member_Id": "3", DisplayAs: "Sam Seatless", ListAs: "Seatless, Sam", House: "Commons" },
        ],
      },
    });
    expect(member).toMatchObject({ emails: [], websites: [], constituency: null });
    expect(mp).toMatchObject({ constituency: null, country: null });
    expect(() => parliamentMembers({})).toThrow("no members");
    expect(() => parliamentMembers(null)).toThrow("no members");
  });

  it("knows where each House's list is, a member's page, and where to ask why they left", () => {
    expect(parliamentMembersUrl("Lords")).toContain("/house=Lords%7CMembership=current/Addresses/");
    expect(parliamentProfile(8)).toBe("https://members.parliament.uk/member/8");
    expect(memberUrl(8)).toBe("https://members-api.parliament.uk/api/Members/8");
  });
});

describe("parliamentEnding", () => {
  const ending = (reason: string | null, date: string | null = "2026-10-01T00:00:00") =>
    parliamentEnding({ value: { latestHouseMembership: { membershipEndDate: date, membershipEndReason: reason } } });

  it("is died, retired or left, with the day and Parliament's words", () => {
    expect(ending("Death")).toEqual({ status: "died", date: "2026-10-01", reason: "Death" });
    expect(ending("Retirement")).toEqual({ status: "retired", date: "2026-10-01", reason: "Retirement" });
    expect(ending("Resignation (Chiltern)")).toMatchObject({ status: "left_office" });
  });

  it("is simply left, when Parliament doesn't say", () => {
    expect(ending(null, null)).toEqual({ status: "left_office", date: null, reason: null });
    expect(parliamentEnding(null)).toEqual({ status: "left_office", date: null, reason: null });
  });
});
