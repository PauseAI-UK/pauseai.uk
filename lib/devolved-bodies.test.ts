import { describe, expect, it } from "vitest";
import { NI_ASSEMBLY, SCOTTISH_PARLIAMENT, SENEDD_MEMBERS } from "@/lib/server/fixtures/politician-lists";
import { mlaProfile, niAssemblyMembers } from "./ni-assembly";
import { mspName, scottishParliamentMembers, type ScottishParliamentLists } from "./scottish-parliament";
import { seneddMembers, seneddName } from "./senedd";

const NOW = new Date("2026-11-13T12:00:00Z");
const lists = (changes: Partial<ScottishParliamentLists> = {}) =>
  ({ ...SCOTTISH_PARLIAMENT, ...changes }) as ScottishParliamentLists;

describe("the Scottish Parliament's members", () => {
  it("are those sitting now, with their seat, party, emails and websites, and no salutation yet", () => {
    expect(scottishParliamentMembers(lists(), NOW)).toEqual([
      {
        officialId: 91001,
        house: "scottish-parliament",
        name: "Morag Example",
        surname: "Example",
        constituency: "Exampleshire North",
        party: "Example Party",
        country: "scotland",
        emails: ["morag.example.msp@parliament.example"],
        websites: ["https://www.parliament.scot/msps/current-and-previous-msps/morag-example"],
        salutation: null,
      },
    ]);
  });

  it("gives a regional member their region, and drops a party or seat that has ended", () => {
    const [morag] = scottishParliamentMembers(
      lists({
        MemberElectionConstituencyStatuses: [
          { PersonID: 91001, ConstituencyID: 1, ValidUntilDate: "2026-05-01T00:00:00" },
        ],
        MemberElectionregionStatuses: [{ PersonID: 91001, RegionID: 7, ValidUntilDate: null }],
        regions: [{ ID: 7, Name: "Example Region" }],
        memberparties: [{ PersonID: 91001, PartyID: 1, ValidUntilDate: "2026-05-01T00:00:00" }],
        websites: [
          { PersonID: 91001, WebURL: "  " },
          { PersonID: 91002, WebURL: "https://someone.else.example" },
        ],
        emailaddresses: [
          { PersonID: 91001, Address: "", IsDefault: false },
          { PersonID: 91001, Address: "second@parliament.scot", IsDefault: false },
          { PersonID: 91001, Address: "first@parliament.scot", IsDefault: true },
        ],
      }),
      NOW,
    );
    expect(morag).toMatchObject({
      constituency: "Example Region",
      party: "",
      emails: ["first@parliament.scot", "second@parliament.scot"],
      websites: [],
    });
  });

  it("has no seat for someone with none, and refuses a list that isn't one", () => {
    const [morag] = scottishParliamentMembers(lists({ MemberElectionConstituencyStatuses: [] }), NOW);
    expect(morag.constituency).toBeNull();
    expect(() => scottishParliamentMembers(lists({ members: {} }), NOW)).toThrow("members isn't a list");
  });

  it("writes a member's name first name first, preferring the name they go by", () => {
    expect(mspName({ ParliamentaryName: "Constance, Angela", PreferredName: null })).toEqual({
      name: "Angela Constance",
      surname: "Constance",
    });
    expect(mspName({ ParliamentaryName: "Harvie, Patrick", PreferredName: "Paddy" }).name).toBe("Paddy Harvie");
    expect(mspName({ ParliamentaryName: "Mononym" }).name).toBe("Mononym");
  });
});

describe("the Senedd's members", () => {
  it("are each constituency's members, without the letters after their names", () => {
    expect(seneddMembers(SENEDD_MEMBERS)).toEqual([
      {
        officialId: 92001,
        house: "senedd",
        name: "Gwen Example",
        constituency: "Exampleshire Valleys",
        party: "Example Party",
        country: "wales",
        emails: ["gwen.example-ms@senedd.wales"],
        websites: [],
        salutation: null,
      },
    ]);
  });

  it("decodes the XML's entities, and has no email or seat where it gives none", () => {
    const [member] = seneddMembers(`<wards><ward><wardtitle></wardtitle><councillor><councillorid>1</councillorid>
      <fullusername>Siân O&#39;Brien &amp; Co &#x41; &lt;x&gt; &nbsp;AS</fullusername>
      <politicalpartytitle>Plaid Cymru</politicalpartytitle></councillor></ward></wards>`);
    expect(member).toMatchObject({ name: "Siân O'Brien & Co A <x> &nbsp;AS", constituency: null, emails: [] });
    expect(seneddName("Rhun ap Iorwerth AS")).toBe("Rhun ap Iorwerth");
    expect(() => seneddMembers("<html>Forbidden</html>")).toThrow("no constituencies");
  });
});

describe("the NI Assembly's members", () => {
  it("are those sitting now, with their emails and a salutation from their title", () => {
    expect(niAssemblyMembers(NI_ASSEMBLY.members, NI_ASSEMBLY.contacts)).toEqual([
      {
        officialId: 93001,
        house: "ni-assembly",
        name: "Aoife Example",
        constituency: "Example Glens",
        party: "Example Party",
        country: "northern-ireland",
        emails: ["aoife.example@mla.niassembly.gov.uk"],
        websites: [],
        salutation: "Ms Example",
      },
    ]);
  });

  it("has no salutation without a title, no party or seat where it gives none, and drops what isn't an address", () => {
    const [member] = niAssemblyMembers(
      { AllMembersList: { Member: [{ PersonId: "5", MemberFirstName: "Sam", MemberLastName: "Example" }] } },
      {
        AllMembersList: {
          Member: [
            { PersonId: "5", EmaiAddress: null },
            { PersonId: "5", EmaiAddress: "none" },
          ],
        },
      },
    );
    expect(member).toMatchObject({ salutation: null, party: "", constituency: null, emails: [] });
    expect(() => niAssemblyMembers({}, NI_ASSEMBLY.contacts)).toThrow("members has no members");
    expect(() => niAssemblyMembers(NI_ASSEMBLY.members, null)).toThrow("contacts has no members");
    expect(mlaProfile(93001)).toBe("https://aims.niassembly.gov.uk/mlas/details.aspx?per=93001");
  });
});
