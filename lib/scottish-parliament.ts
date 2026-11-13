// The Scottish Parliament's members, from its open data
// (https://data.parliament.scot/api/, no key needed): who sits now, from
// separate lists of members, their emails, websites, parties and seats, each
// keyed by the member's PersonID. The caller fetches:
// lib/server/outside-services/scottish-parliament.ts.

import type { OfficialMember } from "./politician-import";

export const SCOTTISH_PARLIAMENT_API = "https://data.parliament.scot/api";

/** The lists a import reads, by their path under the API. */
export const SCOTTISH_PARLIAMENT_LISTS = [
  "members",
  "emailaddresses",
  "websites",
  "memberparties",
  "parties",
  "MemberElectionConstituencyStatuses",
  "constituencies",
  "MemberElectionregionStatuses",
  "regions",
] as const;
export type ScottishParliamentLists = Record<(typeof SCOTTISH_PARLIAMENT_LISTS)[number], unknown>;

/** A member's page on the Scottish Parliament's site, by the name in it ("emma-roddick"). */
export const MSP_PAGES = "https://www.parliament.scot/msps/current-and-previous-msps/";

type Member = { PersonID: number; ParliamentaryName: string; PreferredName?: string | null; IsCurrent: boolean };
type Email = { PersonID: number; Address?: string | null; IsDefault?: boolean };
type Website = { PersonID: number; WebURL?: string | null };
type Dated = { PersonID: number; ValidUntilDate?: string | null };
type MemberParty = Dated & { PartyID: number };
type Party = { ID: number; PreferredName?: string | null; ActualName?: string | null };
type Seat = Dated & { ConstituencyID?: number; RegionID?: number };
type Place = { ID: number; Name: string };

const rows = <T>(data: unknown, name: string): T[] => {
  if (!Array.isArray(data)) throw new Error(`The Scottish Parliament's ${name} isn't a list`);
  return data as T[];
};

/** Whether a dated row holds now: it has no end, or ends later. */
const holds = (row: Dated, now: Date) => !row.ValidUntilDate || new Date(row.ValidUntilDate) > now;

/** "Constance, Angela" with a preferred name of "Angela": Angela Constance, and her surname. */
export function mspName(member: Pick<Member, "ParliamentaryName" | "PreferredName">): {
  name: string;
  surname: string;
} {
  const [surname, given = ""] = member.ParliamentaryName.split(/,\s*/);
  const first = member.PreferredName?.trim() || given.trim();
  return { name: [first, surname.trim()].filter(Boolean).join(" "), surname: surname.trim() };
}

/** The sitting members, from each list (SCOTTISH_PARLIAMENT_LISTS), as of `now`. Salutations are made from their genders later. */
export function scottishParliamentMembers(lists: ScottishParliamentLists, now: Date): OfficialMember[] {
  const emails = rows<Email>(lists.emailaddresses, "emailaddresses");
  const websites = rows<Website>(lists.websites, "websites");
  const parties = new Map(rows<Party>(lists.parties, "parties").map((p) => [p.ID, p]));
  const memberParties = rows<MemberParty>(lists.memberparties, "memberparties").filter((p) => holds(p, now));
  const constituencies = new Map(rows<Place>(lists.constituencies, "constituencies").map((c) => [c.ID, c.Name]));
  const regions = new Map(rows<Place>(lists.regions, "regions").map((r) => [r.ID, r.Name]));
  const seats = [
    ...rows<Seat>(lists.MemberElectionConstituencyStatuses, "constituency seats"),
    ...rows<Seat>(lists.MemberElectionregionStatuses, "region seats"),
  ].filter((s) => holds(s, now));
  return rows<Member>(lists.members, "members")
    .filter((m) => m.IsCurrent)
    .map((m) => {
      const party = parties.get(memberParties.find((p) => p.PersonID === m.PersonID)?.PartyID ?? -1);
      const seat = seats.find((s) => s.PersonID === m.PersonID);
      const theirEmails = emails
        .filter((e) => e.PersonID === m.PersonID && e.Address?.trim())
        .sort((a, b) => Number(Boolean(b.IsDefault)) - Number(Boolean(a.IsDefault)));
      return {
        officialId: m.PersonID,
        house: "scottish-parliament",
        name: mspName(m).name,
        surname: mspName(m).surname,
        constituency:
          (seat?.ConstituencyID !== undefined
            ? constituencies.get(seat.ConstituencyID)
            : regions.get(seat?.RegionID ?? -1)) ?? null,
        party: (party?.PreferredName ?? party?.ActualName ?? "").trim(),
        country: "scotland",
        emails: [...new Set(theirEmails.map((e) => e.Address!.trim().toLowerCase()))],
        websites: websites.flatMap((w) => (w.PersonID === m.PersonID && w.WebURL?.trim() ? [w.WebURL.trim()] : [])),
        salutation: null,
      } satisfies OfficialMember;
    });
}
