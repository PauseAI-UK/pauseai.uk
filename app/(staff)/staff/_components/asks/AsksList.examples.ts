import type { Ask, AskPageData, AskWay, AskWithCounts } from "@/lib/asks/records.server";
import type { EditableAsk } from "./AskForm";

// Fake asks, for the tests and the gallery: the asks as the migrations add
// them, with their answers counted, an ask's page and one staff can edit.

/** The asks, as the migrations add them, newest first: two events and two letters, one with no date or link, linked to our pages and others'. */
export const exampleAsks: Ask[] = [
  {
    slug: "edinburgh-conference-2026",
    title: "Example Conference",
    kind: "event",
    date: "2026-11-01",
    url: "https://luma.com/example",
    askedBy: ["pauseai"],
  },
  {
    slug: "go-to-parliament-oct-2026",
    title: "Example Day at Parliament",
    kind: "event",
    date: "2026-10-20",
    url: null,
    askedBy: [],
  },
  {
    slug: "controlai-letter",
    title: "Example Letter Backing the Bill",
    kind: "letter",
    date: "2026-09-11",
    url: "https://example.org/letter",
    askedBy: ["controlai"],
  },
  {
    slug: "frontier-ai-letter",
    title: "Example Letter to the PM",
    kind: "letter",
    date: null,
    url: "/pdfs/Frontier-AI-Open-Letter.pdf",
    askedBy: ["supporters", "pauseai"],
  },
  {
    slug: "example-letter-staff-added-oct-2026",
    title: "Example Letter Staff Added",
    kind: "letter",
    date: "2026-10-29",
    url: null,
    askedBy: ["pauseai"],
  },
];

const campaignWay: AskWay = {
  kind: "campaign",
  href: "/staff/campaigns/open-letter",
  title: "Sign the open letter",
  letters: 12,
};
const mailingWay: AskWay = {
  kind: "mailing",
  href: "/staff/mailings/3",
  title: "First mailing about the letter",
  letters: 40,
};

/** The asks with how many gave each answer: a letter signed and declined, an event answered every way it allows, and one nobody has answered. */
export const exampleAsksWithCounts: AskWithCounts[] = [
  {
    ...exampleAsks[0],
    counts: { declined: 50, other: 1, going: 3 },
    firstLetter: null,
    lastLetter: null,
    writtenTo: 186,
    replied: 20,
    noAnswer: 132,
    campaigns: 0,
    mailings: 1,
    ways: [mailingWay],
  },
  {
    ...exampleAsks[1],
    counts: { going: 2, other: 2, declined: 1 },
    firstLetter: null,
    lastLetter: null,
    writtenTo: 0,
    replied: 0,
    noAnswer: 0,
    campaigns: 0,
    mailings: 0,
    ways: [],
  },
  {
    ...exampleAsks[2],
    counts: {},
    firstLetter: null,
    lastLetter: null,
    writtenTo: 4,
    replied: 0,
    noAnswer: 4,
    campaigns: 1,
    mailings: 0,
    ways: [campaignWay],
  },
  {
    ...exampleAsks[3],
    counts: { signed: 10, declined: 2 },
    firstLetter: "2026-06-18",
    lastLetter: "2026-11-04",
    writtenTo: 40,
    replied: 0,
    noAnswer: 28,
    campaigns: 1,
    mailings: 2,
    ways: [
      campaignWay,
      mailingWay,
      { ...mailingWay, href: "/staff/mailings/4", title: "Second mailing about the letter" },
    ],
  },
];

/** An ask a campaign and a mailing put, signed and declined. */
export const exampleAskPage: AskPageData = {
  ...exampleAsks[3],
  counts: { signed: 2, declined: 1 },
  firstLetter: "2026-06-18",
  lastLetter: "2026-11-04",
  writtenTo: 40,
  replied: 5,
  campaigns: 1,
  mailings: 1,
  noAnswer: 37,
  answersTotal: 3,
  page: 1,
  pages: 1,
  pageSize: 100,
  ways: [
    {
      kind: "campaign",
      href: "/staff/campaigns/pauseai-info-deepmind",
      title: "Call DeepMind to honour AI Safety Summit pledges",
      letters: 19,
    },
    {
      kind: "mailing",
      href: "/staff/mailings/3",
      title: "DeepMind: ten of your colleagues",
      letters: 21,
    },
  ],
  groups: [
    {
      key: "signed",
      total: 2,
      people: [
        {
          politicianId: 1,
          name: "Polly Placeholder",
          isTest: false,
          constituency: "Seat One",
          party: "Example Party",
          status: "signed",
          note: "",
          lastWrittenTo: new Date("2026-10-01T09:00:00Z"),
        },
      ],
    },
    {
      key: "declined",
      total: 1,
      people: [
        {
          politicianId: 2,
          name: "Dee Dummy",
          isTest: false,
          constituency: null,
          party: null,
          status: "declined",
          note: "",
          lastWrittenTo: null,
        },
      ],
    },
    {
      key: "none",
      total: 37,
      people: [
        {
          politicianId: 3,
          name: "Nia Nobody",
          isTest: false,
          constituency: null,
          party: "Example Party",
          status: null,
          note: "",
          lastWrittenTo: null,
        },
      ],
    },
  ],
  answers: [
    {
      politicianId: 1,
      name: "Polly Placeholder",
      isTest: false,
      constituency: "Seat One",
      party: "Example Party",
      status: "signed",
      note: "",
      lastWrittenTo: new Date("2026-10-01T09:00:00Z"),
    },
    {
      politicianId: 2,
      name: "Dee Dummy",
      isTest: true,
      constituency: null,
      party: null,
      status: "declined",
      note: "",
      lastWrittenTo: null,
    },
  ],
};

/** An ask staff added, which nobody has answered. */
export const exampleEditableAsk: EditableAsk = {
  slug: "winter-reception-dec-2026",
  title: "Winter reception",
  kind: "event",
  date: "2026-12-09",
  url: null,
  askedBy: ["pauseai"],
  named: false,
  kindFixed: false,
  deletable: true,
};
