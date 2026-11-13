// The Senedd's members, from its ModernGov web service
// (GetCouncillorsByWard, XML, no key needed): each of its constituencies
// with the members it elected, their party, email and terms of office. It
// lists only the current term. The caller fetches:
// lib/server/outside-services/senedd.ts, with a User-Agent of our own, as the
// Senedd refuses some others.

import type { OfficialMember } from "./politician-import";

export const SENEDD_MEMBERS_URL = "https://business.senedd.wales/mgwebservice.asmx/GetCouncillorsByWard";

/** A member's page on the Senedd's site, by the name in it ("peredur-owen-griffiths-ms"). */
export const SENEDD_PAGES = "https://senedd.wales/people/";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Text from XML, its entities decoded and its spacing trimmed. */
function text(xml: string): string {
  return xml
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, entity: string) =>
      entity.startsWith("#x")
        ? String.fromCodePoint(parseInt(entity.slice(2), 16))
        : entity.startsWith("#")
          ? String.fromCodePoint(Number(entity.slice(1)))
          : (ENTITIES[entity.toLowerCase()] ?? whole),
    )
    .trim();
}

/** Each element named `tag` in `xml`, as its inner XML. */
const elements = (xml: string, tag: string) =>
  [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))].map((m) => m[1]);

/** The text of the first element named `tag` in `xml`, or "". */
const field = (xml: string, tag: string) => text(elements(xml, tag)[0] ?? "");

/** "Steve Bayliss MS" or "… AS", as the Senedd lists a member: their name without the letters after it. */
export const seneddName = (listed: string) => listed.replace(/\s+(MS|AS)$/, "").trim();

/** The sitting members, from the web service's XML. Salutations are made from their genders later. */
export function seneddMembers(xml: string): OfficialMember[] {
  const wards = elements(xml, "ward");
  if (wards.length === 0) throw new Error("The Senedd's members list has no constituencies");
  return wards.flatMap((ward) => {
    const constituency = field(ward, "wardtitle") || null;
    return elements(ward, "councillor").map((member) => {
      const email = field(member, "email").toLowerCase();
      return {
        officialId: Number(field(member, "councillorid")),
        house: "senedd" as const,
        name: seneddName(field(member, "fullusername")),
        constituency,
        party: field(member, "politicalpartytitle"),
        country: "wales" as const,
        emails: email.includes("@") ? [email] : [],
        websites: [],
        salutation: null,
      };
    });
  });
}
