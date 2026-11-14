import type { Choosing } from "@/lib/politicians/filters";
import type { PastedLine } from "./PoliticiansList";
import type { Politician, PoliticianChange, PoliticiansPage } from "@/lib/politicians/records";
import type { PoliticianAliases } from "@/lib/politicians/aliases";
import type { PoliticiansSearch } from "@/lib/staff-search";

/** The example politician's aliases: one of each kind, a personal address staff added among them. */
export const exampleAliases: PoliticianAliases = {
  email: "polly.placeholder.mp@parliament.uk",
  past: ["polly@oldexample.org.uk"],
  parliament: ["placeholderp@parliament.uk"],
  office: ["jane.smith@parliament.uk"],
  added: [{ address: "polly.placeholder@example.com", addedBy: "jo@pauseai.uk", at: new Date("2026-11-10T10:00:00Z") }],
  domains: ["pollyplaceholder.org.uk"],
  forms: ["polly.placeholder.mp@parliament.uk", "citiesoflondonandwestminster.mp@parliament.uk"],
};

/** An MP in office who has signed the letter to the PM, and declined the conference, from Airtable. */
export const examplePolitician: Politician = {
  id: 7,
  airtableId: "rec90002",
  officialId: 90002,
  house: "commons",
  name: "Polly Placeholder",
  salutation: "Ms Placeholder",
  salutationToCheck: false,
  constituency: "Cities of London and Westminster",
  party: "Labour (Co-op)",
  country: "england",
  email: "polly.placeholder.mp@parliament.uk",
  status: "in_office",
  importantTarget: true,
  personalConnection: false,
  isTest: false,
  emailBlocked: false,
  firstActivityAt: null,
  lastActivityAt: null,
  emailsToThem: 4,
  emailsFromThem: 1,
  statuses: {
    "edinburgh-conference-2026": {
      status: "declined",
      date: null,
      note: "",
      updatedAt: new Date("2026-10-03T10:00:00Z"),
      updatedBy: "airtable",
    },
    "frontier-ai-letter": {
      status: "signed",
      date: "2026-10-01",
      note: "",
      updatedAt: new Date("2026-10-02T10:00:00Z"),
      updatedBy: "jo@pauseai.uk",
    },
  },
};

/** The politicians page's list of Polly alone, with nothing else for a search to say. */
export const examplePoliticiansPage: PoliticiansPage = {
  politicians: [examplePolitician],
  total: 1,
  page: 1,
  pages: 1,
  pageSize: 100,
  outOfOffice: 0,
  tests: 0,
  otherHouses: 0,
  closest: [],
};

/** The politicians page's filters, all blank. */
export const emptyPoliticiansSearch: PoliticiansSearch = {
  q: "",
  house: "",
  status: "",
  party: [],
  flag: [],
  nation: [],
  email: [],
  mailed: [],
  agreed: "",
  ask: "",
  answer: [],
  sort: "",
  dir: "",
  page: "",
  mailing: "",
  tab: "",
  pasted: [],
  saved: "",
};

/** The draft "Edinburgh thank-you", choosing who it's for, with Polly ticked. */
export const exampleChoosing: Choosing = {
  id: 12,
  title: "Edinburgh thank-you",
  blank: false,
  ticked: [examplePolitician.id],
};

/** Names pasted: a row copied from the table, which found Polly by her name; and a typo near her. */
export const examplePasted: PastedLine[] = [
  {
    line: "Polly Placeholder\tHouse of Commons\tCities of London and Westminster",
    matches: [examplePolitician],
    by: { [examplePolitician.id]: "name" },
    choices: [],
  },
  { line: "Poly Plaseholder", matches: [], by: {}, choices: [examplePolitician], near: true },
];

/** What the audit log says about Polly: her status set, her address blocked by Postmark and unblocked by staff. */
export const examplePoliticianHistory: PoliticianChange[] = [
  {
    id: 12,
    at: new Date("2026-10-14T09:30:00Z"),
    actor: "jo@pauseai.uk",
    action: "unblock address",
    details: { address: "polly.placeholder.mp@parliament.uk", note: "Fixed in Airtable" },
  },
  {
    id: 11,
    at: new Date("2026-10-12T09:10:00Z"),
    actor: "postmark",
    action: "block address",
    details: { address: "polly.placeholder.mp@parliament.uk", kind: "hard" },
  },
  {
    id: 10,
    at: new Date("2026-10-02T10:00:00Z"),
    actor: "jo@pauseai.uk",
    action: "set status",
    details: {
      politicianId: 7,
      ask: "frontier-ai-letter",
      status: "signed",
      date: "2026-10-01",
      note: "Told us at the march",
    },
  },
  {
    id: 9,
    at: new Date("2026-09-30T10:00:00Z"),
    actor: "samuel.whitlock@pauseai.uk",
    action: "edit politician",
    details: { id: 7, name: "Polly Placeholder", email: "polly.placeholder.mp@parliament.uk" },
  },
];
