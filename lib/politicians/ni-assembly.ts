// The Northern Ireland Assembly's members, from its open data
// (https://data.niassembly.gov.uk/members.asmx, no key needed): those
// sitting now, and their addresses, in two lists keyed by the member's
// PersonId. The caller fetches: lib/server/outside-services/ni-assembly.ts.

import type { OfficialMember } from "./import-changes";
import { personalSalutation } from "./salutation";

const NI_ASSEMBLY_API = "https://data.niassembly.gov.uk/members.asmx";
export const NI_MEMBERS_URL = `${NI_ASSEMBLY_API}/GetAllCurrentMembers_JSON`;
export const NI_CONTACTS_URL = `${NI_ASSEMBLY_API}/GetAllMemberContactDetails_JSON`;

/** A member's page on the Assembly's site, by their PersonId. */
export const mlaProfile = (id: number) => `https://aims.niassembly.gov.uk/mlas/details.aspx?per=${id}`;

type Member = {
  PersonId: string;
  MemberFirstName: string;
  MemberLastName: string;
  MemberPrefix?: string | null;
  PartyName?: string | null;
  ConstituencyName?: string | null;
};

/** The field is spelt so in the Assembly's data. */
type Contact = { PersonId: string; EmaiAddress?: string | null };

/** The rows of one of the Assembly's lists, which nest them as AllMembersList.Member. */
function membersOf<T>(data: unknown, name: string): T[] {
  const rows = (data as { AllMembersList?: { Member?: T[] } } | null)?.AllMembersList?.Member;
  if (!Array.isArray(rows)) throw new Error(`The NI Assembly's ${name} has no members`);
  return rows;
}

/** The sitting members, from the members list and the contacts list. */
export function niAssemblyMembers(membersData: unknown, contactsData: unknown): OfficialMember[] {
  const contacts = membersOf<Contact>(contactsData, "contacts");
  return membersOf<Member>(membersData, "members").map((m) => {
    const surname = m.MemberLastName.trim();
    const title = m.MemberPrefix?.trim() || undefined;
    const emails = contacts
      .filter((c) => c.PersonId === m.PersonId)
      .map((c) => c.EmaiAddress?.trim().toLowerCase() ?? "")
      .filter((email) => email.includes("@"));
    return {
      officialId: Number(m.PersonId),
      house: "ni-assembly",
      name: `${m.MemberFirstName.trim()} ${surname}`,
      constituency: m.ConstituencyName?.trim() || null,
      party: m.PartyName?.trim() ?? "",
      country: "northern-ireland",
      emails: [...new Set(emails)],
      websites: [],
      salutation: personalSalutation({ title, first: m.MemberFirstName.trim(), surname }, undefined),
      // The Assembly records every MLA's title, as its Official Report uses it.
      ...(title ? { titled: true as const } : {}),
    };
  });
}
