// The bodies' lists of members as a fixture build reads them
// (outside-services.ts), each in its source's own shape: the made-up
// politicians the storyboard and the tests know, one or more of each body.
// Parliament: Dora Dummy, Polly Placeholder and Mo Example, MPs, and Lord
// Seedling, who lists only the Lords' shared inbox, so has no email. The
// Scottish Parliament: Morag Example. The Senedd: Gwen Example. The NI
// Assembly: Aoife Example. Wikidata knows Morag's and Gwen's genders, and
// ControlAI's statement links to five of them.

const address = (email: string | null, extra: object = {}) => ({
  "@Type_Id": "1",
  Type: "Parliamentary office",
  IsPreferred: "False",
  Email: email,
  Address1: "House of Commons",
  ...extra,
});

/** Parliament's Members Data Platform: each House's sitting members, with their addresses. */
export const PARLIAMENT_MEMBERS = {
  Commons: {
    Members: {
      Member: [
        {
          "@Member_Id": "90001",
          DisplayAs: "Ms Dora Dummy",
          ListAs: "Dummy, Ms Dora",
          Gender: "F",
          Party: { "@Id": "15", "#text": "Labour" },
          House: "Commons",
          MemberFrom: "Hackney North and Stoke Newington",
          Addresses: { Address: address("mp90001.office@parliament.uk ") },
        },
        {
          "@Member_Id": "90002",
          DisplayAs: "Polly Placeholder",
          ListAs: "Placeholder, Polly",
          Gender: "F",
          Party: { "@Id": "15", "#text": "Labour (Co-op)" },
          House: "Commons",
          MemberFrom: "Cities of London and Westminster",
          Addresses: {
            Address: [
              address("polly.placeholder.mp@parliament.uk"),
              {
                "@Type_Id": "6",
                Type: "Website",
                IsPreferred: "False",
                Email: null,
                Address1: "https://www.polly.example",
              },
            ],
          },
        },
        {
          "@Member_Id": "90003",
          DisplayAs: "Mo Example",
          ListAs: "Example, Mx Mo",
          Gender: "F",
          Party: { "@Id": "15", "#text": "Labour" },
          House: "Commons",
          MemberFrom: "Manchester Central",
          Addresses: { Address: address("mp90003.office@parliament.uk") },
        },
      ],
    },
  },
  Lords: {
    Members: {
      Member: {
        "@Member_Id": "90101",
        DisplayAs: "Lord Seedling of Example",
        ListAs: "Seedling of Example, L.",
        Gender: "M",
        Party: { "@Id": "6", "#text": "Crossbench" },
        House: "Lords",
        MemberFrom: "Life peer",
        Addresses: { Address: address("contactholmember@parliament.uk", { Address1: "House of Lords" }) },
      },
    },
  },
};

/** The Members API's answer for a member who has left: why, and when. */
export const PARLIAMENT_ENDING = {
  value: { latestHouseMembership: { membershipEndDate: "2026-10-01T00:00:00", membershipEndReason: "Retirement" } },
};

/** The Scottish Parliament's lists, by their path under its API. */
export const SCOTTISH_PARLIAMENT: Record<string, unknown[]> = {
  members: [
    { PersonID: 91001, ParliamentaryName: "Example, Morag", PreferredName: "Morag", GenderTypeID: 3, IsCurrent: true },
    { PersonID: 91002, ParliamentaryName: "Former, Fiona", PreferredName: "Fiona", GenderTypeID: 3, IsCurrent: false },
  ],
  emailaddresses: [
    { ID: 1, PersonID: 91001, EmailAddressTypeID: 1, Address: "Morag.Example.msp@parliament.example", IsDefault: true },
  ],
  websites: [
    {
      ID: 1,
      PersonID: 91001,
      WebSiteTypeID: 1,
      WebURL: "https://www.parliament.scot/msps/current-and-previous-msps/morag-example",
      IsDefault: true,
    },
  ],
  memberparties: [{ ID: 1, PersonID: 91001, PartyID: 1, ValidFromDate: "2026-05-08T00:00:00", ValidUntilDate: null }],
  parties: [{ ID: 1, ActualName: "Example Party", PreferredName: "Example Party" }],
  MemberElectionConstituencyStatuses: [
    { ID: 1, PersonID: 91001, ConstituencyID: 1, ValidFromDate: "2026-05-08T00:00:00", ValidUntilDate: null },
  ],
  constituencies: [{ ID: 1, Name: "Exampleshire North" }],
  MemberElectionregionStatuses: [],
  regions: [],
};

/** The Senedd's members, by constituency, as its web service's XML gives them. */
export const SENEDD_MEMBERS = `<?xml version="1.0" encoding="utf-8"?>
<councillorsbyward>
  <wards>
    <ward>
      <wardtitle>Exampleshire Valleys</wardtitle>
      <councillors>
        <councillor>
          <councillorid>92001</councillorid>
          <fullusername>Gwen Example MS</fullusername>
          <politicalpartytitle>Example Party</politicalpartytitle>
          <workaddress><email>Gwen.Example-MS@senedd.wales</email></workaddress>
        </councillor>
      </councillors>
    </ward>
  </wards>
</councillorsbyward>`;

/** The Northern Ireland Assembly's members, and their addresses. */
export const NI_ASSEMBLY = {
  members: {
    AllMembersList: {
      Member: [
        {
          PersonId: "93001",
          MemberFirstName: "Aoife",
          MemberLastName: "Example",
          MemberPrefix: "Ms",
          PartyName: "Example Party",
          ConstituencyName: "Example Glens",
        },
      ],
    },
  },
  contacts: {
    AllMembersList: {
      Member: [
        { PersonId: "93001", AddressType: "NIA Office Address", EmaiAddress: "aoife.example@mla.niassembly.gov.uk" },
      ],
    },
  },
};

/** TheyWorkForYou's people: Morag, by the ID the Scottish Parliament gives her. */
export const THEYWORKFORYOU_PEOPLE_DATA = {
  persons: [{ id: "uk.org.publicwhip/person/99001", identifiers: [{ scheme: "scotparl_id", identifier: "91001" }] }],
};

/** Wikidata's answer to who has each ID asked for: Morag by her TheyWorkForYou ID, Gwen by her Senedd ID. */
export function wikidataAnswer(query: string) {
  const people = [
    { id: "99001", gender: "Q6581072", surname: "Example" },
    { id: "92001", gender: "Q6581072", surname: "Example" },
  ].filter((p) => query.includes(`"${p.id}"`));
  return {
    results: {
      bindings: people.map((p) => ({
        id: { value: p.id },
        gender: { value: `http://www.wikidata.org/entity/${p.gender}` },
        surname: { value: p.surname },
      })),
    },
  };
}

/** ControlAI's statement's page: its supporters as links to their pages on their bodies' sites. */
export const CONTROLAI_STATEMENT_HTML = `<!doctype html><html><body>
<h1>Join Our Supporters</h1>
<a href="https://members.parliament.uk/member/90002/contact"></a>
<a href="https://members.parliament.uk/member/90002/career"></a>
<a href="https://members.parliament.uk/member/90101/contact"></a>
<a href="https://www.parliament.scot/msps/current-and-previous-msps/morag-example"></a>
<a href="https://senedd.wales/people/gwen-example-ms/"></a>
<a href="https://aims.niassembly.gov.uk/mlas/details.aspx?&amp;aff=1&amp;per=93001&amp;sel=1"></a>
</body></html>`;
