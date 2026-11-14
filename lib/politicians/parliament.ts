// Parliament's members, both Houses, from its Members Data Platform, which
// gives each House's sitting members with their addresses in one answer
// (https://data.parliament.uk/membersdataplatform/, no key needed), and why
// a membership ended from its Members API (https://members-api.parliament.uk/).
// The caller fetches: lib/server/outside-services/parliament.server.ts.

import { constituencyCountry } from "./constituencies";
import type { Ending, OfficialMember } from "./import-changes";
import { mpSalutation, mpTitled, peerSalutation, type Gender } from "./salutation";

const MEMBERS_API = "https://members-api.parliament.uk/api";
const MEMBERS_DATA = "https://data.parliament.uk/membersdataplatform/services/mnis/members/query";

/** A member's page on Parliament's site, which staff follow from theirs. */
export const parliamentProfile = (id: number) => `https://members.parliament.uk/member/${id}`;

/** Where each House's sitting members are listed, with their addresses: those on leave too, who are still members. */
export function parliamentMembersUrl(house: "Commons" | "Lords"): string {
  return `${MEMBERS_DATA}/house=${house}%7CMembership=current/Addresses/`;
}

type Address = {
  "@Type_Id"?: string;
  IsPreferred?: string;
  Email?: string | null;
  Address1?: string | null;
};

type Member = {
  "@Member_Id": string;
  DisplayAs: string;
  ListAs: string;
  Gender?: string | null;
  Party?: { "#text"?: string } | null;
  House: string;
  MemberFrom?: string | null;
  Addresses?: { Address?: Address | Address[] } | null;
};

/** A one-item list, as the platform gives one, or none, as a list. */
const list = <T>(items: T | T[] | null | undefined): T[] =>
  items == null ? [] : Array.isArray(items) ? items : [items];

const GENDERS: Record<string, Gender> = { M: "male", F: "female" };

/** A member's emails, the one to write to first: the one they prefer, then their parliamentary office's. */
function emailsOf(addresses: Address[]): string[] {
  const rank = (a: Address) => (a.IsPreferred === "True" ? 0 : a["@Type_Id"] === "1" ? 1 : 2);
  const emails = [...addresses]
    .sort((a, b) => rank(a) - rank(b))
    .map((a) => a.Email?.trim().toLowerCase() ?? "")
    .filter((email) => /^[^\s@]+@[^\s@]+$/.test(email));
  return [...new Set(emails)];
}

/** One House's members, from the platform's answer (parliamentMembersUrl). */
export function parliamentMembers(data: unknown): OfficialMember[] {
  const members = (data as { Members?: { Member?: Member | Member[] } } | null)?.Members?.Member;
  if (members === undefined) throw new Error("Parliament's members list has no members");
  return list(members).map((m) => {
    const commons = m.House === "Commons";
    const addresses = list(m.Addresses?.Address);
    const constituency = commons ? (m.MemberFrom?.trim() ?? null) : null;
    return {
      officialId: Number(m["@Member_Id"]),
      house: commons ? "commons" : "lords",
      name: m.DisplayAs.trim(),
      constituency,
      party: m.Party?.["#text"]?.trim() ?? "",
      country: (constituency && constituencyCountry(constituency)) || null,
      emails: emailsOf(addresses),
      websites: addresses.flatMap((a) => (/^https?:\/\//i.test(a.Address1 ?? "") ? [a.Address1!.trim()] : [])),
      salutation: commons ? mpSalutation(m.ListAs, GENDERS[m.Gender ?? ""]) : peerSalutation(m.DisplayAs),
      ...(commons && mpTitled(m.ListAs) ? { titled: true as const } : {}),
    };
  });
}

/** Where the Members API says why someone's membership ended. */
export const memberUrl = (id: number) => `${MEMBERS_API}/Members/${id}`;

/**
 * Why a membership ended, from the Members API's answer (memberUrl): died,
 * retired or otherwise left, with the day and Parliament's words.
 */
export function parliamentEnding(data: unknown): Ending {
  const membership = (
    data as {
      value?: { latestHouseMembership?: { membershipEndDate?: string | null; membershipEndReason?: string | null } };
    } | null
  )?.value?.latestHouseMembership;
  const reason = membership?.membershipEndReason ?? null;
  return {
    status: /death|died/i.test(reason ?? "") ? "died" : /retire/i.test(reason ?? "") ? "retired" : "left_office",
    date: membership?.membershipEndDate?.slice(0, 10) ?? null,
    reason,
  };
}
